import threading

import uvicorn

from config import (
    API_HOST,
    API_PORT,
)

from api.server import app
from training.worker import TrainingWorker


def main():

    print()
    print("=" * 60)
    print("             SHREKAI")
    print("=" * 60)
    print()

    trainer = TrainingWorker()

    trainer.start()

    print(
        f"[ShrekAI] API: "
        f"http://{API_HOST}:{API_PORT}"
    )

    try:

        uvicorn.run(
            app,
            host=API_HOST,
            port=API_PORT,
            log_level="info",
        )

    except KeyboardInterrupt:

        print(
            "[ShrekAI] Shutdown requested."
        )

    finally:

        trainer.stop()

        print(
            "[ShrekAI] Shutdown complete."
        )


if __name__ == "__main__":
    main()