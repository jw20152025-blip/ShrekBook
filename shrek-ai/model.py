import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

print("================================")
print("SHREK AI - QWEN MODEL")
print("================================")

MODEL_NAME = "Qwen/Qwen2.5-3B-Instruct"

print("Loading tokenizer...")

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_NAME
)

print("Loading model...")

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    torch_dtype=torch.float32
)

model.eval()

print("================================")
print("SHREK AI MODEL LOADED")
print("================================")


def generate(prompt):

    if not prompt or not prompt.strip():
        return "Please say something."

    prompt = prompt.strip()

    messages = [
        {
            "role": "system",
            "content": (
                "You are Shrek AI, a helpful and friendly general-purpose "
                "AI assistant. Answer questions naturally and accurately. "
                "Be polite and conversational. "
                "Do not repeat yourself. "
                "Do not invent facts. "
                "Never threaten the user. "
                "Never claim that you want to hurt or kill someone. "
                "Keep responses reasonably concise."
            )
        },
        {
            "role": "user",
            "content": prompt
        }
    ]

    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=2048
    )

    with torch.no_grad():

        output = model.generate(
            **inputs,

            max_new_tokens=80,

            do_sample=True,

            temperature=0.7,

            top_p=0.9,

            repetition_penalty=1.1,

            no_repeat_ngram_size=3,

            eos_token_id=tokenizer.eos_token_id,

            pad_token_id=tokenizer.eos_token_id
        )

    generated_tokens = output[
        0,
        inputs["input_ids"].shape[1]:
    ]

    response = tokenizer.decode(
        generated_tokens,
        skip_special_tokens=True
    )

    return response.strip()