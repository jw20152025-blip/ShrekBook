# training/worker.py

from training.trainer import Trainer


def train():

    trainer = Trainer()

    trainer.load_checkpoint()

    trainer.train()


if __name__ == "__main__":
    train()