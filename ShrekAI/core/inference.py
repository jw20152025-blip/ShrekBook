# core/inference.py

from pathlib import Path

import torch

from config import (
    DEVICE,
    DTYPE,
    MAX_NEW_TOKENS,
    TEMPERATURE,
    TOP_P,
    REPETITION_PENALTY,
    FINAL_MODEL,
    LATEST_CHECKPOINT,
    SYSTEM_PROMPT,
)

from core.model import ShrekAI, ModelConfig
from training.dataset import ByteTokenizer


class ShrekInference:

    def __init__(self, checkpoint=None):

        self.device = torch.device(DEVICE)

        self.tokenizer = ByteTokenizer()

        self.model = ShrekAI(ModelConfig())

        checkpoint = checkpoint or (
            FINAL_MODEL
            if FINAL_MODEL.exists()
            else LATEST_CHECKPOINT
        )

        if Path(checkpoint).exists():

            data = torch.load(
                checkpoint,
                map_location="cpu",
                weights_only=False,
            )

            state = data.get(
                "model",
                data,
            )

            self.model.load_state_dict(
                state,
                strict=True,
            )

        self.model.to(self.device)

        if self.device.type == "cuda":
            self.model.to(dtype=DTYPE)

        self.model.eval()

    def build_prompt(self, messages):

        parts = [
            "<|system|>",
            SYSTEM_PROMPT,
            "<|end|>",
        ]

        for message in messages:

            role = message["role"]
            content = message["content"]

            parts.extend(
                [
                    f"<|{role}|>",
                    content,
                    "<|end|>",
                ]
            )

        parts.append("<|assistant|>")

        return "\n".join(parts)

    @torch.inference_mode()
    def generate(
        self,
        messages,
        max_new_tokens=MAX_NEW_TOKENS,
        temperature=TEMPERATURE,
        top_p=TOP_P,
    ):

        prompt = self.build_prompt(messages)

        ids = self.tokenizer.encode(
            prompt,
            add_special_tokens=True,
        )

        input_ids = torch.tensor(
            [ids],
            dtype=torch.long,
            device=self.device,
        )

        output = self.model.generate(
            input_ids,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
            repetition_penalty=REPETITION_PENALTY,
        )

        generated = output[0].tolist()

        generated = generated[len(ids):]

        return self.tokenizer.decode(
            generated,
            skip_special_tokens=True,
        ).strip()