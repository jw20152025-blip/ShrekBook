
# core/model.py

import math
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.checkpoint import checkpoint

from config import (
    VOCAB_SIZE,
    D_MODEL,
    N_LAYERS,
    N_HEADS,
    FFN_MULTIPLIER,
    MAX_SEQ_LEN,
    DROPOUT,
    BIAS,
)


# ============================================================
# MODEL CONFIG
# ============================================================

@dataclass
class ModelConfig:

    vocab_size: int = VOCAB_SIZE
    d_model: int = D_MODEL
    n_layers: int = N_LAYERS
    n_heads: int = N_HEADS
    ffn_multiplier: float = FFN_MULTIPLIER
    max_seq_len: int = MAX_SEQ_LEN
    dropout: float = DROPOUT
    bias: bool = BIAS


# ============================================================
# RMSNORM
# ============================================================

class RMSNorm(nn.Module):

    def __init__(
        self,
        dim,
        eps=1e-6,
    ):
        super().__init__()

        self.weight = nn.Parameter(
            torch.ones(dim)
        )

        self.eps = eps

    def forward(self, x):

        variance = (
            x.float()
            .pow(2)
            .mean(
                -1,
                keepdim=True,
            )
        )

        inv_rms = torch.rsqrt(
            variance + self.eps
        ).to(
            dtype=x.dtype
        )

        x = x * inv_rms

        return (
            self.weight.to(
                dtype=x.dtype
            )
            * x
        )


# ============================================================
# ROTARY POSITION EMBEDDINGS
# ============================================================

def rotate_half(x):

    half = x.shape[-1] // 2

    x1 = x[..., :half]
    x2 = x[..., half:]

    return torch.cat(
        (
            -x2,
            x1,
        ),
        dim=-1,
    )


# ============================================================
# CAUSAL SELF ATTENTION
# ============================================================

class CausalSelfAttention(nn.Module):

    def __init__(
        self,
        config,
    ):
        super().__init__()

        assert (
            config.d_model
            % config.n_heads
            == 0
        )

        self.n_heads = config.n_heads

        self.head_dim = (
            config.d_model
            // config.n_heads
        )

        self.qkv = nn.Linear(
            config.d_model,
            config.d_model * 3,
            bias=config.bias,
        )

        self.out = nn.Linear(
            config.d_model,
            config.d_model,
            bias=config.bias,
        )

        self.dropout = config.dropout

        # ----------------------------------------------------
        # CACHE ROPE
        # ----------------------------------------------------

        inv_freq = 1.0 / (
            10000
            ** (
                torch.arange(
                    0,
                    self.head_dim,
                    2,
                    dtype=torch.float32,
                )
                / self.head_dim
            )
        )

        positions = torch.arange(
            config.max_seq_len,
            dtype=torch.float32,
        )

        freqs = torch.outer(
            positions,
            inv_freq,
        )

        emb = torch.cat(
            (
                freqs,
                freqs,
            ),
            dim=-1,
        )

        self.register_buffer(
            "rope_cos",
            emb.cos(),
            persistent=False,
        )

        self.register_buffer(
            "rope_sin",
            emb.sin(),
            persistent=False,
        )

    # ========================================================
    # APPLY ROPE
    # ========================================================

    def apply_rope(
        self,
        q,
        k,
        seq_len,
    ):

        cos = self.rope_cos[
            :seq_len
        ][
            None,
            None,
            :,
            :,
        ].to(
            dtype=q.dtype
        )

        sin = self.rope_sin[
            :seq_len
        ][
            None,
            None,
            :,
            :,
        ].to(
            dtype=q.dtype
        )

        q = (
            q * cos
            + rotate_half(q) * sin
        )

        k = (
            k * cos
            + rotate_half(k) * sin
        )

        return q, k

    # ========================================================
    # FORWARD
    # ========================================================

    def forward(self, x):

        batch, seq_len, channels = x.shape

        qkv = self.qkv(x)

        q, k, v = qkv.chunk(
            3,
            dim=-1,
        )

        # ----------------------------------------------------
        # SPLIT HEADS
        # ----------------------------------------------------

        q = q.view(
            batch,
            seq_len,
            self.n_heads,
            self.head_dim,
        ).transpose(
            1,
            2,
        )

        k = k.view(
            batch,
            seq_len,
            self.n_heads,
            self.head_dim,
        ).transpose(
            1,
            2,
        )

        v = v.view(
            batch,
            seq_len,
            self.n_heads,
            self.head_dim,
        ).transpose(
            1,
            2,
        )

        # ----------------------------------------------------
        # ROPE
        # ----------------------------------------------------

        q, k = self.apply_rope(
            q,
            k,
            seq_len,
        )

        # ----------------------------------------------------
        # PYTORCH SDPA
        # ----------------------------------------------------

        y = F.scaled_dot_product_attention(
            q,
            k,
            v,
            attn_mask=None,
            dropout_p=(
                self.dropout
                if self.training
                else 0.0
            ),
            is_causal=True,
        )

        # ----------------------------------------------------
        # MERGE HEADS
        # ----------------------------------------------------

        y = (
            y.transpose(
                1,
                2,
            )
            .contiguous()
        )

        y = y.view(
            batch,
            seq_len,
            channels,
        )

        return self.out(y)


# ============================================================
# SWIGLU
# ============================================================

class SwiGLU(nn.Module):

    def __init__(
        self,
        config,
    ):
        super().__init__()

        hidden = int(
            config.d_model
            * config.ffn_multiplier
        )

        # Keep the existing 256-aligned hidden size.
        hidden = 256 * (
            (hidden + 255)
            // 256
        )

        self.gate = nn.Linear(
            config.d_model,
            hidden,
            bias=config.bias,
        )

        self.up = nn.Linear(
            config.d_model,
            hidden,
            bias=config.bias,
        )

        self.down = nn.Linear(
            hidden,
            config.d_model,
            bias=config.bias,
        )

    def forward(self, x):

        gate = self.gate(x)
        up = self.up(x)

        return self.down(
            F.silu(gate)
            * up
        )


# ============================================================
# TRANSFORMER BLOCK
# ============================================================

class TransformerBlock(nn.Module):

    def __init__(
        self,
        config,
    ):
        super().__init__()

        self.norm1 = RMSNorm(
            config.d_model
        )

        self.attention = (
            CausalSelfAttention(
                config
            )
        )

        self.norm2 = RMSNorm(
            config.d_model
        )

        self.mlp = SwiGLU(
            config
        )

    def forward(self, x):

        x = (
            x
            + self.attention(
                self.norm1(x)
            )
        )

        x = (
            x
            + self.mlp(
                self.norm2(x)
            )
        )

        return x


# ============================================================
# SHREKAI
# ============================================================

class ShrekAI(nn.Module):

    def __init__(
        self,
        config=None,
    ):
        super().__init__()

        if config is None:
            config = ModelConfig()

        self.config = config

        # ----------------------------------------------------
        # EMBEDDING
        # ----------------------------------------------------

        self.token_embedding = (
            nn.Embedding(
                config.vocab_size,
                config.d_model,
            )
        )

        # ----------------------------------------------------
        # TRANSFORMER
        # ----------------------------------------------------

        self.layers = nn.ModuleList(
            [
                TransformerBlock(
                    config
                )
                for _ in range(
                    config.n_layers
                )
            ]
        )

        # ----------------------------------------------------
        # FINAL NORMALIZATION
        # ----------------------------------------------------

        self.norm = RMSNorm(
            config.d_model
        )

        # ----------------------------------------------------
        # OUTPUT HEAD
        # ----------------------------------------------------

        self.lm_head = nn.Linear(
            config.d_model,
            config.vocab_size,
            bias=False,
        )

        # ----------------------------------------------------
        # WEIGHT TYING
        # ----------------------------------------------------

        self.lm_head.weight = (
            self.token_embedding.weight
        )

        # ----------------------------------------------------
        # INITIALIZATION
        # ----------------------------------------------------

        self.apply(
            self._init_weights
        )

    # ========================================================
    # INITIALIZATION
    # ========================================================

    def _init_weights(
        self,
        module,
    ):

        if isinstance(
            module,
            nn.Linear,
        ):

            nn.init.normal_(
                module.weight,
                mean=0.0,
                std=0.02,
            )

            if module.bias is not None:

                nn.init.zeros_(
                    module.bias
                )

        elif isinstance(
            module,
            nn.Embedding,
        ):

            nn.init.normal_(
                module.weight,
                mean=0.0,
                std=0.02,
            )

    # ========================================================
    # FORWARD
    # ========================================================

    def forward(
        self,
        input_ids,
        targets=None,
    ):

        batch, seq_len = (
            input_ids.shape
        )

        if (
            seq_len
            > self.config.max_seq_len
        ):

            raise ValueError(
                f"Sequence length {seq_len} exceeds "
                f"maximum {self.config.max_seq_len}"
            )

        # ----------------------------------------------------
        # TOKEN EMBEDDING
        # ----------------------------------------------------

        x = self.token_embedding(
            input_ids
        )

        # ----------------------------------------------------
        # TRANSFORMER BLOCKS
        # ----------------------------------------------------

        for layer in self.layers:

            if (
                self.training
                and getattr(
                    self,
                    "gradient_checkpointing",
                    False,
                )
            ):

                x = checkpoint(
                    layer,
                    x,
                    use_reentrant=False,
                )

            else:

                x = layer(x)

        # ----------------------------------------------------
        # FINAL NORMALIZATION
        # ----------------------------------------------------

        x = self.norm(x)

        # ----------------------------------------------------
        # LANGUAGE MODEL HEAD
        # ----------------------------------------------------

        logits = self.lm_head(x)

        loss = None

        # ----------------------------------------------------
        # LOSS
        # ----------------------------------------------------

        if targets is not None:

            loss = F.cross_entropy(
                logits.reshape(
                    -1,
                    logits.size(-1),
                ),
                targets.reshape(
                    -1
                ),
                ignore_index=-100,
            )

        return logits, loss

    # ========================================================
    # ENABLE / DISABLE GRADIENT CHECKPOINTING
    # ========================================================

    def enable_gradient_checkpointing(
        self,
    ):

        self.gradient_checkpointing = True

    def disable_gradient_checkpointing(
        self,
    ):

        self.gradient_checkpointing = False

    # ========================================================
    # PARAMETER COUNT
    # ========================================================

    @torch.no_grad()
    def count_parameters(
        self,
    ):

        return sum(
            parameter.numel()
            for parameter in self.parameters()
            if parameter.requires_grad
        )

    # ========================================================
    # LEGACY VOCABULARY MIGRATION
    # ========================================================

    @torch.no_grad()
    def load_legacy_state_dict(
        self,
        state,
        legacy_vocab_size=263,
    ):
        """
        Load an older checkpoint whose vocabulary is smaller
        than the current model vocabulary.

        Existing rows are preserved exactly.

        New vocabulary rows are initialized from the mean of
        the original UTF-8 byte embeddings.

        This method intentionally does NOT modify transformer
        weights.
        """

        current_vocab = (
            self.config.vocab_size
        )

        if current_vocab <= legacy_vocab_size:

            raise RuntimeError(
                "Current vocabulary must be larger than "
                "the legacy vocabulary."
            )

        if (
            "token_embedding.weight"
            not in state
        ):

            raise KeyError(
                "Legacy checkpoint is missing "
                "'token_embedding.weight'."
            )

        old_embedding = state[
            "token_embedding.weight"
        ]

        if old_embedding.ndim != 2:

            raise RuntimeError(
                "Invalid legacy token embedding shape: "
                f"{tuple(old_embedding.shape)}"
            )

        old_vocab = (
            old_embedding.shape[0]
        )

        embedding_dim = (
            old_embedding.shape[1]
        )

        if old_vocab > current_vocab:

            raise RuntimeError(
                "Legacy checkpoint vocabulary is larger "
                "than the current vocabulary.\n"
                f"Checkpoint: {old_vocab}\n"
                f"Current: {current_vocab}"
            )

        # ----------------------------------------------------
        # CREATE MIGRATED EMBEDDING
        # ----------------------------------------------------

        new_embedding = (
            self.token_embedding.weight.detach()
            .clone()
        )

        # Preserve every existing row.
        new_embedding[
            :old_vocab
        ].copy_(
            old_embedding.to(
                device=new_embedding.device,
                dtype=new_embedding.dtype,
            )
        )

        # ----------------------------------------------------
        # INITIALIZE NEW TOKENS
        # ----------------------------------------------------
        #
        # Use the mean of the original UTF-8 byte embeddings
        # as a stable starting point.
        #
        # IDs 0-255 are raw byte tokens.
        #
        # IDs 256+ are special/legacy tokens.
        # ----------------------------------------------------

        byte_count = min(
            256,
            old_vocab,
        )

        if byte_count > 0:

            byte_mean = (
                old_embedding[
                    :byte_count
                ]
                .to(
                    device=new_embedding.device,
                    dtype=new_embedding.dtype,
                )
                .mean(
                    dim=0,
                    keepdim=True,
                )
            )

        else:

            byte_mean = (
                old_embedding.mean(
                    dim=0,
                    keepdim=True,
                )
                .to(
                    device=new_embedding.device,
                    dtype=new_embedding.dtype,
                )
            )

        if old_vocab < current_vocab:

            new_embedding[
                old_vocab:
            ].copy_(
                byte_mean.expand(
                    current_vocab
                    - old_vocab,
                    -1,
                )
            )

        # ----------------------------------------------------
        # LOAD ALL NON-VOCABULARY WEIGHTS
        # ----------------------------------------------------

        current_state = (
            self.state_dict()
        )

        migrated_state = {}

        for key, current_value in (
            current_state.items()
        ):

            if key in (
                "token_embedding.weight",
                "lm_head.weight",
            ):

                continue

            if key not in state:

                raise KeyError(
                    "Legacy checkpoint is missing "
                    f"required parameter: {key}"
                )

            old_value = state[key]

            if old_value.shape != current_value.shape:

                raise RuntimeError(
                    "Shape mismatch while migrating "
                    f"{key}.\n"
                    f"Checkpoint: {tuple(old_value.shape)}\n"
                    f"Current:    {tuple(current_value.shape)}"
                )

            migrated_state[key] = (
                old_value
            )

        migrated_state[
            "token_embedding.weight"
        ] = new_embedding

        migrated_state[
            "lm_head.weight"
        ] = new_embedding

        self.load_state_dict(
            migrated_state,
            strict=True,
        )

        return self

    # ========================================================
    # GENERATION
    # ========================================================

    @torch.no_grad()
    def generate(
        self,
        input_ids,
        max_new_tokens,
        temperature=0.8,
        top_p=0.92,
        repetition_penalty=1.05,
    ):

        self.eval()

        for _ in range(
            max_new_tokens
        ):

            # ------------------------------------------------
            # KEEP AVAILABLE CONTEXT
            # ------------------------------------------------

            context = input_ids[
                :,
                -self.config.max_seq_len:
            ]

            logits, _ = self(
                context
            )

            logits = logits[
                :,
                -1,
                :,
            ]

            # ------------------------------------------------
            # REPETITION PENALTY
            # ------------------------------------------------

            if (
                repetition_penalty
                != 1.0
            ):

                previous = torch.unique(
                    input_ids
                )

                logits[:, previous] /= (
                    repetition_penalty
                )

            # ------------------------------------------------
            # TEMPERATURE
            # ------------------------------------------------

            logits = logits / max(
                temperature,
                1e-5,
            )

            # ------------------------------------------------
            # TOP-P
            # ------------------------------------------------

            sorted_logits, sorted_indices = (
                torch.sort(
                    logits,
                    descending=True,
                )
            )

            probabilities = F.softmax(
                sorted_logits,
                dim=-1,
            )

            cumulative = torch.cumsum(
                probabilities,
                dim=-1,
            )

            remove = (
                cumulative > top_p
            )

            # Keep the first token above
            # the probability threshold.
            remove[..., 1:] = (
                remove[
                    ...,
                    :-1,
                ].clone()
            )

            remove[..., 0] = False

            sorted_logits[
                remove
            ] = float("-inf")

            probabilities = F.softmax(
                sorted_logits,
                dim=-1,
            )

            # ------------------------------------------------
            # SAMPLE
            # ------------------------------------------------

            next_token = (
                torch.multinomial(
                    probabilities,
                    num_samples=1,
                )
            )

            next_token = torch.gather(
                sorted_indices,
                -1,
                next_token,
            )

            input_ids = torch.cat(
                (
                    input_ids,
                    next_token,
                ),
                dim=-1,
            )

        return input_ids
