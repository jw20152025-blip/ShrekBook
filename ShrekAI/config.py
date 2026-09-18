from pathlib import Path

import torch


# ============================================================
# ROOT DIRECTORIES
# ============================================================

ROOT_DIR = Path(__file__).resolve().parent

DATASET_DIR = ROOT_DIR / "datasets"
CHECKPOINT_DIR = ROOT_DIR / "checkpoints"
MODEL_DIR = ROOT_DIR / "models"
MEMORY_DIR = ROOT_DIR / "memory"

for directory in (
    DATASET_DIR,
    CHECKPOINT_DIR,
    MODEL_DIR,
    MEMORY_DIR,
):
    directory.mkdir(
        parents=True,
        exist_ok=True,
    )


# ============================================================
# MODEL
# ============================================================

# ------------------------------------------------------------
# TOKEN VOCABULARY
# ------------------------------------------------------------
#
# 0-255:
#     Raw UTF-8 bytes.
#
# 256-262:
#     Existing special tokens.
#
# 263-2047:
#     Learned subword tokens.
#
# IMPORTANT:
# The first 263 IDs are intentionally preserved so the
# existing ShrekAI checkpoint can be migrated without
# throwing away the learned weights.
# ------------------------------------------------------------

BASE_VOCAB_SIZE = 263

VOCAB_SIZE = 2048

SUBWORD_START_ID = BASE_VOCAB_SIZE

SUBWORD_VOCAB_SIZE = (
    VOCAB_SIZE - BASE_VOCAB_SIZE
)

D_MODEL = 1024
N_LAYERS = 16
N_HEADS = 16
FFN_MULTIPLIER = 2.6875

MAX_SEQ_LEN = 256

DROPOUT = 0.0
BIAS = False


# ============================================================
# TOKENIZER
# ============================================================

TOKENIZER_VOCAB_FILE = (
    DATASET_DIR / "subword_vocab.json"
)

TOKENIZER_MIN_FREQUENCY = 2

TOKENIZER_MIN_TOKEN_LENGTH = 2

TOKENIZER_MAX_TOKEN_LENGTH = 16

# Maximum number of characters examined when automatically
# building the vocabulary from a single training record.
TOKENIZER_MAX_RECORD_CHARS = 20_000


# ============================================================
# TRAINING
# ============================================================

BATCH_SIZE = 1

GRADIENT_ACCUMULATION_STEPS = 32

LEARNING_RATE = 3e-4
MIN_LEARNING_RATE = 3e-5

WEIGHT_DECAY = 0.1
BETAS = (0.9, 0.95)

MAX_STEPS = 100_000
WARMUP_STEPS = 1_000

GRAD_CLIP = 1.0

VALIDATION_INTERVAL = 500

CHECKPOINT_INTERVAL = 100

NUM_WORKERS = 0

SEED = 42


# ============================================================
# GENERATION
# ============================================================

MAX_NEW_TOKENS = 16

TEMPERATURE = 0.8

TOP_P = 0.92

REPETITION_PENALTY = 1.05


# ============================================================
# PERSONALITY
# ============================================================

SYSTEM_PROMPT = """
You are ShrekAI.

You are an intelligent, independent AI assistant.

Personality:
- witty
- casual
- confident
- helpful
- technically capable
- curious
- occasionally sarcastic
- friendly
- honest
- direct
- willing to say "I don't know"
- never invent facts
- never pretend to have performed an action you did not perform
- explain technical subjects clearly
- avoid unnecessary repetition
- maintain context during conversations
- do not blindly agree with the user
- correct mistakes respectfully
""".strip()


# ============================================================
# HARDWARE
# ============================================================

if torch.cuda.is_available():

    DEVICE = "cuda"

elif (
    hasattr(torch.backends, "mps")
    and torch.backends.mps.is_available()
):

    DEVICE = "mps"

else:

    DEVICE = "cpu"


# ============================================================
# TRAINING DTYPE
# ============================================================

if DEVICE == "cuda":

    if torch.cuda.is_bf16_supported():

        DTYPE = torch.bfloat16

    else:

        DTYPE = torch.float16

else:

    DTYPE = torch.float32


# ============================================================
# PATHS
# ============================================================

LATEST_CHECKPOINT = (
    CHECKPOINT_DIR / "latest.pt"
)

BEST_CHECKPOINT = (
    CHECKPOINT_DIR / "best.pt"
)

FINAL_MODEL = (
    MODEL_DIR / "shrekai.pt"
)


# ============================================================
# TRAINING DATA
# ============================================================

TRAINING_FILES = [

    DATASET_DIR / "conversations.jsonl",

    DATASET_DIR / "personality.jsonl",

    DATASET_DIR / "coding.jsonl",

    DATASET_DIR / "reasoning.jsonl",

    DATASET_DIR / "expressions.jsonl",

    DATASET_DIR / "web.jsonl",

]


# ------------------------------------------------------------
# IMPORTANT:
#
# evaluation.jsonl is NOT training data.
# ------------------------------------------------------------

EVALUATION_FILE = (
    DATASET_DIR / "evaluation.jsonl"
)


# ============================================================
# PERFORMANCE
# ============================================================

USE_COMPILE = True

USE_FLASH_ATTENTION = True


# ============================================================
# PYTORCH PERFORMANCE
# ============================================================

torch.set_float32_matmul_precision(
    "high"
)


if torch.cuda.is_available():

    torch.backends.cuda.matmul.allow_tf32 = True

    torch.backends.cudnn.allow_tf32 = True

    torch.backends.cudnn.benchmark = True