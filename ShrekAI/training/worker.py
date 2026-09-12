# training/worker.py


from training.trainer import Trainer


def train():

    trainer = Trainer()

    # Automatically resume from the latest checkpoint.
    trainer.load_checkpoint()

    trainer.train()


if __name__ == "__main__":

    train()