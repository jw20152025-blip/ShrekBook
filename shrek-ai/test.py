from model import generate


print()
print("================================")
print("SHREK AI TEST")
print("================================")
print("Model: Qwen/Qwen2.5-3B-Instruct")
print("AI ready! Type 'exit' to quit.")
print()


while True:

    try:

        prompt = input("You: ")

    except KeyboardInterrupt:

        print("\nExiting...")
        break

    except EOFError:

        print("\nExiting...")
        break


    if prompt.lower().strip() in [
        "exit",
        "quit"
    ]:

        print("Goodbye!")

        break


    if not prompt.strip():

        continue


    try:

        response = generate(prompt)

        print("AI:", response)
        print()

    except Exception as error:

        print()
        print("AI ERROR:")
        print(error)
        print()