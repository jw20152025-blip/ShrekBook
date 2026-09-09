import json
import threading
import time
from pathlib import Path

from config import (
    DATASET_DIR,
    TRAINING_CHECK_INTERVAL,
    TRAINING_MIN_NEW_EXAMPLES,
)

from training.trainer import train


QUEUE_FILE = DATASET_DIR / "training_queue.json"


class TrainingWorker:

    def __init__(self):

        self.running = False

        self.thread = None

    def count_examples(self):

        total = 0

        for path in DATASET_DIR.glob(
            "*.jsonl"
        ):

            try:

                with path.open(
                    "r",
                    encoding="utf-8",
                ) as file:

                    total += sum(
                        1
                        for line in file
                        if line.strip()
                    )

            except OSError:
                continue

        return total

    def get_last_count(self):

        if not QUEUE_FILE.exists():
            return 0

        try:

            with QUEUE_FILE.open(
                "r",
                encoding="utf-8",
            ) as file:

                data = json.load(file)

            return int(
                data.get(
                    "last_training_count",
                    0,
                )
            )

        except Exception:
            return 0

    def save_count(self, count):

        QUEUE_FILE.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with QUEUE_FILE.open(
            "w",
            encoding="utf-8",
        ) as file:

            json.dump(
                {
                    "last_training_count": count
                },
                file,
                indent=2,
            )

    def should_train(self):

        current = self.count_examples()

        previous = self.get_last_count()

        new_examples = current - previous

        print(
            f"[Trainer] Dataset: {current} | "
            f"Since last training: {new_examples}"
        )

        return (
            new_examples
            >= TRAINING_MIN_NEW_EXAMPLES
        )

    def training_loop(self):

        print(
            "[Trainer] Background trainer started."
        )

        while self.running:

            try:

                if self.should_train():

                    print(
                        "[Trainer] Starting automatic training."
                    )

                    train()

                    current = (
                        self.count_examples()
                    )

                    self.save_count(
                        current
                    )

            except Exception as error:

                print(
                    f"[Trainer] ERROR: {error}"
                )

            time.sleep(
                TRAINING_CHECK_INTERVAL
            )

        print(
            "[Trainer] Background trainer stopped."
        )

    def start(self):

        if self.running:
            return

        self.running = True

        self.thread = threading.Thread(
            target=self.training_loop,
            daemon=True,
        )

        self.thread.start()

    def stop(self):

        self.running = False

        if self.thread:
            self.thread.join(
                timeout=5
            )