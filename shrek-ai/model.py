from transformers import AutoTokenizer, AutoModelForSeq2SeqLM


MODEL_NAME = "sshleifer/distilbart-cnn-12-6"


print("Loading AI model...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

model = AutoModelForSeq2SeqLM.from_pretrained(
    MODEL_NAME
)

print("AI model loaded!")


def summarize(text):

    if not text:
        return "No text provided."

    text = str(text).strip()

    if len(text) > 4000:
        text = text[:4000]

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=1024
    )

    output = model.generate(
        **inputs,
        max_length=120,
        min_length=30,
        num_beams=4,
        early_stopping=True
    )

    result = tokenizer.decode(
        output[0],
        skip_special_tokens=True
    )

    return result.strip()