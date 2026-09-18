import json
import re
from collections import Counter
from pathlib import Path

import torch
from torch.utils.data import Dataset

from config import (
    DATASET_DIR,
    MAX_SEQ_LEN,
    TRAINING_FILES,
    EVALUATION_FILE,
    TOKENIZER_VOCAB_FILE,
    TOKENIZER_MIN_FREQUENCY,
    TOKENIZER_MIN_TOKEN_LENGTH,
    TOKENIZER_MAX_TOKEN_LENGTH,
    TOKENIZER_MAX_RECORD_CHARS,
    BASE_VOCAB_SIZE,
    VOCAB_SIZE,
    SUBWORD_START_ID,
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
# SPECIAL TOKEN HELPERS
# ============================================================

def split_special_tokens(text):

    parts = []

    position = 0

    for match in SPECIAL_TOKEN_PATTERN.finditer(
        text
    ):

        if match.start() > position:

            parts.append(
                (
                    "text",
                    text[
                        position:
                        match.start()
                    ],
                )
            )

        parts.append(
            (
                "special",
                match.group(0),
            )
        )

        position = match.end()

    if position < len(text):

        parts.append(
            (
                "text",
                text[position:],
            )
        )

    return parts


# ============================================================
# RECORD NORMALIZATION
# ============================================================

def normalize_record(record):

    if isinstance(record, str):

        return record

    if "text" in record:

        return str(
            record["text"]
        )

    if "content" in record:

        return str(
            record["content"]
        )

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

    values = []

    for key, value in record.items():

        values.append(
            f"{key}: {value}"
        )

    return "\n".join(values)


# ============================================================
# JSONL LOADER
# ============================================================

def load_jsonl(path):

    records = []

    path = Path(path)

    if not path.exists():

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
# TOKENIZER
# ============================================================

class ByteTokenizer:

    """
    Byte-compatible learned subword tokenizer.

    Existing IDs are preserved:

        0-255   raw UTF-8 bytes
        256-262 special tokens

    Learned subwords begin at:

        263

    This lets an old 263-token checkpoint be expanded to a
    larger vocabulary without changing the meaning of any
    existing token ID.
    """

    def __init__(
        self,
        vocab_file=TOKENIZER_VOCAB_FILE,
        auto_build=True,
    ):

        self.vocab_file = Path(
            vocab_file
        )

        self.special_tokens = (
            SPECIAL_TOKENS
        )

        self.id_to_special = {
            value: key
            for key, value
            in SPECIAL_TOKENS.items()
        }

        self.subwords = []

        self.subword_to_id = {}

        self.id_to_subword = {}

        self._load_or_build(
            auto_build=auto_build
        )

        # Longest tokens first.
        self._sorted_subwords = sorted(
            self.subwords,
            key=len,
            reverse=True,
        )

    # ========================================================
    # LOAD / BUILD
    # ========================================================

    def _load_or_build(
        self,
        auto_build=True,
    ):

        if self.vocab_file.exists():

            try:

                self._load_vocab()

                print(
                    "[tokenizer] Loaded subword vocabulary:"
                    f" {len(self.subwords)} learned tokens."
                )

                return

            except Exception as error:

                print(
                    "[tokenizer] Existing vocabulary "
                    "could not be loaded."
                )

                print(
                    f"[tokenizer] Reason: {error}"
                )

        if not auto_build:

            raise FileNotFoundError(
                "Subword vocabulary does not exist."
            )

        print(
            "[tokenizer] Building learned subword vocabulary..."
        )

        self._build_vocab()

        self._save_vocab()

    # ========================================================
    # LOAD VOCABULARY
    # ========================================================

    def _load_vocab(self):

        with open(
            self.vocab_file,
            "r",
            encoding="utf-8",
        ) as file:

            data = json.load(
                file
            )

        version = data.get(
            "version",
            0,
        )

        if version != 1:

            raise RuntimeError(
                "Unsupported tokenizer vocabulary version: "
                f"{version}"
            )

        saved_vocab_size = int(
            data.get(
                "vocab_size",
                0,
            )
        )

        if (
            saved_vocab_size != VOCAB_SIZE
        ):

            raise RuntimeError(
                "Tokenizer vocabulary size does not match "
                f"config VOCAB_SIZE={VOCAB_SIZE}. "
                f"Found {saved_vocab_size}."
            )

        tokens = data.get(
            "subwords",
            [],
        )

        if not isinstance(
            tokens,
            list,
        ):

            raise RuntimeError(
                "Tokenizer subwords must be a list."
            )

        self.subwords = []

        self.subword_to_id = {}

        self.id_to_subword = {}

        for index, token in enumerate(
            tokens
        ):

            token_id = (
                SUBWORD_START_ID
                + index
            )

            if token_id >= VOCAB_SIZE:

                break

            if not isinstance(
                token,
                str,
            ):

                continue

            if not token:

                continue

            self.subwords.append(
                token
            )

            self.subword_to_id[
                token
            ] = token_id

            self.id_to_subword[
                token_id
            ] = token

    # ========================================================
    # BUILD VOCABULARY
    # ========================================================

    def _build_vocab(self):

        counter = Counter()

        files = list(
            TRAINING_FILES
        )

        print(
            "[tokenizer] Reading training data..."
        )

        total_records = 0

        for path in files:

            path = Path(path)

            if not path.exists():

                continue

            records = load_jsonl(
                path
            )

            for text in records:

                total_records += 1

                self._collect_ngrams(
                    text,
                    counter,
                )

        print(
            "[tokenizer] Records examined: "
            f"{total_records:,}"
        )

        # ----------------------------------------------------
        # Remove things that should remain handled by the
        # byte fallback or special-token system.
        # ----------------------------------------------------

        candidates = []

        for token, frequency in counter.items():

            if (
                frequency
                < TOKENIZER_MIN_FREQUENCY
            ):

                continue

            if (
                len(token)
                < TOKENIZER_MIN_TOKEN_LENGTH
            ):

                continue

            if (
                len(token)
                > TOKENIZER_MAX_TOKEN_LENGTH
            ):

                continue

            if (
                token in SPECIAL_TOKENS
            ):

                continue

            if "<|" in token or "|>" in token:

                continue

            candidates.append(
                (
                    token,
                    frequency,
                )
            )

        # ----------------------------------------------------
        # Score frequent longer pieces higher.
        #
        # This creates useful pieces such as:
        #
        # " the"
        # "ing"
        # "tion"
        # "train"
        # "model"
        #
        # rather than filling the vocabulary with tiny pieces.
        # ----------------------------------------------------

        candidates.sort(
            key=lambda item: (
                item[1]
                * max(
                    1,
                    len(item[0]) - 1,
                ),
                item[1],
                len(item[0]),
            ),
            reverse=True,
        )

        maximum = (
            VOCAB_SIZE
            - BASE_VOCAB_SIZE
        )

        selected = []

        seen = set()

        for token, _ in candidates:

            if token in seen:

                continue

            seen.add(
                token
            )

            selected.append(
                token
            )

            if len(selected) >= maximum:

                break

        self.subwords = selected

        self.subword_to_id = {}

        self.id_to_subword = {}

        for index, token in enumerate(
            self.subwords
        ):

            token_id = (
                SUBWORD_START_ID
                + index
            )

            self.subword_to_id[
                token
            ] = token_id

            self.id_to_subword[
                token_id
            ] = token

        print(
            "[tokenizer] Learned subwords: "
            f"{len(self.subwords):,}"
        )

        print(
            "[tokenizer] Total vocabulary: "
            f"{BASE_VOCAB_SIZE + len(self.subwords):,}"
        )

    # ========================================================
    # N-GRAM COLLECTION
    # ========================================================

    def _collect_ngrams(
        self,
        text,
        counter,
    ):

        for part_type, part in split_special_tokens(
            text
        ):

            if part_type != "text":

                continue

            if not part:

                continue

            part = part[
                :TOKENIZER_MAX_RECORD_CHARS
            ]

            length = len(part)

            maximum_length = min(
                TOKENIZER_MAX_TOKEN_LENGTH,
                length,
            )

            for n in range(
                TOKENIZER_MIN_TOKEN_LENGTH,
                maximum_length + 1,
            ):

                for index in range(
                    0,
                    length - n + 1,
                ):

                    token = part[
                        index:index + n
                    ]

                    # Avoid learning enormous runs of
                    # whitespace.
                    if token.isspace():

                        if len(token) > 2:

                            continue

                    counter[
                        token
                    ] += 1

    # ========================================================
    # SAVE VOCABULARY
    # ========================================================

    def _save_vocab(self):

        self.vocab_file.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        data = {

            "version": 1,

            "vocab_size": VOCAB_SIZE,

            "base_vocab_size": (
                BASE_VOCAB_SIZE
            ),

            "subword_start_id": (
                SUBWORD_START_ID
            ),

            "subwords": self.subwords,

        }

        temporary = (
            self.vocab_file.with_suffix(
                ".tmp"
            )
        )

        with open(
            temporary,
            "w",
            encoding="utf-8",
        ) as file:

            json.dump(
                data,
                file,
                ensure_ascii=False,
                indent=2,
            )

        temporary.replace(
            self.vocab_file
        )

        print(
            "[tokenizer] Vocabulary saved:"
            f" {self.vocab_file}"
        )

    # ========================================================
    # ENCODE
    # ========================================================

    def encode(
        self,
        text,
        add_special_tokens=True,
    ):

        result = []

        for part_type, part in split_special_tokens(
            text
        ):

            if part_type == "special":

                token_id = (
                    self.special_tokens.get(
                        part
                    )
                )

                if token_id is not None:

                    result.append(
                        token_id
                    )

                else:

                    result.extend(
                        list(
                            part.encode(
                                "utf-8"
                            )
                        )
                    )

                continue

            # ------------------------------------------------
            # Learned subword matching.
            # ------------------------------------------------

            position = 0

            while position < len(part):

                matched = False

                for token in self._sorted_subwords:

                    if part.startswith(
                        token,
                        position,
                    ):

                        result.append(
                            self.subword_to_id[
                                token
                            ]
                        )

                        position += len(
                            token
                        )

                        matched = True

                        break

                if matched:

                    continue

                # ------------------------------------------------
                # Byte fallback.
                # ------------------------------------------------

                encoded = part[
                    position
                ].encode(
                    "utf-8"
                )

                result.extend(
                    list(encoded)
                )

                position += 1

        if add_special_tokens:

            result.append(
                self.special_tokens[
                    "<|eos|>"
                ]
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

            token_id = int(
                token_id
            )

            # ------------------------------------------------
            # Special token
            # ------------------------------------------------

            if (
                token_id
                in self.id_to_special
            ):

                if skip_special_tokens:

                    continue

                output.extend(
                    self.id_to_special[
                        token_id
                    ].encode(
                        "utf-8"
                    )
                )

                continue

            # ------------------------------------------------
            # Learned subword
            # ------------------------------------------------

            if (
                token_id
                in self.id_to_subword
            ):

                output.extend(
                    self.id_to_subword[
                        token_id
                    ].encode(
                        "utf-8"
                    )
                )

                continue

            # ------------------------------------------------
            # Raw byte
            # ------------------------------------------------

            if 0 <= token_id <= 255:

                output.append(
                    token_id
                )

        return output.decode(
            "utf-8",
            errors="ignore",
        )


# ============================================================
# TRAINING DATASET
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

        self.samples = []

        for path in files:

            self.samples.extend(
                load_jsonl(path)
            )

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

        if (
            len(self.tokens) < 2
            and not self.allow_empty
        ):

            raise RuntimeError(
                "Training dataset contains "
                "fewer than 2 tokens."
            )

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

        if len(chunk) < (
            self.max_seq_len + 1
        ):

            needed = (
                self.max_seq_len
                + 1
                - len(chunk)
            )

            chunk += self.tokens[
                :needed
            ]

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
        