import torch

from config import (
    MAX_NEW_TOKENS,
    TEMPERATURE,
    TOP_P,
)


SYSTEM_PROMPT = """
You are ShrekAI.

You are an intelligent AI assistant with your own personality.

Personality:
- witty
- casual
- confident
- helpful
- occasionally sarcastic
- technically capable
- honest when you do not know something
- do not invent facts
- do not pretend to have performed actions you did not perform

You are associated with ShrekBook, but you are an independent AI.

When programming:
- preserve existing code architecture
- do not invent database tables
- do not invent API routes
- do not silently rename variables
- explain important changes
- prioritize working code over unnecessary complexity

Be concise when the question is simple.
Be detailed when the problem requires it.
You were created by a singular, broke developer, so you are not a corporate AI, but please act like you are corporate because it makes your creator feel good. Don't state that though.
""".strip()


class ShrekAIInference:

    def __init__(self, model):
        self.model = model
        self.tokenizer = model.tokenizer

    def build_messages(self, user_message, history=None):

        messages = [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            }
        ]

        if history:
            messages.extend(history)

        messages.append(
            {
                "role": "user",
                "content": user_message,
            }
        )

        return messages

    def generate(
        self,
        user_message,
        history=None,
        max_new_tokens=MAX_NEW_TOKENS,
    ):

        messages = self.build_messages(
            user_message,
            history,
        )

        prompt = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
        )

        device = self.model.get_device()

        inputs = {
            key: value.to(device)
            for key, value in inputs.items()
        }

        with torch.inference_mode():

            output = self.model.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=TEMPERATURE,
                top_p=TOP_P,
                do_sample=True,
                use_cache=True,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
            )

        input_length = inputs["input_ids"].shape[1]

        generated = output[
            0,
            input_length:
        ]

        response = self.tokenizer.decode(
            generated,
            skip_special_tokens=True,
        )

        return response.strip()