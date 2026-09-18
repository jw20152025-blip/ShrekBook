
import json
import re
from collections import Counter
from pathlib import Path

from config import (
    DATASET_DIR,
    TRAINING_FILES,
    TOKENIZER_VOCAB_FILE,
    TOKENIZER_MIN_FREQUENCY,
    TOKENIZER_MIN_TOKEN_LENGTH,
    TOKENIZER_MAX_TOKEN_LENGTH,
    TOKENIZER_MAX_RECORD_CHARS,
    BASE_VOCAB_SIZE,
    VOCAB_SIZE,
)


# ============================================================
# CONFIGURATION
# ============================================================

LEARNED_VOCAB_SIZE = VOCAB_SIZE - BASE_VOCAB_SIZE

SPECIAL_TOKEN_PATTERN = re.compile(
    r"<\|(pad|eos|system|user|assistant|tool|end)\|>"
)

# Web-page garbage that should not become vocabulary tokens.
WEB_ARTIFACT_PATTERNS = [
    r"\[\d+\]",
    r"\[edit\]",
    r"main article:",
    r"jump to content",
    r"\bv\s*t\s*e\b",
    r"\bcontents\b",
    r"\bretrieved\b",
    r"\bwikipedia\b",
]


# ============================================================
# TEXT CLEANING
# ============================================================

def clean_text(text: str) -> str:
    """Clean training text before vocabulary construction."""

    if not isinstance(text, str):
        return ""

    text = text[:TOKENIZER_MAX_RECORD_CHARS]

    # Remove special-token strings from vocabulary training.
    text = SPECIAL_TOKEN_PATTERN.sub(" ", text)

    # Remove common web artifacts.
    for pattern in WEB_ARTIFACT_PATTERNS:
        text = re.sub(
            pattern,
            " ",
            text,
            flags=re.IGNORECASE,
        )

    # Normalize whitespace without destroying newlines.
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# ============================================================
# JSONL NORMALIZATION
# ============================================================

def normalize_record(record):
    """Extract useful text from common JSONL formats."""

    if isinstance(record, str):
        return record

    if not isinstance(record, dict):
        return ""

    # Direct text fields.
    for key in (
        "text",
        "content",
        "prompt",
        "instruction",
        "input",
        "output",
        "response",
    ):
        value = record.get(key)

        if isinstance(value, str):
            return value

    # Chat-style messages.
    messages = record.get("messages")

    if isinstance(messages, list):
        parts = []

        for message in messages:
            if not isinstance(message, dict):
                continue

            role = message.get("role")
            content = message.get("content")

            if not isinstance(content, str):
                continue

            if role:
                parts.append(
                    f"{role}: {content}"
                )
            else:
                parts.append(content)

        return "\n".join(parts)

    # Instruction-style records.
    parts = []

    for key in (
        "instruction",
        "input",
        "response",
        "output",
    ):
        value = record.get(key)

        if isinstance(value, str) and value.strip():
            parts.append(value)

    if parts:
        return "\n".join(parts)

    return ""


# ============================================================
# LOAD JSONL
# ============================================================

def load_jsonl(path: Path):
    """Load usable text records from a JSONL file."""

    if not path.exists():
        print(f"[vocab] Missing: {path}")
        return []

    records = []

    with path.open(
        "r",
        encoding="utf-8",
    ) as file:

        for line_number, line in enumerate(
            file,
            start=1,
        ):
            line = line.strip()

            if not line:
                continue

            try:
                record = json.loads(line)
                text = normalize_record(record)

            except json.JSONDecodeError:
                # Keep malformed lines as raw text.
                text = line

            text = clean_text(text)

            if text:
                records.append(text)

    return records


# ============================================================
# WORD / FRAGMENT EXTRACTION
# ============================================================

def generate_candidates(text: str):
    """
    Generate useful word-aware subword candidates.

    Candidates include:
      - whole words
      - prefixes
      - suffixes
      - word + punctuation
      - common multi-word fragments
    """

    candidates = []

    # Words including optional leading/trailing whitespace.
    words = re.findall(
        r"\s*[A-Za-z0-9_]+(?:['.-][A-Za-z0-9_]+)*",
        text,
    )

    for word in words:

        word = word[:TOKENIZER_MAX_TOKEN_LENGTH]

        if len(word.strip()) < TOKENIZER_MIN_TOKEN_LENGTH:
            continue

        # Full word.
        candidates.append(word)

        clean_word = word.strip()

        # Prefixes.
        for length in range(
            TOKENIZER_MIN_TOKEN_LENGTH,
            min(len(clean_word), 10) + 1,
        ):
            prefix = clean_word[:length]

            if len(prefix) >= TOKENIZER_MIN_TOKEN_LENGTH:
                candidates.append(prefix)

        # Suffixes.
        for length in range(
            TOKENIZER_MIN_TOKEN_LENGTH,
            min(len(clean_word), 10) + 1,
        ):
            suffix = clean_word[-length:]

            if len(suffix) >= TOKENIZER_MIN_TOKEN_LENGTH:
                candidates.append(suffix)

    # Common punctuation-aware fragments.
    punctuation_fragments = re.findall(
        r"\s+[.,!?;:()\[\]{}<>/=+\-*]",
        text,
    )

    candidates.extend(punctuation_fragments)

    return candidates


# ============================================================
# BUILD VOCABULARY
# ============================================================

def build_vocabulary():
    print("=" * 60)
    print("SHREKAI SUBWORD VOCABULARY BUILDER")
    print("=" * 60)

    counter = Counter()

    total_records = 0
    total_characters = 0

    # --------------------------------------------------------
    # Load every training source.
    # --------------------------------------------------------

    for path in TRAINING_FILES:

        print(f"[vocab] Reading {path.name}")

        records = load_jsonl(path)

        print(
            f"[vocab]   records: {len(records):,}"
        )

        for text in records:

            total_records += 1
            total_characters += len(text)

            candidates = generate_candidates(text)

            counter.update(candidates)

    print()
    print(
        f"[vocab] Total records: {total_records:,}"
    )
    print(
        f"[vocab] Total characters: {total_characters:,}"
    )
    print(
        f"[vocab] Unique candidates: {len(counter):,}"
    )

    # --------------------------------------------------------
    # Remove invalid candidates.
    # --------------------------------------------------------

    filtered = []

    for token, frequency in counter.items():

        stripped = token.strip()

        if not stripped:
            continue

        if len(stripped) < TOKENIZER_MIN_TOKEN_LENGTH:
            continue

        if len(token) > TOKENIZER_MAX_TOKEN_LENGTH:
            continue

        if frequency < TOKENIZER_MIN_FREQUENCY:
            continue

        # Never allow special-token strings.
        if SPECIAL_TOKEN_PATTERN.fullmatch(token):
            continue

        # Don't allow obvious web garbage.
        if any(
            re.search(
                pattern,
                token,
                flags=re.IGNORECASE,
            )
            for pattern in WEB_ARTIFACT_PATTERNS
        ):
            continue

        # Score frequency while rewarding useful longer tokens.
        length_bonus = max(
            1,
            len(stripped) - 1,
        )

        score = frequency * length_bonus

        filtered.append(
            (
                score,
                frequency,
                token,
            )
        )

    # --------------------------------------------------------
    # Deterministic ordering.
    # --------------------------------------------------------

    filtered.sort(
        key=lambda item: (
            -item[0],
            -item[1],
            item[2],
        )
    )

    # --------------------------------------------------------
    # Select exactly the available learned vocabulary size.
    # --------------------------------------------------------

    selected = []

    seen = set()

    for _, _, token in filtered:

        if token in seen:
            continue

        seen.add(token)
        selected.append(token)

        if len(selected) >= LEARNED_VOCAB_SIZE:
            break

    # --------------------------------------------------------
    # Save vocabulary.
    # --------------------------------------------------------

    output = {
        "version": 1,
        "vocab_size": VOCAB_SIZE,
        "base_vocab_size": BASE_VOCAB_SIZE,
        "subword_start_id": BASE_VOCAB_SIZE,
        "subwords": selected,
    }

    TOKENIZER_VOCAB_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with TOKENIZER_VOCAB_FILE.open(
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            output,
            file,
            ensure_ascii=False,
            indent=2,
        )

        file.write("\n")

    print()
    print("=" * 60)
    print("VOCABULARY COMPLETE")
    print("=" * 60)

    print(
        f"Base tokens:      {BASE_VOCAB_SIZE}"
    )
    print(
        f"Learned tokens:   {len(selected)}"
    )
    print(
        f"Total vocabulary: {BASE_VOCAB_SIZE + len(selected)}"
    )

    print(
        f"Saved to: {TOKENIZER_VOCAB_FILE}"
    )

    if len(selected) < LEARNED_VOCAB_SIZE:
        print()
        print(
            "[WARNING] Not enough candidates to fill "
            f"{LEARNED_VOCAB_SIZE} learned tokens."
        )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    build_vocabulary()
