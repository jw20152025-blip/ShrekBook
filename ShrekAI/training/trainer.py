import math
import os
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
)

from core.model import (
    ShrekAI,
    ModelConfig,
)

from training.dataset import (
    ShrekDataset,
    ByteTokenizer,
)

from training.evaluator import evaluate


# ============================================================
# SESSION SETTINGS
# ============================================================

SESSION_STEPS = 1_000

# Logging every step is unnecessary overhead.
LOG_INTERVAL = 5

TARGET_SECONDS_PER_STEP = 1.0


# ============================================================
# CUDA PERFORMANCE
# ============================================================

if torch.cuda.is_available():

    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True

    # Let cuDNN choose the fastest kernels when possible.
    torch.backends.cudnn.benchmark = True

    # High precision matmul mode for FP32 operations.
    torch.set_float32_matmul_precision("high")


class Trainer:

    def __init__(self):

        # ----------------------------------------------------
        # RANDOM SEED
        # ----------------------------------------------------

        torch.manual_seed(SEED)

        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(SEED)

        self.device = torch.device(DEVICE)

        # ----------------------------------------------------
        # TOKENIZER
        # ----------------------------------------------------

        self.tokenizer = ByteTokenizer()

        # ----------------------------------------------------
        # MODEL
        # ----------------------------------------------------

        self.model = ShrekAI(
            ModelConfig()
        ).to(self.device)

        # ----------------------------------------------------
        # OPTIMIZER
        # ----------------------------------------------------

        self.optimizer = self._create_optimizer()

        # ----------------------------------------------------
        # TRAINING STATE
        # ----------------------------------------------------

        self.step = 0
        self.best_loss = float("inf")

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

        self.dataset = ShrekDataset(
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
            loader_kwargs["pin_memory"] = True

        if NUM_WORKERS > 0:
            loader_kwargs["persistent_workers"] = True
            loader_kwargs["prefetch_factor"] = 2

        self.loader = DataLoader(
            **loader_kwargs
        )

        if len(self.loader) == 0:
            raise RuntimeError(
                "Training DataLoader contains 0 batches.\n"
                f"Dataset samples: {len(self.dataset)}\n"
                f"Batch size: {BATCH_SIZE}\n"
                "Add more training data or reduce the batch size."
            )

        self.iterator = iter(self.loader)

        # ----------------------------------------------------
        # OPTIONAL COMPILE
        # ----------------------------------------------------

        self.compiled = False

        if USE_COMPILE and hasattr(torch, "compile"):

            print(
                "[trainer] torch.compile enabled."
            )

            try:

                self.model = torch.compile(
                    self.model
                )

                self.compiled = True

                print(
                    "[trainer] torch.compile initialized."
                )

            except Exception as error:

                print(
                    "[trainer] torch.compile failed."
                )

                print(
                    f"[trainer] Reason: {error}"
                )

                print(
                    "[trainer] Continuing without compilation."
                )

        # ----------------------------------------------------
        # STARTUP
        # ----------------------------------------------------

        self._print_startup_info()

    # ========================================================
    # OPTIMIZER
    # ========================================================

    def _create_optimizer(self):

        decay = []
        no_decay = []

        for parameter in self.model.parameters():

            if not parameter.requires_grad:
                continue

            if parameter.ndim >= 2:
                decay.append(parameter)

            else:
                no_decay.append(parameter)

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

        # ----------------------------------------------------
        # FUSED ADAMW
        # ----------------------------------------------------

        if self.device.type == "cuda":

            try:

                print(
                    "[trainer] Using fused AdamW."
                )

                return torch.optim.AdamW(
                    parameter_groups,
                    fused=True,
                    **optimizer_kwargs,
                )

            except (TypeError, RuntimeError):

                print(
                    "[trainer] Fused AdamW unavailable."
                )

        # ----------------------------------------------------
        # STANDARD ADAMW
        # ----------------------------------------------------

        return torch.optim.AdamW(
            parameter_groups,
            **optimizer_kwargs,
        )

    # ========================================================
    # STARTUP INFORMATION
    # ========================================================

    def _print_startup_info(self):

        parameters = self.model.count_parameters()

        effective_batch = (
            BATCH_SIZE
            * GRADIENT_ACCUMULATION_STEPS
        )

        tokens_per_step = (
            effective_batch
            * MAX_SEQ_LEN
        )

        session_target = min(
            self.step + SESSION_STEPS,
            MAX_STEPS,
        )

        print()
        print("=" * 72)
        print("                      SHREKAI TRAINING")
        print("=" * 72)

        print(
            f"Device:                 {self.device}"
        )

        if self.device.type == "cuda":

            try:

                gpu_name = torch.cuda.get_device_name(
                    self.device
                )

                print(
                    f"GPU:                    {gpu_name}"
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
                    f"GPU VRAM:               "
                    f"{total_memory:.2f} GB"
                )

            except Exception:
                pass

        print(
            f"Model parameters:       "
            f"{parameters:,}"
        )

        print(
            f"Sequence length:        "
            f"{MAX_SEQ_LEN:,}"
        )

        print(
            f"Batch size:             "
            f"{BATCH_SIZE}"
        )

        print(
            f"Gradient accumulation:  "
            f"{GRADIENT_ACCUMULATION_STEPS}"
        )

        print(
            f"Effective batch size:   "
            f"{effective_batch}"
        )

        print(
            f"Tokens per optimizer:   "
            f"{tokens_per_step:,}"
        )

        print(
            f"Learning rate:          "
            f"{LEARNING_RATE:.2e}"
        )

        print(
            f"Lifetime maximum:       "
            f"{MAX_STEPS:,} steps"
        )

        print(
            f"Session length:         "
            f"{SESSION_STEPS:,} steps"
        )

        print(
            f"Session target:         "
            f"{self.step:,} -> {session_target:,}"
        )

        print(
            f"Dataset samples:        "
            f"{len(self.dataset):,}"
        )

        print(
            f"DataLoader batches:     "
            f"{len(self.loader):,}"
        )

        print(
            f"Checkpoint interval:    "
            f"{CHECKPOINT_INTERVAL:,}"
        )

        print(
            f"Validation interval:    "
            f"{VALIDATION_INTERVAL:,}"
        )

        print(
            f"AMP:                    "
            f"{self.use_amp}"
        )

        print(
            f"GradScaler:             "
            f"{self.use_grad_scaler}"
        )

        print(
            f"torch.compile:          "
            f"{self.compiled}"
        )

        print(
            f"Target speed:           "
            f"{TARGET_SECONDS_PER_STEP:.1f} sec/step"
        )

        print()
        print(
            "Training is starting..."
        )

        print(
            "The first step may take longer while "
            "PyTorch initializes."
        )

        print("=" * 72)
        print()

    # ========================================================
    # GPU MEMORY
    # ========================================================

    def _gpu_memory(self):

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
    # GET MODEL
    # ========================================================

    def _get_uncompiled_model(self):

        model = self.model

        if hasattr(model, "_orig_mod"):
            model = model._orig_mod

        return model

    # ========================================================
    # LEARNING RATE
    # ========================================================

    def learning_rate(self):

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
            self.step - WARMUP_STEPS
        ) / max(
            1,
            MAX_STEPS - WARMUP_STEPS,
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
                math.pi * progress
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
    # RNG STATE
    # ========================================================

    def _get_rng_state(self):

        state = {
            "torch": torch.get_rng_state(),
        }

        if torch.cuda.is_available():

            state["cuda"] = (
                torch.cuda.get_rng_state_all()
            )

        return state

    def _restore_rng_state(self, state):

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
                f"Could not restore RNG state: {error}"
            )

    # ========================================================
    # CHECKPOINT SAVE
    # ========================================================

    def save_checkpoint(self, path):

        model = self._get_uncompiled_model()

        state = {
            "model": model.state_dict(),
            "optimizer": self.optimizer.state_dict(),
            "step": self.step,
            "best_loss": self.best_loss,
            "config": model.config.__dict__,
            "scaler": self.scaler.state_dict(),
            "rng": self._get_rng_state(),
        }

        temporary = str(path) + ".tmp"

        torch.save(
            state,
            temporary,
        )

        os.replace(
            temporary,
            path,
        )

    # ========================================================
    # CHECKPOINT LOAD
    # ========================================================

    def load_checkpoint(self, path=None):

        path = path or LATEST_CHECKPOINT

        if not Path(path).exists():

            print(
                "[trainer] No checkpoint found."
            )

            return False

        print(
            f"[trainer] Loading checkpoint: {path}"
        )

        checkpoint = torch.load(
            path,
            map_location=self.device,
            weights_only=False,
        )

        model = self._get_uncompiled_model()

        model.load_state_dict(
            checkpoint["model"]
        )

        self.optimizer.load_state_dict(
            checkpoint["optimizer"]
        )

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

            except Exception:
                pass

        self._restore_rng_state(
            checkpoint.get("rng")
        )

        print(
            f"[trainer] Resuming from step "
            f"{self.step:,}."
        )

        return True

    # ========================================================
    # GET NEXT BATCH
    # ========================================================

    def _next_batch(self):

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

def train(self):

    if self.step >= MAX_STEPS:

        print()
        print(
            "[trainer] Lifetime maximum already reached."
        )

        return

    session_start_step = self.step

    session_target = min(
        self.step + SESSION_STEPS,
        MAX_STEPS,
    )

    self.model.train()

    training_start = time.perf_counter()

    total_tokens = 0

    last_loss = float("nan")

    last_gradient_norm = float("nan")

    # Cache GPU memory information.
    # We do not want to force a CUDA synchronization every step.
    last_gpu_memory = "VRAM not sampled"

    # --------------------------------------------------------
    # HEADER
    # --------------------------------------------------------

    print()
    print(
        ">>> SHREKAI IS NOW TRAINING <<<"
    )

    print(
        f">>> SESSION: "
        f"steps {self.step:,} -> "
        f"{session_target:,} <<<"
    )

    print()

    try:

        # ====================================================
        # MAIN LOOP
        # ====================================================

        while self.step < session_target:

            step_start = time.perf_counter()

            self.optimizer.zero_grad(
                set_to_none=True
            )

            # ------------------------------------------------
            # LOSS ACCUMULATES ON GPU
            # ------------------------------------------------

            accumulated_loss = torch.zeros(
                (),
                device=self.device,
                dtype=torch.float32,
            )

            microbatches_completed = 0

            step_tokens = 0

            # -----------------------------------------------
            # GRADIENT ACCUMULATION
            # -----------------------------------------------

            for _ in range(
                GRADIENT_ACCUMULATION_STEPS
            ):

                batch = self._next_batch()

                input_ids = batch[
                    "input_ids"
                ].to(
                    self.device,
                    non_blocking=(
                        self.device.type == "cuda"
                    ),
                )

                labels = batch[
                    "labels"
                ].to(
                    self.device,
                    non_blocking=(
                        self.device.type == "cuda"
                    ),
                )

                # -------------------------------------------
                # FORWARD
                # -------------------------------------------

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

                # -------------------------------------------
                # LOSS
                # -------------------------------------------

                # IMPORTANT:
                #
                # Do NOT call .item() here.
                #
                # Calling .item() 32 times per optimizer
                # step forces CUDA synchronization 32 times.
                #
                accumulated_loss.add_(
                    loss.detach().float()
                )

                scaled_loss = (
                    loss
                    / GRADIENT_ACCUMULATION_STEPS
                )

                # -------------------------------------------
                # BACKWARD
                # -------------------------------------------

                if self.use_grad_scaler:

                    self.scaler.scale(
                        scaled_loss
                    ).backward()

                else:

                    scaled_loss.backward()

                tokens = input_ids.numel()

                step_tokens += tokens
                total_tokens += tokens

                microbatches_completed += 1

            # -----------------------------------------------
            # UNSCALE
            # -----------------------------------------------

            if self.use_grad_scaler:

                self.scaler.unscale_(
                    self.optimizer
                )

            # -----------------------------------------------
            # GRADIENT CLIPPING
            # -----------------------------------------------

            gradient_norm = (
                torch.nn.utils.clip_grad_norm_(
                    self.model.parameters(),
                    GRAD_CLIP,
                )
            )

            # -----------------------------------------------
            # LEARNING RATE
            # -----------------------------------------------

            lr = self.learning_rate()

            for group in self.optimizer.param_groups:

                group["lr"] = lr

            # -----------------------------------------------
            # OPTIMIZER STEP
            # -----------------------------------------------

            if self.use_grad_scaler:

                self.scaler.step(
                    self.optimizer
                )

                self.scaler.update()

            else:

                self.optimizer.step()

            # -----------------------------------------------
            # ADVANCE STEP
            # -----------------------------------------------

            self.step += 1

            # -----------------------------------------------
            # TIMING
            # -----------------------------------------------

            now = time.perf_counter()

            step_elapsed = (
                now - step_start
            )

            total_elapsed = (
                now - training_start
            )

            # -----------------------------------------------
            # LOSS
            # -----------------------------------------------

            average_loss = (
                accumulated_loss
                / max(
                    1,
                    microbatches_completed,
                )
            ).item()

            last_loss = average_loss

            # -----------------------------------------------
            # TOKENS / SECOND
            # -----------------------------------------------

            step_tokens_per_second = (
                step_tokens
                / max(
                    step_elapsed,
                    1e-9,
                )
            )

            total_tokens_per_second = (
                total_tokens
                / max(
                    total_elapsed,
                    1e-9,
                )
            )

            # -----------------------------------------------
            # STEP / SECOND
            # -----------------------------------------------

            steps_per_second = (
                1.0
                / max(
                    step_elapsed,
                    1e-9,
                )
            )

            # -----------------------------------------------
            # TARGET STATUS
            # -----------------------------------------------

            if (
                step_elapsed
                <= TARGET_SECONDS_PER_STEP
            ):

                speed_status = "FAST"

            else:

                speed_status = "SLOW"

            # -----------------------------------------------
            # ETA
            # -----------------------------------------------

            remaining_steps = (
                session_target
                - self.step
            )

            eta_seconds = (
                remaining_steps
                * step_elapsed
            )

            eta_hours = int(
                eta_seconds // 3600
            )

            eta_minutes = int(
                (
                    eta_seconds
                    % 3600
                )
                // 60
            )

            eta_secs = int(
                eta_seconds % 60
            )

            # -----------------------------------------------
            # GRADIENT
            # -----------------------------------------------

            # One synchronization per optimizer step.
            last_gradient_norm = float(
                gradient_norm
            )

            # -----------------------------------------------
            # PROGRESS
            # -----------------------------------------------

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

            # -----------------------------------------------
            # GPU MEMORY
            # -----------------------------------------------

            # Sample memory every 10 steps instead of
            # forcing CUDA synchronization every step.
            if (
                self.step == 1
                or self.step % 10 == 0
            ):

                last_gpu_memory = (
                    self._gpu_memory()
                )

            # -----------------------------------------------
            # LOGGING
            # -----------------------------------------------

            # PRINT EVERY SINGLE OPTIMIZER STEP.
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

            # =================================================
            # VALIDATION
            # =================================================

            if (
                self.step
                % VALIDATION_INTERVAL
                == 0
            ):

                print()
                print(
                    f"[validation] Running at "
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
                    f"[validation] "
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

            # =================================================
            # PERIODIC CHECKPOINT
            # =================================================

            if (
                self.step
                % CHECKPOINT_INTERVAL
                == 0
            ):

                print()
                print(
                    f"[checkpoint] Saving step "
                    f"{self.step:,}..."
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
                    f"[checkpoint] Saved "
                    f"in "
                    f"{checkpoint_elapsed:.2f}s."
                )

    # ========================================================
    # EMERGENCY SAVE
    # ========================================================

    except KeyboardInterrupt:

        print()
        print("=" * 72)
        print(
            "[emergency] Training interrupted."
        )

        print(
            f"[emergency] Saving checkpoint "
            f"at completed step {self.step:,}..."
        )

        emergency_start = (
            time.perf_counter()
        )

        try:

            self.save_checkpoint(
                LATEST_CHECKPOINT
            )

            emergency_elapsed = (
                time.perf_counter()
                - emergency_start
            )

            print(
                f"[emergency] Checkpoint saved "
                f"in {emergency_elapsed:.2f}s."
            )

            print(
                f"[emergency] Resume from "
                f"step {self.step:,}."
            )

        except Exception as error:

            print(
                "[emergency] "
                "CRITICAL: checkpoint save failed!"
            )

            print(
                f"[emergency] Error: {error}"
            )

        print("=" * 72)
        print()

        return

    # ========================================================
    # SESSION COMPLETE
    # ========================================================

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

    # --------------------------------------------------------
    # FINAL CHECKPOINT
    # --------------------------------------------------------

    print()
    print(
        "[checkpoint] Saving session state..."
    )

    self.save_checkpoint(
        LATEST_CHECKPOINT
    )

    print(
        "[checkpoint] Session checkpoint saved."
    )

    # --------------------------------------------------------
    # FINAL MODEL
    # --------------------------------------------------------

    model = self._get_uncompiled_model()

    torch.save(
        model.state_dict(),
        FINAL_MODEL,
    )

    # ========================================================
    # SUMMARY
    # ========================================================

    print()
    print("=" * 72)
    print("                    SESSION FINISHED")
    print("=" * 72)

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
        f"Average steps/sec:      "
        f"{average_steps_per_second:.2f}"
    )

    print(
        f"Average tokens/sec:     "
        f"{average_tokens_per_second:,.0f}"
    )

    print(
        f"Target step time:       "
        f"{TARGET_SECONDS_PER_STEP:.2f} sec"
    )

    if (
        average_step_time
        <= TARGET_SECONDS_PER_STEP
    ):

        print(
            "Performance target:     ACHIEVED"
        )

    else:

        print(
            "Performance target:     "
            "HARDWARE LIMITED"
        )

    print(
        f"Total session time:     "
        f"{total_time / 3600:.2f} hours"
    )

    print(
        f"Latest checkpoint:      "
        f"{LATEST_CHECKPOINT}"
    )

    print(
        f"Final model:            "
        f"{FINAL_MODEL}"
    )

    print("=" * 72)
    print()