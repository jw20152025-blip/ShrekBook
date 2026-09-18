from training.trainer import Trainer


# ============================================================
# NORMAL TRAINING
# ============================================================

def train():

    print()
    print("=" * 72)
    print("                 NORMAL TRAINING")
    print("=" * 72)
    print()
    print(
        "Training using all configured training datasets."
    )
    print()

    trainer = Trainer(
        training_mode="normal"
    )

    # Automatically resume from the latest checkpoint.
    trainer.load_checkpoint()

    trainer.train()


# ============================================================
# WEB-ONLY TRAINING
# ============================================================

def train_web():

    print()
    print("=" * 72)
    print("                WEB-ONLY TRAINING")
    print("=" * 72)
    print()
    print(
        "Training ONLY from datasets/web.jsonl."
    )
    print()
    print(
        "Normal datasets will NOT be used for this session."
    )
    print()

    trainer = Trainer(
        training_mode="web"
    )

    # Automatically resume from the latest checkpoint.
    trainer.load_checkpoint()

    trainer.train()


# ============================================================
# STANDALONE ENTRY POINT
# ============================================================

if __name__ == "__main__":

    print()
    print("=" * 72)
    print("                     SHREKAI")
    print("=" * 72)
    print()
    print("1. Normal Training")
    print("2. Web-Only Training")
    print()

    try:

        choice = input(
            "Select: "
        ).strip()

    except (
        KeyboardInterrupt,
        EOFError,
    ):

        print()
        raise SystemExit

    if choice == "1":

        train()

    elif choice == "2":

        train_web()

    else:

        print(
            "Invalid selection."
        )