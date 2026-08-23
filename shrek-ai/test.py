from model import generate

print()
print("================================")
print("SHREK AI TEST")
print("================================")
print("AI ready! Type 'exit' to quit.")
print()

while True:

    try:
        prompt = input("You: ")

    except KeyboardInterrupt:
        print("\nExiting...")
        break

    if prompt.lower().strip() in ["exit", "quit"]:
        break

    response = generate(prompt)

    print("AI:", response)
    print()