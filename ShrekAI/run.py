# run.py

import sys

from config import (
    DEVICE,
    D_MODEL,
    N_LAYERS,
    N_HEADS,
    MAX_SEQ_LEN,
)

from core.model import (
    ShrekAI,
    ModelConfig,
)

from core.inference import (
    ShrekInference,
)


def show_info():

    model = ShrekAI(
        ModelConfig()
    )

    parameters = (
        model.count_parameters()
    )

    print()
    print("================================")
    print("           SHREKAI")
    print("================================")
    print(
        f"Parameters : "
        f"{parameters:,}"
    )
    print(
        f"Layers     : {N_LAYERS}"
    )
    print(
        f"Dimension  : {D_MODEL}"
    )
    print(
        f"Heads      : {N_HEADS}"
    )
    print(
        f"Context    : {MAX_SEQ_LEN}"
    )
    print(
        f"Device     : {DEVICE}"
    )
    print("================================")
    print()


def chat():

    ai = ShrekInference()

    messages = []

    print()
    print("================================")
    print("       SHREKAI CHAT")
    print("================================")
    print("Type /exit to quit.")
    print("Type /clear to clear context.")
    print()

    while True:

        try:

            user = input("You: ")

        except (
            KeyboardInterrupt,
            EOFError,
        ):

            print()
            break

        user = user.strip()

        if not user:
            continue

        if user.lower() == "/exit":
            break

        if user.lower() == "/clear":

            messages.clear()

            print(
                "Conversation cleared."
            )

            continue

        messages.append(
            {
                "role": "user",
                "content": user,
            }
        )

        try:

            response = ai.generate(
                messages
            )

        except Exception as error:

            print(
                f"\n[ERROR] {error}\n"
            )

            messages.pop()

            continue

        print(
            f"\nShrekAI: {response}\n"
        )

        messages.append(
            {
                "role": "assistant",
                "content": response,
            }
        )


def main():

    while True:

        print()
        print("================================")
        print("            SHREKAI")
        print("================================")
        print("1. Chat")
        print("2. Train")
        print("3. Model information")
        print("4. API server")
        print("5. Exit")
        print("================================")

        choice = input(
            "Select: "
        ).strip()

        if choice == "1":

            chat()

        elif choice == "2":

            from training.worker import train

            train()

        elif choice == "3":

            show_info()

        elif choice == "4":

            from api.server import (
                start_server,
            )

            start_server()

        elif choice == "5":

            break

        else:

            print(
                "Invalid selection."
            )


if __name__ == "__main__":
    main()