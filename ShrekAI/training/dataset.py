
import json
import re
from pathlib import Path

import torch
from torch.utils.data import Dataset

from config import (
    DATASET_DIR,
    MAX_SEQ_LEN,
    TRAINING_FILES,
    EVALUATION_FILE,
)


# ============================================================
# SPECIAL TOKENS
# ============================================================

SPECIAL_TOKENS = {
    "<|pad|>": 256,
    "<|eos|>": 257,
    "<|system|>": 258,
    "<|user|>": 259,
    "<|assistant|>": 260,
    "<|tool|>": 261,
    "<|end|>": 262,
}


SPECIAL_TOKEN_PATTERN = re.compile(
    r"<\|(pad|eos|system|user|assistant|tool|end)\|>"
)


# ============================================================
# BYTE TOKENIZER
# ============================================================

class ByteTokenizer:

    def __init__(self):

        self.special_tokens = SPECIAL_TOKENS

        self.id_to_special = {
            value: key
            for key, value in SPECIAL_TOKENS.items()
        }

    # ========================================================
    # ENCODE
    # ========================================================

    def encode(
        self,
        text,
        add_special_tokens=True,
    ):

        result = []

        position = 0

        for match in SPECIAL_TOKEN_PATTERN.finditer(text):

            normal = text[
                position:match.start()
            ]

            result.extend(
                list(
                    normal.encode("utf-8")
                )
            )

            token = match.group(0)

            token_id = self.special_tokens.get(
                token
            )

            if token_id is not None:

                result.append(
                    token_id
                )

            else:

                result.extend(
                    list(
                        token.encode("utf-8")
                    )
                )

            position = match.end()

        result.extend(
            list(
                text[position:].encode("utf-8")
            )
        )

        if add_special_tokens:

            result.append(
                self.special_tokens["<|eos|>"]
            )

        return result

    # ========================================================
    # DECODE
    # ========================================================

    def decode(
        self,
        ids,
        skip_special_tokens=True,
    ):

        output = bytearray()

        for token_id in ids:

            if token_id in self.id_to_special:

                if skip_special_tokens:
                    continue

                output.extend(
                    self.id_to_special[
                        token_id
                    ].encode("utf-8")
                )

            elif 0 <= token_id <= 255:

                output.append(
                    token_id
                )

        return output.decode(
            "utf-8",
            errors="ignore",
        )


# ============================================================
# NORMALIZE RECORD
# ============================================================

def normalize_record(record):

    if isinstance(record, str):

        return record

    # --------------------------------------------------------
    # TEXT
    # --------------------------------------------------------

    if "text" in record:

        return str(
            record["text"]
        )

    # --------------------------------------------------------
    # CONTENT
    # --------------------------------------------------------

    if "content" in record:

        return str(
            record["content"]
        )

    # --------------------------------------------------------
    # PROMPT / RESPONSE
    # --------------------------------------------------------

    if (
        "prompt" in record
        and "response" in record
    ):

        return (
            "<|user|>\n"
            + str(record["prompt"])
            + "\n<|end|>\n"
            "<|assistant|>\n"
            + str(record["response"])
            + "\n<|end|>"
        )

    # --------------------------------------------------------
    # INSTRUCTION
    # --------------------------------------------------------

    if "instruction" in record:

        instruction = str(
            record["instruction"]
        )

        input_text = str(
            record.get(
                "input",
                "",
            )
        )

        output = str(
            record.get(
                "output",
                record.get(
                    "response",
                    "",
                ),
            )
        )

        user_text = instruction

        if input_text.strip():

            user_text += (
                "\n"
                + input_text
            )

        return (
            "<|user|>\n"
            + user_text
            + "\n<|end|>\n"
            "<|assistant|>\n"
            + output
            + "\n<|end|>"
        )

    # --------------------------------------------------------
    # MESSAGES
    # --------------------------------------------------------

    if "messages" in record:

        parts = []

        for message in record["messages"]:

            role = str(
                message.get(
                    "role",
                    "user",
                )
            )

            content = str(
                message.get(
                    "content",
                    "",
                )
            )

            if role not in (
                "system",
                "user",
                "assistant",
                "tool",
            ):

                role = "user"

            parts.extend(
                [
                    f"<|{role}|>",
                    content,
                    "<|end|>",
                ]
            )

        return "\n".join(parts)

    # --------------------------------------------------------
    # FALLBACK
    # --------------------------------------------------------

    values = []

    for key, value in record.items():

        values.append(
            f"{key}: {value}"
        )

    return "\n".join(values)


# ============================================================
# LOAD JSONL
# ============================================================

def load_jsonl(path):

    records = []

    if not Path(path).exists():

        return records

    with open(
        path,
        "r",
        encoding="utf-8",
    ) as file:

        for line in file:

            line = line.strip()

            if not line:

                continue

            try:

                record = json.loads(
                    line
                )

                text = normalize_record(
                    record
                )

                if text.strip():

                    records.append(
                        text
                    )

            except json.JSONDecodeError:

                records.append(
                    line
                )

    return records


# ============================================================
# SHREK DATASET
# ============================================================

class ShrekDataset(Dataset):

    def __init__(
        self,
        files=None,
        tokenizer=None,
        max_seq_len=MAX_SEQ_LEN,
        allow_empty=False,
    ):

        self.tokenizer = (
            tokenizer
            or ByteTokenizer()
        )

        self.max_seq_len = (
            max_seq_len
        )

        self.allow_empty = (
            allow_empty
        )

        files = (
            files
            or TRAINING_FILES
        )

        # ----------------------------------------------------
        # LOAD TEXT SAMPLES
        # ----------------------------------------------------

        self.samples = []

        for path in files:

            self.samples.extend(
                load_jsonl(path)
            )

        # ----------------------------------------------------
        # TOKENIZE
        # ----------------------------------------------------

        self.tokens = []

        for sample in self.samples:

            encoded = (
                self.tokenizer.encode(
                    sample,
                    add_special_tokens=True,
                )
            )

            self.tokens.extend(
                encoded
            )

        # ----------------------------------------------------
        # VALIDATE
        # ----------------------------------------------------

        if (
            len(self.tokens) < 2
            and not self.allow_empty
        ):

            raise RuntimeError(
                "Training dataset contains fewer than "
                "2 tokens."
            )

    # ========================================================
    # LENGTH
    # ========================================================

    def __len__(self):

        if len(self.tokens) < 2:

            return 0

        return max(
            1,
            (
                len(self.tokens) - 1
            )
            // self.max_seq_len,
        )

    # ========================================================
    # GET ITEM
    # ========================================================

    def __getitem__(
        self,
        index,
    ):

        if len(self.tokens) < 2:

            raise IndexError(
                "Dataset contains fewer than 2 tokens."
            )

        start = (
            index
            * self.max_seq_len
        )

        end = (
            start
            + self.max_seq_len
            + 1
        )

        chunk = self.tokens[
            start:end
        ]

        # ----------------------------------------------------
        # WRAP AROUND IF NECESSARY
        # ----------------------------------------------------

        if len(chunk) < (
            self.max_seq_len + 1
        ):

            needed = (
                self.max_seq_len
                + 1
                - len(chunk)
            )

            chunk += (
                self.tokens[:needed]
            )

        # ----------------------------------------------------
        # TENSOR
        # ----------------------------------------------------

        chunk = torch.tensor(
            chunk,
            dtype=torch.long,
        )

        return {
            "input_ids": chunk[:-1],
            "labels": chunk[1:],
        }


# ============================================================
# EVALUATION DATASET
# ============================================================

class EvaluationDataset(
    ShrekDataset
):

    def __init__(
        self,
        path=EVALUATION_FILE,
        tokenizer=None,
        max_seq_len=MAX_SEQ_LEN,
    ):

        super().__init__(
            files=[path],
            tokenizer=tokenizer,
            max_seq_len=max_seq_len,
            allow_empty=True,
        )





