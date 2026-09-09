from pathlib import Path

from datasets import load_dataset

from config import DATASET_DIR


DATASET_FILES = [
    "personality.jsonl",
    "reasoning.jsonl",
    "coding.jsonl",
    "conversations.jsonl",
]


def load_training_dataset():

    files = []

    for filename in DATASET_FILES:

        path = DATASET_DIR / filename

        if path.exists():
            files.append(str(path))

    if not files:
        raise RuntimeError(
            "No training datasets found."
        )

    dataset = load_dataset(
        "json",
        data_files=files,
        split="train",
    )

    dataset = dataset.shuffle(
        seed=42
    )

    print(
        f"[ShrekAI] Loaded {len(dataset)} training examples."
    )

    return dataset