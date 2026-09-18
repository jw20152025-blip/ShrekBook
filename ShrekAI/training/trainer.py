import math
import os
import signal
import time

from pathlib import Path

import torch
from torch.utils.data import DataLoader

from config import (
    DEVICE,
    DTYPE,
    BATCH_SIZE,
    GRADIENT_ACCUMULATION_STEPS,
    LEARNING_RATE,
    MIN_LEARNING_RATE,
    WEIGHT_DECAY,
    BETAS,
    MAX_STEPS,
    WARMUP_STEPS,
    GRAD_CLIP,
    VALIDATION_INTERVAL,
    CHECKPOINT_INTERVAL,
    NUM_WORKERS,
    SEED,
    LATEST_CHECKPOINT,
    BEST_CHECKPOINT,
    FINAL_MODEL,
    USE_COMPILE,
    MAX_SEQ_LEN,
    DATASET_DIR,
    TRAINING_FILES,
    VOCAB_SIZE,
    BASE_VOCAB_SIZE,
)

from training.dataset import (
    ShrekDataset,
    ByteTokenizer,
)

from core.model import (
    ShrekAI,
    ModelConfig,
)

from training.evaluator import evaluate


# ============================================================
# SESSION SETTINGS
# ============================================================

SESSION_STEPS = 1_000

LOG_INTERVAL = 1

TARGET_SECONDS_PER_STEP = 1.0

SAFETY_CHECKPOINT_INTERVAL = 25


# ============================================================
# WEB DATASET
# ============================================================

WEB_DATASET_FILE = (
    Path(DATASET_DIR)
    / "web.jsonl"
)


# ============================================================
# TRAINER
# ============================================================

class Trainer:

    def __init__(
        self,
        training_mode="normal",
    ):

        training_mode = (
            str(training_mode)
            .strip()
            .lower()
        )

        if training_mode not in (
            "normal",
            "web",
        ):

            raise ValueError(
                "Invalid training mode. "
                "Use 'normal' or 'web'."
            )

        self.training_mode = (
            training_mode
        )

        # ----------------------------------------------------
        # RANDOM SEED
        # ----------------------------------------------------

        torch.manual_seed(
            SEED
        )

        if torch.cuda.is_available():

            torch.cuda.manual_seed_all(
                SEED
            )

        self.device = torch.device(
            DEVICE
        )

        # ----------------------------------------------------
        # SHUTDOWN
        # ----------------------------------------------------

        self.shutdown_requested = False

        self.emergency_save_in_progress = (
            False
        )

        self._install_signal_handlers()

        # ----------------------------------------------------
        # TOKENIZER
        # ----------------------------------------------------

        self.tokenizer = (
            ByteTokenizer()
        )

        # ----------------------------------------------------
        # MODEL
        # ----------------------------------------------------

        self.model = ShrekAI(
            ModelConfig()
        ).to(
            self.device
        )

        # ----------------------------------------------------
        # OPTIMIZER
        # ----------------------------------------------------

        self.optimizer = (
            self._create_optimizer()
        )

        # ----------------------------------------------------
        # TRAINING STATE
        # ----------------------------------------------------

        self.step = 0

        self.best_loss = float(
            "inf"
        )

        # ----------------------------------------------------
        # AMP
        # ----------------------------------------------------

        self.use_amp = (
            self.device.type == "cuda"
            and DTYPE in (
                torch.float16,
                torch.bfloat16,
            )
        )

        self.use_grad_scaler = (
            self.device.type == "cuda"
            and DTYPE == torch.float16
        )

        self.scaler = torch.amp.GradScaler(
            "cuda",
            enabled=self.use_grad_scaler,
        )

        # ----------------------------------------------------
        # DATASET
        # ----------------------------------------------------

        self.training_files = (
            self._get_training_files()
        )

        self.dataset = ShrekDataset(
            files=self.training_files,
            tokenizer=self.tokenizer,
            max_seq_len=MAX_SEQ_LEN,
        )

        # ----------------------------------------------------
        # DATALOADER
        # ----------------------------------------------------

        loader_kwargs = {

            "dataset": self.dataset,

            "batch_size": BATCH_SIZE,

            "shuffle": True,

            "num_workers": NUM_WORKERS,

            "drop_last": False,

        }

        if self.device.type == "cuda":

            loader_kwargs[
                "pin_memory"
            ] = True

        if NUM_WORKERS > 0:

            loader_kwargs[
                "persistent_workers"
            ] = True

            loader_kwargs[
                "prefetch_factor"
            ] = 2

        self.loader = DataLoader(
            **loader_kwargs
        )

        if len(self.loader) == 0:

            raise RuntimeError(
                "Training DataLoader contains 0 batches.\n"
                f"Dataset samples: "
                f"{len(self.dataset)}\n"
                f"Batch size: {BATCH_SIZE}\n"
                f"Training mode: "
                f"{self.training_mode}\n"
                "Add more training data or "
                "reduce the batch size."
            )

        self.iterator = iter(
            self.loader
        )

        # ----------------------------------------------------
        # COMPILE
        # ----------------------------------------------------

        self.compiled = False

        if (
            USE_COMPILE
            and hasattr(
                torch,
                "compile",
            )
        ):

            print(
                "[trainer] torch.compile enabled."
            )

            try:

                self.model = torch.compile(
                    self.model
                )

                self.compiled = True

                print(
                    "[trainer] "
                    "torch.compile initialized."
                )

            except Exception as error:

                print(
                    "[trainer] "
                    "torch.compile failed."
                )

                print(
                    f"[trainer] Reason: {error}"
                )

                print(
                    "[trainer] "
                    "Continuing without compilation."
                )

        # ----------------------------------------------------
        # STARTUP
        # ----------------------------------------------------

        self._print_startup_info()

    # ========================================================
    # DATASET SOURCES
    # ========================================================

    def _get_training_files(self):

        if self.training_mode == "web":

            if not WEB_DATASET_FILE.exists():

                raise FileNotFoundError(
                    "Web training dataset does not exist.\n"
                    f"Expected: "
                    f"{WEB_DATASET_FILE}\n\n"
                    "Run option 5: Web Training first."
                )

            if (
                WEB_DATASET_FILE.stat().st_size
                == 0
            ):

                raise RuntimeError(
                    "Web training dataset is empty.\n"
                    f"File: {WEB_DATASET_FILE}\n\n"
                    "Run option 5: Web Training first."
                )

            print(
                "[trainer] "
                "WEB-ONLY dataset selected."
            )

            return [
                WEB_DATASET_FILE
            ]

        print(
            "[trainer] "
            "Using configured training datasets."
        )

        return [
            path
            for path in TRAINING_FILES
            if Path(path).exists()
        ]

    # ========================================================
    # SIGNAL HANDLERS
    # ========================================================

    def _install_signal_handlers(
        self
    ):

        def request_shutdown(
            signum,
            frame,
        ):

            if self.shutdown_requested:

                print()

                print(
                    "[emergency] "
                    "Shutdown requested again."
                )

                print(
                    "[emergency] "
                    "Please wait for the checkpoint."
                )

                return

            self.shutdown_requested = True

            print()
            print("=" * 72)

            print(
                "[emergency] "
                "Shutdown signal received."
            )

            print(
                "[emergency] "
                "Finishing the current optimizer step."
            )

            print(
                "[emergency] "
                "A checkpoint will be saved immediately "
                "after it."
            )

            print("=" * 72)

        try:

            signal.signal(
                signal.SIGINT,
                request_shutdown,
            )

        except (
            ValueError,
            OSError,
        ):

            pass

        try:

            signal.signal(
                signal.SIGTERM,
                request_shutdown,
            )

        except (
            ValueError,
            OSError,
            AttributeError,
        ):

            pass

        try:

            signal.signal(
                signal.SIGBREAK,
                request_shutdown,
            )

        except (
            ValueError,
            OSError,
            AttributeError,
        ):

            pass

    # ========================================================
    # OPTIMIZER
    # ========================================================

    def _create_optimizer(
        self
    ):

        decay = []

        no_decay = []

        for parameter in (
            self.model.parameters()
        ):

            if not parameter.requires_grad:

                continue

            if parameter.ndim >= 2:

                decay.append(
                    parameter
                )

            else:

                no_decay.append(
                    parameter
                )

        parameter_groups = [

            {
                "params": decay,
                "weight_decay": WEIGHT_DECAY,
            },

            {
                "params": no_decay,
                "weight_decay": 0.0,
            },

        ]

        optimizer_kwargs = {

            "lr": LEARNING_RATE,

            "betas": BETAS,

        }

        if self.device.type == "cuda":

            try:

                print(
                    "[trainer] "
                    "Using fused AdamW."
                )

                return torch.optim.AdamW(
                    parameter_groups,
                    fused=True,
                    **optimizer_kwargs,
                )

            except (
                TypeError,
                RuntimeError,
            ):

                print(
                    "[trainer] "
                    "Fused AdamW unavailable."
                )

        return torch.optim.AdamW(
            parameter_groups,
            **optimizer_kwargs,
        )

    # ========================================================
    # OPTIMIZER STATE MIGRATION
    # ========================================================

    @staticmethod
    def _expand_optimizer_tensor(
        old_tensor,
        new_shape,
    ):

        if (
            not torch.is_tensor(
                old_tensor
            )
        ):

            return old_tensor

        if (
            tuple(old_tensor.shape)
            == tuple(new_shape)
        ):

            return old_tensor

        # ----------------------------------------------------
        # The embedding state is:
        #
        # [old_vocab, d_model]
        #
        # Expand only the vocabulary dimension.
        # ----------------------------------------------------

        if (
            old_tensor.ndim == 2
            and len(new_shape) == 2
            and old_tensor.shape[1]
            == new_shape[1]
            and old_tensor.shape[0]
            < new_shape[0]
        ):

            expanded = torch.zeros(
                new_shape,
                dtype=old_tensor.dtype,
                device=old_tensor.device,
            )

            expanded[
                :old_tensor.shape[0]
            ].copy_(
                old_tensor
            )

            return expanded

        # ----------------------------------------------------
        # Unknown mismatch.
        # ----------------------------------------------------

        return old_tensor

    def _migrate_optimizer_state(
        self,
        old_optimizer_state,
        old_parameter_shapes,
    ):

        if not old_optimizer_state:

            print(
                "[trainer] No optimizer state found."
            )

            return False

        try:

            new_state = (
                self.optimizer.state_dict()
            )

            old_groups = (
                old_optimizer_state.get(
                    "param_groups",
                    [],
                )
            )

            new_groups = (
                new_state.get(
                    "param_groups",
                    [],
                )
            )

            old_state = (
                old_optimizer_state.get(
                    "state",
                    {},
                )
            )

            if len(old_groups) != len(
                new_groups
            ):

                raise RuntimeError(
                    "Optimizer parameter-group count changed."
                )

            # ------------------------------------------------
            # Map old parameter IDs to current parameter IDs
            # by their position inside each optimizer group.
            # ------------------------------------------------

            id_mapping = {}

            for old_group, new_group in zip(
                old_groups,
                new_groups,
            ):

                old_ids = old_group[
                    "params"
                ]

                new_ids = new_group[
                    "params"
                ]

                if len(old_ids) != len(
                    new_ids
                ):

                    raise RuntimeError(
                        "Optimizer parameter count changed."
                    )

                for old_id, new_id in zip(
                    old_ids,
                    new_ids,
                ):

                    id_mapping[
                        old_id
                    ] = new_id

            migrated_state = {}

            current_parameters = []

            for group in (
                self.optimizer.param_groups
            ):

                current_parameters.extend(
                    group["params"]
                )

            old_parameters = []

            for group in (
                old_groups
            ):

                old_parameters.extend(
                    group["params"]
                )

            # ------------------------------------------------
            # Parameter shapes are needed because the old
            # checkpoint embedding has 263 rows.
            # ------------------------------------------------

            for old_id, old_entry in (
                old_state.items()
            ):

                if old_id not in id_mapping:

                    continue

                new_id = id_mapping[
                    old_id
                ]

                new_entry = {}

                parameter_index = None

                for index, old_param_id in enumerate(
                    old_parameters
                ):

                    if old_param_id == old_id:

                        parameter_index = index

                        break

                if parameter_index is None:

                    continue

                current_parameter = (
                    current_parameters[
                        parameter_index
                    ]
                )

                current_shape = (
                    current_parameter.shape
                )

                for key, value in (
                    old_entry.items()
                ):

                    if torch.is_tensor(
                        value
                    ):

                        if value.ndim == 0:

                            new_entry[
                                key
                            ] = value

                        elif (
                            tuple(value.shape)
                            == tuple(current_shape)
                        ):

                            new_entry[
                                key
                            ] = value

                        elif (
                            value.ndim
                            == len(current_shape)
                            and value.shape[1:]
                            == current_shape[1:]
                            and value.shape[0]
                            < current_shape[0]
                        ):

                            expanded = (
                                torch.zeros(
                                    current_shape,
                                    dtype=value.dtype,
                                    device=value.device,
                                )
                            )

                            expanded[
                                :value.shape[0]
                            ].copy_(
                                value
                            )

                            new_entry[
                                key
                            ] = expanded

                        else:

                            raise RuntimeError(
                                "Optimizer state tensor "
                                f"shape mismatch for parameter "
                                f"{parameter_index}: "
                                f"{value.shape} -> "
                                f"{current_shape}"
                            )

                    else:

                        new_entry[
                            key
                        ] = value

                migrated_state[
                    new_id
                ] = new_entry

            new_state[
                "state"
            ] = migrated_state

            self.optimizer.load_state_dict(
                new_state
            )

            print(
                "[trainer] Optimizer state migrated "
                "successfully."
            )

            return True

        except Exception as error:

            print(
                "[trainer] WARNING: "
                "Optimizer state migration failed."
            )

            print(
                f"[trainer] Reason: {error}"
            )

            print(
                "[trainer] Model weights will still "
                "be preserved."
            )

            print(
                "[trainer] AdamW will start with "
                "fresh optimizer moments."
            )

            return False

    # ========================================================
    # STARTUP INFORMATION
    # ========================================================

    def _print_startup_info(
        self
    ):

        parameters = (
            self.model.count_parameters()
        )

        effective_batch = (
            BATCH_SIZE
            * GRADIENT_ACCUMULATION_STEPS
        )

        tokens_per_step = (
            effective_batch
            * MAX_SEQ_LEN
        )

        session_target = min(
            self.step
            + SESSION_STEPS,
            MAX_STEPS,
        )

        print()
        print("=" * 72)

        print(
            "                      SHREKAI TRAINING"
        )

        print("=" * 72)

        print(
            f"Training mode:         "
            f"{self.training_mode.upper()}"
        )

        print(
            f"Vocabulary size:       "
            f"{VOCAB_SIZE:,}"
        )

        print(
            f"Legacy vocabulary:     "
            f"{BASE_VOCAB_SIZE:,}"
        )

        print(
            "Training files:"
        )

        for file in (
            self.training_files
        ):

            print(
                f"  - {file}"
            )

        print(
            f"Device:                "
            f"{self.device}"
        )

        if self.device.type == "cuda":

            try:

                gpu_name = (
                    torch.cuda.get_device_name(
                        self.device
                    )
                )

                print(
                    f"GPU:                   "
                    f"{gpu_name}"
                )

            except Exception:

                pass

            try:

                total_memory = (
                    torch.cuda
                    .get_device_properties(
                        self.device
                    )
                    .total_memory
                    / (1024 ** 3)
                )

                print(
                    f"GPU VRAM:              "
                    f"{total_memory:.2f} GB"
                )

            except Exception:

                pass

        print(
            f"Model parameters:      "
            f"{parameters:,}"
        )

        print(
            f"Sequence length:       "
            f"{MAX_SEQ_LEN:,}"
        )

        print(
            f"Batch size:            "
            f"{BATCH_SIZE}"
        )

        print(
            f"Gradient accumulation: "
            f"{GRADIENT_ACCUMULATION_STEPS}"
        )

        print(
            f"Effective batch size:  "
            f"{effective_batch}"
        )

        print(
            f"Tokens per optimizer:  "
            f"{tokens_per_step:,}"
        )

        print(
            f"Learning rate:         "
            f"{LEARNING_RATE:.2e}"
        )

        print(
            f"Lifetime maximum:      "
            f"{MAX_STEPS:,} steps"
        )

        print(
            f"Session length:        "
            f"{SESSION_STEPS:,} steps"
        )

        print(
            f"Session target:        "
            f"{self.step:,} -> "
            f"{session_target:,}"
        )

        print(
            f"Dataset samples:       "
            f"{len(self.dataset):,}"
        )

        print(
            f"DataLoader batches:    "
            f"{len(self.loader):,}"
        )

        print(
            f"Configured checkpoint: "
            f"{CHECKPOINT_INTERVAL:,}"
        )

        print(
            f"Safety checkpoint:     "
            f"{SAFETY_CHECKPOINT_INTERVAL:,}"
        )

        print(
            f"Validation interval:   "
            f"{VALIDATION_INTERVAL:,}"
        )

        print(
            f"AMP:                   "
            f"{self.use_amp}"
        )

        print(
            f"GradScaler:            "
            f"{self.use_grad_scaler}"
        )

        print(
            f"torch.compile:         "
            f"{self.compiled}"
        )

        print(
            f"Target speed:          "
            f"{TARGET_SECONDS_PER_STEP:.1f} sec/step"
        )

        print()

        print(
            "Training is starting..."
        )

        print(
            "The first step may take longer "
            "while PyTorch initializes."
        )

        print(
            "Emergency checkpoint protection: ENABLED"
        )

        print("=" * 72)
        print()

    # ========================================================
    # GPU MEMORY
    # ========================================================

    def _gpu_memory(
        self
    ):

        if self.device.type != "cuda":

            return "CPU"

        try:

            allocated = (
                torch.cuda.memory_allocated(
                    self.device
                )
                / (1024 ** 3)
            )

            reserved = (
                torch.cuda.memory_reserved(
                    self.device
                )
                / (1024 ** 3)
            )

            return (
                f"VRAM "
                f"{allocated:.2f} GB allocated / "
                f"{reserved:.2f} GB reserved"
            )

        except Exception:

            return "VRAM unavailable"

    # ========================================================
    # UNCOMPILED MODEL
    # ========================================================

    def _get_uncompiled_model(
        self
    ):

        model = self.model

        if hasattr(
            model,
            "_orig_mod",
        ):

            model = model._orig_mod

        return model

    # ========================================================
    # LEARNING RATE
    # ========================================================

    def learning_rate(
        self
    ):

        if self.step < WARMUP_STEPS:

            return (
                LEARNING_RATE
                * (self.step + 1)
                / max(
                    1,
                    WARMUP_STEPS,
                )
            )

        progress = (
            self.step
            - WARMUP_STEPS
        ) / max(
            1,
            MAX_STEPS
            - WARMUP_STEPS,
        )

        progress = min(
            1.0,
            max(
                0.0,
                progress,
            ),
        )

        cosine = 0.5 * (
            1.0
            + math.cos(
                math.pi
                * progress
            )
        )

        return (
            MIN_LEARNING_RATE
            + (
                LEARNING_RATE
                - MIN_LEARNING_RATE
            )
            * cosine
        )

    # ========================================================
    # RNG
    # ========================================================

    def _get_rng_state(
        self
    ):

        state = {
            "torch": (
                torch.get_rng_state()
            ),
        }

        if torch.cuda.is_available():

            state["cuda"] = (
                torch.cuda.get_rng_state_all()
            )

        return state

    def _restore_rng_state(
        self,
        state,
    ):

        if not state:

            return

        try:

            if "torch" in state:

                torch.set_rng_state(
                    state["torch"]
                )

            if (
                torch.cuda.is_available()
                and "cuda" in state
            ):

                torch.cuda.set_rng_state_all(
                    state["cuda"]
                )

        except Exception as error:

            print(
                "[trainer] Warning: "
                f"Could not restore RNG state: "
                f"{error}"
            )

    # ========================================================
    # CHECKPOINT SAVE
    # ========================================================

    def save_checkpoint(
        self,
        path,
    ):

        model = (
            self._get_uncompiled_model()
        )

        state = {

            "model": (
                model.state_dict()
            ),

            "optimizer": (
                self.optimizer.state_dict()
            ),

            "step": self.step,

            "best_loss": (
                self.best_loss
            ),

            "config": (
                model.config.__dict__
            ),

            "scaler": (
                self.scaler.state_dict()
            ),

            "rng": (
                self._get_rng_state()
            ),

            "training_mode": (
                self.training_mode
            ),

            "training_dataset": [
                str(path)
                for path in self.training_files
            ],

            "vocab_size": (
                model.config.vocab_size
            ),

        }

        path = Path(path)

        path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        temporary = path.with_suffix(
            path.suffix
            + ".tmp"
        )

        torch.save(
            state,
            temporary,
        )

        os.replace(
            temporary,
            path,
        )

    # ========================================================
    # EMERGENCY SAVE
    # ========================================================

    def _emergency_save(
        self,
        reason,
    ):

        if (
            self.emergency_save_in_progress
        ):

            return

        self.emergency_save_in_progress = (
            True
        )

        print()
        print("=" * 72)

        print(
            f"[emergency] {reason}"
        )

        print(
            "[emergency] Saving checkpoint at "
            f"completed step {self.step:,}..."
        )

        emergency_start = (
            time.perf_counter()
        )

        try:

            self.save_checkpoint(
                LATEST_CHECKPOINT
            )

            elapsed = (
                time.perf_counter()
                - emergency_start
            )

            print(
                "[emergency] Checkpoint saved "
                f"successfully in {elapsed:.2f}s."
            )

            print(
                "[emergency] Resume point: "
                f"step {self.step:,}."
            )

        except Exception as error:

            print(
                "[emergency] CRITICAL: "
                "checkpoint save failed!"
            )

            print(
                f"[emergency] Error: {error}"
            )

        print("=" * 72)
        print()

    # ========================================================
    # CHECKPOINT LOAD
    # ========================================================

    def load_checkpoint(
        self,
        path=None,
    ):

        path = (
            path
            or LATEST_CHECKPOINT
        )

        path = Path(path)

        if not path.exists():

            print(
                "[trainer] No checkpoint found."
            )

            return False

        print(
            "[trainer] Loading checkpoint: "
            f"{path}"
        )

        checkpoint = torch.load(
            path,
            map_location="cpu",
            weights_only=False,
        )

        checkpoint_mode = (
            checkpoint.get(
                "training_mode"
            )
        )

        if (
            checkpoint_mode is not None
            and checkpoint_mode
            != self.training_mode
        ):

            print(
                "[trainer] WARNING:"
            )

            print(
                "[trainer] Checkpoint was created "
                f"in '{checkpoint_mode}' mode."
            )

            print(
                "[trainer] Current training mode is "
                f"'{self.training_mode}'."
            )

            print(
                "[trainer] Model weights will still "
                "be loaded."
            )

            print(
                "[trainer] New batches will come from "
                "the current training mode."
            )

        model = (
            self._get_uncompiled_model()
        )

        old_state = checkpoint[
            "model"
        ]

        old_vocab = (
            old_state[
                "token_embedding.weight"
            ].shape[0]
        )

        new_vocab = (
            model.config.vocab_size
        )

        # ----------------------------------------------------
        # NORMAL LOAD
        # ----------------------------------------------------

        if old_vocab == new_vocab:

            model.load_state_dict(
                old_state,
                strict=True,
            )

            optimizer_loaded = False

            try:

                self.optimizer.load_state_dict(
                    checkpoint[
                        "optimizer"
                    ]
                )

                optimizer_loaded = True

                print(
                    "[trainer] Optimizer state "
                    "loaded normally."
                )

            except Exception as error:

                print(
                    "[trainer] WARNING: "
                    "Normal optimizer load failed."
                )

                print(
                    f"[trainer] Reason: {error}"
                )

        # ----------------------------------------------------
        # LEGACY MODEL MIGRATION
        # ----------------------------------------------------

        elif (
            old_vocab
            < new_vocab
        ):

            print()
            print("=" * 72)

            print(
                "[migration] Legacy ShrekAI checkpoint detected."
            )

            print(
                f"[migration] Old vocabulary: {old_vocab:,}"
            )

            print(
                f"[migration] New vocabulary: {new_vocab:,}"
            )

            print(
                "[migration] Existing model weights "
                "will be preserved."
            )

            print(
                "[migration] New subword rows will "
                "be initialized."
            )

            print("=" * 72)
            print()

            model.load_legacy_state_dict(
                old_state
            )

            print(
                "[migration] Model weights migrated."
            )

            # ------------------------------------------------
            # Migrate AdamW.
            # ------------------------------------------------

            optimizer_loaded = (
                self._migrate_optimizer_state(
                    checkpoint.get(
                        "optimizer"
                    ),
                    None,
                )
            )

            if optimizer_loaded:

                print(
                    "[migration] Optimizer progress "
                    "preserved."
                )

            else:

                print(
                    "[migration] Optimizer moments "
                    "were reset."
                )

                print(
                    "[migration] IMPORTANT: Model weights "
                    "and training step are still preserved."
                )

            print()

        else:

            raise RuntimeError(
                "Checkpoint vocabulary is larger "
                "than the current model vocabulary.\n"
                f"Checkpoint: {old_vocab}\n"
                f"Current: {new_vocab}"
            )

        # ----------------------------------------------------
        # TRAINING STATE
        # ----------------------------------------------------

        self.step = checkpoint.get(
            "step",
            0,
        )

        self.best_loss = checkpoint.get(
            "best_loss",
            float("inf"),
        )

        if "scaler" in checkpoint:

            try:

                self.scaler.load_state_dict(
                    checkpoint["scaler"]
                )

            except Exception as error:

                print(
                    "[trainer] Warning: "
                    "Could not restore GradScaler:"
                    f" {error}"
                )

        self._restore_rng_state(
            checkpoint.get(
                "rng"
            )
        )

        # ----------------------------------------------------
        # AUTOMATICALLY SAVE MIGRATED CHECKPOINT
        # ----------------------------------------------------

        if old_vocab != new_vocab:

            print(
                "[migration] Saving migrated "
                "checkpoint..."
            )

            self.save_checkpoint(
                LATEST_CHECKPOINT
            )

            print(
                "[migration] New checkpoint saved."
            )

        print(
            "[trainer] Resuming from step "
            f"{self.step:,}."
        )

        return True

    # ========================================================
    # NEXT BATCH
    # ========================================================

    def _next_batch(
        self
    ):

        try:

            return next(
                self.iterator
            )

        except StopIteration:

            self.iterator = iter(
                self.loader
            )

            return next(
                self.iterator
            )

    # ========================================================
    # TRAINING
    # ========================================================

    def train(
        self
    ):

        if self.step >= MAX_STEPS:

            print()

            print(
                "[trainer] Lifetime maximum "
                "already reached."
            )

            return

        session_start_step = (
            self.step
        )

        session_target = min(
            self.step
            + SESSION_STEPS,
            MAX_STEPS,
        )

        self.model.train()

        training_start = (
            time.perf_counter()
        )

        total_tokens = 0

        last_loss = float(
            "nan"
        )

        last_gradient_norm = float(
            "nan"
        )

        last_gpu_memory = (
            "VRAM not sampled"
        )

        print()

        print(
            ">>> SHREKAI IS NOW TRAINING <<<"
        )

        if self.training_mode == "web":

            print(
                ">>> MODE: WEB-ONLY <<<"
            )

            print(
                ">>> SOURCE: datasets/web.jsonl <<<"
            )

        else:

            print(
                ">>> MODE: NORMAL <<<"
            )

            print(
                ">>> SOURCE: ALL CONFIGURED "
                "TRAINING DATA <<<"
            )

        print(
            f">>> SESSION: "
            f"steps {self.step:,} -> "
            f"{session_target:,} <<<"
        )

        print()

        try:

            while self.step < session_target:

                step_start = (
                    time.perf_counter()
                )

                self.optimizer.zero_grad(
                    set_to_none=True
                )

                accumulated_loss = (
                    torch.zeros(
                        (),
                        device=self.device,
                        dtype=torch.float32,
                    )
                )

                microbatches_completed = 0

                step_tokens = 0

                for _ in range(
                    GRADIENT_ACCUMULATION_STEPS
                ):

                    batch = (
                        self._next_batch()
                    )

                    input_ids = (
                        batch[
                            "input_ids"
                        ].to(
                            self.device,
                            non_blocking=(
                                self.device.type
                                == "cuda"
                            ),
                        )
                    )

                    labels = (
                        batch[
                            "labels"
                        ].to(
                            self.device,
                            non_blocking=(
                                self.device.type
                                == "cuda"
                            ),
                        )
                    )

                    if self.use_amp:

                        with torch.autocast(
                            device_type="cuda",
                            dtype=DTYPE,
                        ):

                            _, loss = self.model(
                                input_ids,
                                labels,
                            )

                    else:

                        _, loss = self.model(
                            input_ids,
                            labels,
                        )

                    accumulated_loss.add_(
                        loss.detach().float()
                    )

                    scaled_loss = (
                        loss
                        / GRADIENT_ACCUMULATION_STEPS
                    )

                    if self.use_grad_scaler:

                        self.scaler.scale(
                            scaled_loss
                        ).backward()

                    else:

                        scaled_loss.backward()

                    tokens = (
                        input_ids.numel()
                    )

                    step_tokens += tokens

                    total_tokens += tokens

                    microbatches_completed += 1

                if self.use_grad_scaler:

                    self.scaler.unscale_(
                        self.optimizer
                    )

                gradient_norm = (
                    torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(),
                        GRAD_CLIP,
                    )
                )

                lr = self.learning_rate()

                for group in (
                    self.optimizer.param_groups
                ):

                    group["lr"] = lr

                if self.use_grad_scaler:

                    self.scaler.step(
                        self.optimizer
                    )

                    self.scaler.update()

                else:

                    self.optimizer.step()

                self.step += 1

                now = time.perf_counter()

                step_elapsed = (
                    now - step_start
                )

                total_elapsed = (
                    now - training_start
                )

                average_loss = (
                    accumulated_loss
                    / max(
                        1,
                        microbatches_completed,
                    )
                ).item()

                last_loss = (
                    average_loss
                )

                step_tokens_per_second = (
                    step_tokens
                    / max(
                        step_elapsed,
                        1e-9,
                    )
                )

                steps_per_second = (
                    1.0
                    / max(
                        step_elapsed,
                        1e-9,
                    )
                )

                if (
                    step_elapsed
                    <= TARGET_SECONDS_PER_STEP
                ):

                    speed_status = "FAST"

                else:

                    speed_status = "SLOW"

                remaining_steps = (
                    session_target
                    - self.step
                )

                eta_seconds = (
                    remaining_steps
                    * step_elapsed
                )

                eta_hours = int(
                    eta_seconds
                    // 3600
                )

                eta_minutes = int(
                    (
                        eta_seconds
                        % 3600
                    )
                    // 60
                )

                eta_secs = int(
                    eta_seconds
                    % 60
                )

                last_gradient_norm = (
                    float(
                        gradient_norm
                    )
                )

                session_span = max(
                    1,
                    session_target
                    - session_start_step,
                )

                session_progress = (
                    self.step
                    - session_start_step
                ) / session_span

                session_progress = min(
                    1.0,
                    max(
                        0.0,
                        session_progress,
                    ),
                )

                if (
                    self.step == 1
                    or self.step % 10 == 0
                ):

                    last_gpu_memory = (
                        self._gpu_memory()
                    )

                print(
                    f"[step {self.step:,}/"
                    f"{session_target:,}] "
                    f"loss={average_loss:.4f} "
                    f"lr={lr:.2e} "
                    f"grad={last_gradient_norm:.3f} "
                    f"{step_tokens_per_second:,.0f} tok/s "
                    f"{step_elapsed:.2f}s/step "
                    f"{steps_per_second:.2f} step/s "
                    f"[{speed_status}] "
                    f"{session_progress * 100:5.1f}% "
                    f"ETA "
                    f"{eta_hours:02d}:"
                    f"{eta_minutes:02d}:"
                    f"{eta_secs:02d} "
                    f"| {last_gpu_memory}",
                    flush=True,
                )

                # --------------------------------------------
                # VALIDATION
                # --------------------------------------------

                if (
                    self.step
                    % VALIDATION_INTERVAL
                    == 0
                ):

                    print()

                    print(
                        "[validation] Running at "
                        f"step {self.step:,}..."
                    )

                    validation_start = (
                        time.perf_counter()
                    )

                    results = evaluate(
                        self.model,
                        self.tokenizer,
                    )

                    validation_elapsed = (
                        time.perf_counter()
                        - validation_start
                    )

                    print(
                        "[validation] "
                        f"loss={results['loss']:.4f} "
                        f"perplexity="
                        f"{results['perplexity']:.2f} "
                        f"time="
                        f"{validation_elapsed:.2f}s"
                    )

                    if (
                        results["loss"]
                        < self.best_loss
                    ):

                        self.best_loss = (
                            results["loss"]
                        )

                        print(
                            "[validation] "
                            "New best model."
                        )

                        self.save_checkpoint(
                            BEST_CHECKPOINT
                        )

                    self.model.train()

                # --------------------------------------------
                # SAFETY CHECKPOINT
                # --------------------------------------------

                if (
                    self.step
                    % SAFETY_CHECKPOINT_INTERVAL
                    == 0
                ):

                    print()

                    print(
                        "[checkpoint] Safety save "
                        f"at step {self.step:,}..."
                    )

                    checkpoint_start = (
                        time.perf_counter()
                    )

                    self.save_checkpoint(
                        LATEST_CHECKPOINT
                    )

                    checkpoint_elapsed = (
                        time.perf_counter()
                        - checkpoint_start
                    )

                    print(
                        "[checkpoint] Saved in "
                        f"{checkpoint_elapsed:.2f}s."
                    )

                # --------------------------------------------
                # SHUTDOWN
                # --------------------------------------------

                if self.shutdown_requested:

                    self._emergency_save(
                        "Graceful shutdown checkpoint."
                    )

                    print(
                        "[emergency] "
                        "Training stopped safely."
                    )

                    return

        except KeyboardInterrupt:

            self._emergency_save(
                "Keyboard interrupt received."
            )

            return

        except Exception as error:

            print()
            print("=" * 72)

            print(
                "[emergency] "
                "UNEXPECTED TRAINING ERROR"
            )

            print(
                f"[emergency] "
                f"{type(error).__name__}: "
                f"{error}"
            )

            print(
                "[emergency] "
                f"Current completed step: "
                f"{self.step:,}"
            )

            self._emergency_save(
                "Emergency save after "
                "unexpected training error."
            )

            print(
                "[emergency] "
                "Re-raising original error."
            )

            print("=" * 72)
            print()

            raise

        # ====================================================
        # SESSION COMPLETE
        # ====================================================

        total_time = (
            time.perf_counter()
            - training_start
        )

        total_steps = (
            self.step
            - session_start_step
        )

        average_step_time = (
            total_time
            / max(
                1,
                total_steps,
            )
        )

        average_steps_per_second = (
            total_steps
            / max(
                total_time,
                1e-9,
            )
        )

        average_tokens_per_second = (
            total_tokens
            / max(
                total_time,
                1e-9,
            )
        )

        print()

        print(
            "[checkpoint] "
            "Saving session state..."
        )

        self.save_checkpoint(
            LATEST_CHECKPOINT
        )

        print(
            "[checkpoint] "
            "Session checkpoint saved."
        )

        model = (
            self._get_uncompiled_model()
        )

        Path(
            FINAL_MODEL
        ).parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        torch.save(
            model.state_dict(),
            FINAL_MODEL,
        )

        print()
        print("=" * 72)

        print(
            "                    SESSION FINISHED"
        )

        print("=" * 72)

        print(
            f"Training mode:         "
            f"{self.training_mode.upper()}"
        )

        print(
            "Training source:"
        )

        for file in (
            self.training_files
        ):

            print(
                f"  - {file}"
            )

        print(
            f"Steps completed:       "
            f"{total_steps:,}"
        )

        print(
            f"Lifetime step:         "
            f"{self.step:,} / {MAX_STEPS:,}"
        )

        print(
            f"Final loss:            "
            f"{last_loss:.4f}"
        )

        print(
            f"Average step time:     "
            f"{average_step_time:.2f} sec"
        )

        print(
            f"Average steps/sec:     "
            f"{average_steps_per_second:.2f}"
        )

        print(
            f"Average tokens/sec:    "
            f"{average_tokens_per_second:,.0f}"
        )

        print(
            f"Target step time:      "
            f"{TARGET_SECONDS_PER_STEP:.2f} sec"
        )

        if (
            average_step_time
            <= TARGET_SECONDS_PER_STEP
        ):

            print(
                "Performance target:    ACHIEVED"
            )

        else:

            print(
                "Performance target:    "
                "HARDWARE LIMITED"
            )

        print(
            f"Total session time:    "
            f"{total_time / 3600:.2f} hours"
        )

        print(
            f"Latest checkpoint:     "
            f"{LATEST_CHECKPOINT}"
        )

        print(
            f"Final model:           "
            f"{FINAL_MODEL}"
        )

        print("=" * 72)
        print()