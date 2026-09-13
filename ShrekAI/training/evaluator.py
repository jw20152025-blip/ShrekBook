import math

import torch
from torch.utils.data import DataLoader

from config import (
    DEVICE,
    BATCH_SIZE,
    MAX_SEQ_LEN,
    NUM_WORKERS,
)

from training.dataset import (
    EvaluationDataset,
)


@torch.no_grad()
def evaluate(
    model,
    tokenizer=None,
    max_batches=50,
):

    dataset = EvaluationDataset(
        tokenizer=tokenizer,
        max_seq_len=MAX_SEQ_LEN,
    )

    # ========================================================
    # EMPTY EVALUATION DATASET
    # ========================================================

    if len(dataset) == 0:

        print(
            "[validation] WARNING: evaluation dataset "
            "contains fewer than 2 usable tokens."
        )

        print(
            "[validation] Skipping validation."
        )

        return {
            "loss": float("inf"),
            "perplexity": float("inf"),
        }

    # ========================================================
    # DATA LOADER
    # ========================================================

    loader = DataLoader(
        dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=DEVICE == "cuda",
    )

    model.eval()

    total_loss = 0.0
    batches = 0

    # ========================================================
    # EVALUATION
    # ========================================================

    for batch in loader:

        input_ids = batch[
            "input_ids"
        ].to(
            DEVICE,
            non_blocking=True,
        )

        labels = batch[
            "labels"
        ].to(
            DEVICE,
            non_blocking=True,
        )

        _, loss = model(
            input_ids,
            labels,
        )

        total_loss += loss.item()

        batches += 1

        if batches >= max_batches:
            break

    # ========================================================
    # NO BATCHES
    # ========================================================

    if batches == 0:

        return {
            "loss": float("inf"),
            "perplexity": float("inf"),
        }

    # ========================================================
    # RESULTS
    # ========================================================

    loss = (
        total_loss
        / batches
    )

    try:

        perplexity = math.exp(
            loss
        )

    except OverflowError:

        perplexity = float("inf")

    return {
        "loss": loss,
        "perplexity": perplexity,
    }
