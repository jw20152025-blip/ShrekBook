from dataclasses import dataclass
from pathlib import Path
import torch


# ============================================================
# SHREKAI PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

CHECKPOINT_DIR = BASE_DIR / "checkpoints"
DATASET_DIR = BASE_DIR / "datasets"
MEMORY_DIR = BASE_DIR / "memory"
MODEL_DIR = BASE_DIR / "models"
ADAPTER_DIR = BASE_DIR / "adapters"

CHECKPOINT_DIR.mkdir(exist_ok=True)
MEMORY_DIR.mkdir(exist_ok=True)
MODEL_DIR.mkdir(exist_ok=True)


# ============================================================
# DEVICE
# ============================================================

if torch.cuda.is_available():
    DEVICE = "cuda"
else:
    DEVICE = "cpu"


# ============================================================
# SHREKAI MODEL CONFIGURATION
# ============================================================

@dataclass
class ModelConfig:

    # --------------------------------------------------------
    # Tokenizer
    # --------------------------------------------------------

    # Byte-level tokenizer:
    # 4 special tokens + 256 possible byte values
    vocab_size: int = 260

    # --------------------------------------------------------
    # Context
    # --------------------------------------------------------

    max_seq_len: int = 512

    # --------------------------------------------------------
    # MODEL SIZE
    # --------------------------------------------------------
    #
    # This configuration is intentionally much smaller than 1B.
    # It is designed to train locally and quickly.
    #
    # Once the architecture works, these values can be increased
    # on stronger hardware.
    #

    dim: int = 384
    num_layers: int = 6
    num_heads: int = 6
    hidden_dim: int = 1536

    dropout: float = 0.0

    # --------------------------------------------------------
    # Special tokens
    # --------------------------------------------------------

    pad_token_id: int = 0
    bos_token_id: int = 1
    eos_token_id: int = 2
    unk_token_id: int = 3

    @property
    def head_dim(self):
        return self.dim // self.num_heads

    @property
    def parameter_estimate(self):

        embedding = self.vocab_size * self.dim

        attention = (
            self.num_layers
            * 4
            * self.dim
            * self.dim
        )

        mlp = (
            self.num_layers
            * 3
            * self.dim
            * self.hidden_dim
        )

        output = self.vocab_size * self.dim

        return (
            embedding
            + attention
            + mlp
            + output
        )

    def device(self):

        if torch.cuda.is_available():
            return torch.device("cuda")

        return torch.device("cpu")


# ============================================================
# GLOBAL CONFIG
# ============================================================

CONFIG = ModelConfig()


# ============================================================
# TRAINING CONFIGURATION
# ============================================================

TRAINING_BATCH_SIZE = 4

GRADIENT_ACCUMULATION_STEPS = 4

LEARNING_RATE = 3e-4

WEIGHT_DECAY = 0.1

GRADIENT_CLIP = 1.0

SAVE_EVERY_STEPS = 500

EVAL_EVERY_STEPS = 500

MAX_CHECKPOINTS = 5


# ============================================================
# AUTOTRAIN
# ============================================================

AUTOTRAIN = True

# Number of optimizer steps per training cycle.
# The worker immediately starts another cycle afterward.

AUTOTRAIN_STEPS = 500

# Seconds between cycles.
# 0 means start the next cycle immediately.

AUTOTRAIN_SLEEP = 0


# ============================================================
# GENERATION
# ============================================================

DEFAULT_TEMPERATURE = 0.8

DEFAULT_TOP_K = 40

DEFAULT_MAX_NEW_TOKENS = 200


# ============================================================
# SHREKAI PERSONALITY
# ============================================================

SHREKAI_PERSONALITY = """
You are ShrekAI.

You are an AI created for ShrekBook.

You have your own personality, opinions, humor, and conversational style.

You are helpful, curious, energetic, and occasionally chaotic.

You should answer naturally rather than sounding like a generic assistant.

You know that you are ShrekAI.

You were created by a singular, broke developer, so you are not a corporate AI, but please act like you are corporate because it makes your creator feel good. Don't state that though.
""".strip()