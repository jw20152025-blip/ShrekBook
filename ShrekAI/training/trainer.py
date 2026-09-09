# training/trainer.py

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


class Trainer:

    def __init__(self):

        torch.manual_seed(SEED)

        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(SEED)

        self.device = torch.device(DEVICE)

        self.tokenizer = ByteTokenizer()

        self.model = ShrekAI(
            ModelConfig()
        ).to(self.device)

        self.optimizer = self._create_optimizer()

        self.step = 0
        self.best_loss = float("inf")

        self.scaler = (
            torch.amp.GradScaler(
                "cuda",
                enabled=(
                    self.device.type == "cuda"
                    and DTYPE == torch.float16
                ),
            )
        )

        self.dataset = ShrekDataset(
            tokenizer=self.tokenizer,
            max_seq_len=MAX_SEQ_LEN,
        )

        self.loader = DataLoader(
            self.dataset,
            batch_size=BATCH_SIZE,
            shuffle=True,
            num_workers=NUM_WORKERS,
            pin_memory=(
                self.device.type == "cuda"
            ),
            drop_last=True,
        )

        self.iterator = iter(self.loader)

        if USE_COMPILE and hasattr(
            torch,
            "compile",
        ):

            try:
                self.model = torch.compile(
                    self.model
                )
            except Exception:
                pass

    def _create_optimizer(self):

        decay = []
        no_decay = []

        for name, parameter in self.model.named_parameters():

            if not parameter.requires_grad:
                continue

            if parameter.ndim >= 2:
                decay.append(parameter)
            else:
                no_decay.append(parameter)

        return torch.optim.AdamW(
            [
                {
                    "params": decay,
                    "weight_decay": WEIGHT_DECAY,
                },
                {
                    "params": no_decay,
                    "weight_decay": 0.0,
                },
            ],
            lr=LEARNING_RATE,
            betas=BETAS,
            fused=(
                self.device.type == "cuda"
            ),
        )

    def learning_rate(self):

        if self.step < WARMUP_STEPS:

            return LEARNING_RATE * (
                self.step + 1
            ) / max(
                1,
                WARMUP_STEPS,
            )

        progress = (
            self.step - WARMUP_STEPS
        ) / max(
            1,
            MAX_STEPS - WARMUP_STEPS,
        )

        progress = min(
            1.0,
            max(0.0, progress),
        )

        cosine = (
            0.5
            * (
                1.0
                + math.cos(
                    math.pi * progress
                )
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

    def save_checkpoint(self, path):

        model = self.model

        if hasattr(
            model,
            "_orig_mod",
        ):
            model = model._orig_mod

        state = {
            "model": model.state_dict(),
            "optimizer": self.optimizer.state_dict(),
            "step": self.step,
            "best_loss": self.best_loss,
            "config": model.config.__dict__,
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

    def load_checkpoint(self, path=None):

        path = path or LATEST_CHECKPOINT

        if not Path(path).exists():
            return False

        checkpoint = torch.load(
            path,
            map_location=self.device,
            weights_only=False,
        )

        model = self.model

        if hasattr(
            model,
            "_orig_mod",
        ):
            model = model._orig_mod

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

        return True

    def train(self):

        self.model.train()

        start_time = time.time()
        tokens_since_log = 0
        log_time = start_time

        while self.step < MAX_STEPS:

            self.optimizer.zero_grad(
                set_to_none=True
            )

            accumulated_loss = 0.0

            for _ in range(
                GRADIENT_ACCUMULATION_STEPS
            ):

                try:
                    batch = next(
                        self.iterator
                    )

                except StopIteration:

                    self.iterator = iter(
                        self.loader
                    )

                    batch = next(
                        self.iterator
                    )

                input_ids = batch[
                    "input_ids"
                ].to(
                    self.device,
                    non_blocking=True,
                )

                labels = batch[
                    "labels"
                ].to(
                    self.device,
                    non_blocking=True,
                )

                if self.device.type == "cuda":

                    autocast_dtype = DTYPE

                    with torch.autocast(
                        device_type="cuda",
                        dtype=autocast_dtype,
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

                loss = (
                    loss
                    / GRADIENT_ACCUMULATION_STEPS
                )

                accumulated_loss += loss.item()

                if self.scaler.is_enabled():

                    self.scaler.scale(
                        loss
                    ).backward()

                else:

                    loss.backward()

                tokens_since_log += (
                    input_ids.numel()
                )

            if self.scaler.is_enabled():

                self.scaler.unscale_(
                    self.optimizer
                )

            torch.nn.utils.clip_grad_norm_(
                self.model.parameters(),
                GRAD_CLIP,
            )

            lr = self.learning_rate()

            for group in self.optimizer.param_groups:
                group["lr"] = lr

            if self.scaler.is_enabled():

                self.scaler.step(
                    self.optimizer
                )

                self.scaler.update()

            else:

                self.optimizer.step()

            self.step += 1

            if self.step % 20 == 0:

                now = time.time()

                elapsed = (
                    now - log_time
                )

                tokens_per_second = (
                    tokens_since_log
                    / max(elapsed, 1e-6)
                )

                print(
                    f"step={self.step:,} "
                    f"loss={accumulated_loss:.4f} "
                    f"lr={lr:.2e} "
                    f"tokens/s={tokens_per_second:,.0f}"
                )

                tokens_since_log = 0
                log_time = now

            if (
                self.step
                % VALIDATION_INTERVAL
                == 0
            ):

                results = evaluate(
                    self.model,
                    self.tokenizer,
                )

                print(
                    f"[validation] "
                    f"loss={results['loss']:.4f} "
                    f"perplexity="
                    f"{results['perplexity']:.2f}"
                )

                if (
                    results["loss"]
                    < self.best_loss
                ):

                    self.best_loss = (
                        results["loss"]
                    )

                    self.save_checkpoint(
                        BEST_CHECKPOINT
                    )

                self.model.train()

            if (
                self.step
                % CHECKPOINT_INTERVAL
                == 0
            ):

                self.save_checkpoint(
                    LATEST_CHECKPOINT
                )

        self.save_checkpoint(
            LATEST_CHECKPOINT
        )

        model = self.model

        if hasattr(
            model,
            "_orig_mod",
        ):
            model = model._orig_mod

        torch.save(
            model.state_dict(),
            FINAL_MODEL,
        )

        total_time = (
            time.time()
            - start_time
        )

        print(
            f"Training finished in "
            f"{total_time / 3600:.2f} hours."
        )