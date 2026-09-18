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

from core.model import (
    ShrekAI,
    ModelConfig,
)

from training.dataset import (
    ByteTokenizer,
)


# ============================================================
# SHREKAI INFERENCE
# ============================================================

class ShrekInference:

    def __init__(
        self,
        checkpoint=None,
    ):

        # ----------------------------------------------------
        # DEVICE
        # ----------------------------------------------------

        self.device = torch.device(
            DEVICE
        )

        # ----------------------------------------------------
        # TOKENIZER
        # ----------------------------------------------------

        self.tokenizer = (
            ByteTokenizer()
        )

        # ----------------------------------------------------
        # MODEL
        # ----------------------------------------------------

        self.model = ShrekAI(
            ModelConfig()
        )

        # ----------------------------------------------------
        # CHECKPOINT
        # ----------------------------------------------------

        checkpoint = (
            checkpoint
            or (
                FINAL_MODEL
                if FINAL_MODEL.exists()
                else LATEST_CHECKPOINT
            )
        )

        checkpoint = Path(
            checkpoint
        )

        if not checkpoint.exists():

            raise FileNotFoundError(
                "ShrekAI checkpoint not found:\n"
                f"{checkpoint}"
            )

        print(
            "[inference] Loading checkpoint: "
            f"{checkpoint}"
        )

        data = torch.load(
            checkpoint,
            map_location="cpu",
            weights_only=False,
        )

        state = data.get(
            "model",
            data,
        )

        # ----------------------------------------------------
        # NORMAL NEW CHECKPOINT
        # ----------------------------------------------------

        current_vocab = (
            self.model.config.vocab_size
        )

        model_vocab = (
            state[
                "token_embedding.weight"
            ].shape[0]
        )

        if model_vocab == current_vocab:

            self.model.load_state_dict(
                state,
                strict=True,
            )

        # ----------------------------------------------------
        # OLD 263-TOKEN CHECKPOINT
        # ----------------------------------------------------

        elif (
            model_vocab
            < current_vocab
        ):

            print(
                "[inference] Legacy vocabulary detected:"
                f" {model_vocab} tokens."
            )

            print(
                "[inference] Expanding checkpoint "
                f"to {current_vocab} tokens."
            )

            self.model.load_legacy_state_dict(
                state
            )

            print(
                "[inference] Legacy model migrated "
                "in memory."
            )

        else:

            raise RuntimeError(
                "Checkpoint vocabulary is larger than "
                "the current model vocabulary.\n"
                f"Checkpoint: {model_vocab}\n"
                f"Current: {current_vocab}"
            )

        # ----------------------------------------------------
        # DEVICE / DTYPE
        # ----------------------------------------------------

        self.model.to(
            self.device
        )

        if self.device.type == "cuda":

            self.model.to(
                dtype=DTYPE
            )

        self.model.eval()

        print(
            "[inference] ShrekAI loaded."
        )

    # ========================================================
    # PROMPT BUILDER
    # ========================================================

    def build_prompt(
        self,
        messages,
    ):

        parts = [

            "<|system|>",

            SYSTEM_PROMPT,

            "<|end|>",

        ]

        for message in messages:

            role = message[
                "role"
            ]

            content = message[
                "content"
            ]

            parts.extend(
                [
                    f"<|{role}|>",
                    content,
                    "<|end|>",
                ]
            )

        parts.append(
            "<|assistant|>"
        )

        return "\n".join(
            parts
        )

    # ========================================================
    # GENERATE
    # ========================================================

    @torch.inference_mode()
    def generate(
        self,
        messages,
        max_new_tokens=MAX_NEW_TOKENS,
        temperature=TEMPERATURE,
        top_p=TOP_P,
    ):

        prompt = self.build_prompt(
            messages
        )

        ids = self.tokenizer.encode(
            prompt,
            add_special_tokens=False,
        )

        original_length = len(
            ids
        )

        max_seq_len = (
            self.model.config.max_seq_len
        )

        max_new_tokens = min(
            max_new_tokens,
            max_seq_len - 1,
        )

        max_prompt_tokens = (
            max_seq_len
            - max_new_tokens
        )

        if max_prompt_tokens <= 0:

            raise ValueError(
                "max_new_tokens is too large "
                "for the model context."
            )

        if len(ids) > max_prompt_tokens:

            print(
                "[inference] Prompt too long: "
                f"{len(ids)} tokens"
            )

            print(
                "[inference] Reserving "
                f"{max_new_tokens} tokens "
                "for generation."
            )

            print(
                "[inference] Truncating prompt "
                f"to {max_prompt_tokens} tokens."
            )

            ids = ids[
                -max_prompt_tokens:
            ]

        input_length = len(
            ids
        )

        print(
            "[inference] Prompt tokens: "
            f"{original_length}"
        )

        print(
            "[inference] Context tokens: "
            f"{input_length}"
        )

        print(
            "[inference] Generating up to "
            f"{max_new_tokens} tokens..."
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
            repetition_penalty=(
                REPETITION_PENALTY
            ),
        )

        output_tokens = (
            output[0].tolist()
        )

        generated_tokens = (
            output_tokens[
                input_length:
            ]
        )

        print(
            "[inference] Output tokens: "
            f"{len(generated_tokens)}"
        )

        print(
            "[inference] Raw tokens: "
            f"{generated_tokens[:30]}"
        )

        response = self.tokenizer.decode(
            generated_tokens,
            skip_special_tokens=True,
        ).strip()

        print(
            "[inference] Response length: "
            f"{len(response)}"
        )

        if not response:

            raw_response = (
                self.tokenizer.decode(
                    generated_tokens,
                    skip_special_tokens=False,
                )
            )

            print(
                "[inference] WARNING: "
                "EMPTY RESPONSE"
            )

            print(
                "[inference] Raw decoded output: "
                f"{raw_response!r}"
            )

        return response