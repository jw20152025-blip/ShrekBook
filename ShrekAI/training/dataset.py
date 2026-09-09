# training/dataset.py

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


SPECIAL_TOKENS = {
    "<|pad|>": 256,
    "<|eos|>": 257,
}


class ByteTokenizer:

    def __init__(self):

        self.special_tokens = SPECIAL_TOKENS

        self.id_to_special = {
            value: key
            for key, value in SPECIAL_TOKENS.items()
        }

    def encode(
        self,
        text,
        add_special_tokens=True,
    ):

        result = []

        pattern = re.compile(
            r"<\|(?:pad|eos|system|user|assistant|tool|end)\|>"
        )

        position = 0

        for match in pattern.finditer(text):

            normal = text[position:match.start()]

            result.extend(
                list(normal.encode("utf-8"))
            )

            token = match.group(0)

            if token in self.special_tokens:

                result.append(
                    self.special_tokens[token]
                )

            elif token == "<|eos|>":

                result.append(257)

            else:

                result.extend(
                    list(token.encode("utf-8"))
                )

            position = match.end()

        result.extend(
            list(text[position:].encode("utf-8"))
        )

        if add_special_tokens:
            result.append(257)

        return result

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

                output.append(token_id)

        return output.decode(
            "utf-8",
            errors="replace",
        )


def normalize_record(record):

    if isinstance(record, str):
        return record

    if "text" in record:
        return str(record["text"])

    if "content" in record:
        return str(record["content"])

    if "prompt" in record and "response" in record:

        return (
            "<|user|>\n"
            + str(record["prompt"])
            + "\n<|end|>\n"
            "<|assistant|>\n"
            + str(record["response"])
            + "\n<|end|>"
        )

    if "instruction" in record:

        instruction = str(
            record["instruction"]
        )

        input_text = str(
            record.get("input", "")
        )

        output = str(
            record.get(
                "output",
                record.get("response", ""),
            )
        )

        user_text = instruction

        if input_text.strip():
            user_text += "\n" + input_text

        return (
            "<|user|>\n"
            + user_text
            + "\n<|end|>\n"
            "<|assistant|>\n"
            + output
            + "\n<|end|>"
        )

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

            parts.extend(
                [
                    f"<|{role}|>",
                    content,
                    "<|end|>",
                ]
            )

        return "\n".join(parts)

    values = []

    for key, value in record.items():

        values.append(
            f"{key}: {value}"
        )

    return "\n".join(values)


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
                record = json.loads(line)

                text = normalize_record(record)

                if text.strip():
                    records.append(text)

            except json.JSONDecodeError:
                records.append(line)

    return records


class ShrekDataset(Dataset):

    def __init__(
        self,
        files=None,
        tokenizer=None,
        max_seq_len=MAX_SEQ_LEN,
    ):

        self.tokenizer = (
            tokenizer or ByteTokenizer()
        )

        self.max_seq_len = max_seq_len

        files = files or TRAINING_FILES

        self.samples = []

        for path in files:

            self.samples.extend(
                load_jsonl(path)
            )

        self.tokens = []

        for sample in self.samples:

            encoded = self.tokenizer.encode(
                sample,
                add_special_tokens=True,
            )

            self.tokens.extend(encoded)

        if len(self.tokens) < 2:
            raise RuntimeError(
                "Training dataset contains fewer than "
                "2 tokens."
            )

    def __len__(self):

        return max(
            1,
            (len(self.tokens) - 1)
            // self.max_seq_len,
        )

    def __getitem__(self, index):

        start = (
            index * self.max_seq_len
        )

        end = start + self.max_seq_len + 1

        chunk = self.tokens[
            start:end
        ]

        if len(chunk) < self.max_seq_len + 1:

            needed = (
                self.max_seq_len
                + 1
                - len(chunk)
            )

            chunk += (
                self.tokens[:needed]
            )

        chunk = torch.tensor(
            chunk,
            dtype=torch.long,
        )

        return {
            "input_ids": chunk[:-1],
            "labels": chunk[1:],
        }


class EvaluationDataset(ShrekDataset):

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
        )