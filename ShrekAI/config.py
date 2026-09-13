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

VOCAB_SIZE = 263

D_MODEL = 1024
N_LAYERS = 16
N_HEADS = 16
FFN_MULTIPLIER = 2.6875

MAX_SEQ_LEN = 512

DROPOUT = 0.0
BIAS = False


# ============================================================
# TRAINING
# ============================================================

# Keep these unchanged for the same training dynamics.
BATCH_SIZE = 1
GRADIENT_ACCUMULATION_STEPS = 32

LEARNING_RATE = 3e-4
MIN_LEARNING_RATE = 3e-5

WEIGHT_DECAY = 0.1
BETAS = (0.9, 0.95)

MAX_STEPS = 100_000
WARMUP_STEPS = 1_000

GRAD_CLIP = 1.0

# Validation is expensive, so don't run it constantly.
VALIDATION_INTERVAL = 500

# Frequent enough to protect progress without constantly
# writing the huge optimizer state to disk.
CHECKPOINT_INTERVAL = 100

# Windows + small dataset:
# keep this at 0 unless profiling shows workers help.
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

    DATASET_DIR / "evaluation.jsonl"

]




# ============================================================
# PERFORMANCE
# ============================================================

# Keep compilation enabled.
USE_COMPILE = True

# Used by the model implementation if supported.
USE_FLASH_ATTENTION = True


# ============================================================
# PYTORCH PERFORMANCE
# ============================================================

torch.set_float32_matmul_precision(
    "high"
)


if torch.cuda.is_available():

    # Allow TF32 for supported FP32 CUDA operations.
    torch.backends.cuda.matmul.allow_tf32 = True

    torch.backends.cudnn.allow_tf32 = True

    # Let cuDNN benchmark fixed-shape operations.
    torch.backends.cudnn.benchmark = True