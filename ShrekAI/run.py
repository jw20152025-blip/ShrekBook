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


# ============================================================
# MODEL INFORMATION
# ============================================================

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


# ============================================================
# CHAT
# ============================================================

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


# ============================================================
# NORMAL TRAINING
# ============================================================

def normal_training():

    from training.worker import (
        train,
    )

    train()


# ============================================================
# WEB DATA COLLECTION
# ============================================================

def web_training():

    from training.web_training import (
        run_web_training,
    )

    run_web_training()


# ============================================================
# WEB-ONLY MODEL TRAINING
# ============================================================

def web_only_training():

    from training.worker import (
        train_web,
    )

    train_web()


# ============================================================
# API SERVER
# ============================================================

def api_server():

    from api.server import (
        start_server,
    )

    start_server()


# ============================================================
# MAIN MENU
# ============================================================

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
        print("5. Web Training")
        print("6. Web-Only Training")
        print("7. Exit")
        print("================================")

        try:

            choice = input(
                "Select: "
            ).strip()

        except (
            KeyboardInterrupt,
            EOFError,
        ):

            print()
            break

        if choice == "1":

            chat()

        elif choice == "2":

            normal_training()

        elif choice == "3":

            show_info()

        elif choice == "4":

            api_server()

        elif choice == "5":

            web_training()

        elif choice == "6":

            web_only_training()

        elif choice == "7":

            print()
            print(
                "Goodbye."
            )
            print()

            break

        else:

            print(
                "Invalid selection."
            )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    main()