# core/model.py

import math
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F

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


class RMSNorm(nn.Module):

    def __init__(self, dim, eps=1e-6):
        super().__init__()

        self.weight = nn.Parameter(
            torch.ones(dim)
        )

        self.eps = eps

    def forward(self, x):

        # Compute variance in FP32 for numerical stability.
        variance = (
            x.float()
            .pow(2)
            .mean(-1, keepdim=True)
        )

        # Convert the normalization factor back to
        # the input dtype so BF16 inputs remain BF16.
        inv_rms = torch.rsqrt(
            variance + self.eps
        ).to(dtype=x.dtype)

        x = x * inv_rms

        # The parameter itself is stored in FP32,
        # but the output must match x's dtype.
        weight = self.weight.to(dtype=x.dtype)

        return weight * x


def rotate_half(x):

    x1 = x[..., : x.shape[-1] // 2]
    x2 = x[..., x.shape[-1] // 2 :]

    return torch.cat(
        (-x2, x1),
        dim=-1,
    )


def apply_rope(q, k, seq_len, device):

    head_dim = q.shape[-1]

    # RoPE math is calculated in FP32 for stability.
    inv_freq = 1.0 / (
        10000
        ** (
            torch.arange(
                0,
                head_dim,
                2,
                device=device,
                dtype=torch.float32,
            )
            / head_dim
        )
    )

    positions = torch.arange(
        seq_len,
        device=device,
        dtype=torch.float32,
    )

    freqs = torch.outer(
        positions,
        inv_freq,
    )

    emb = torch.cat(
        (freqs, freqs),
        dim=-1,
    )

    # Calculate trig functions in FP32,
    # then convert them back to the Q/K dtype.
    cos = emb.cos()[
        None,
        None,
        :,
        :
    ].to(dtype=q.dtype)

    sin = emb.sin()[
        None,
        None,
        :,
        :
    ].to(dtype=q.dtype)

    q = (
        q * cos
        + rotate_half(q) * sin
    )

    k = (
        k * cos
        + rotate_half(k) * sin
    )

    return q, k


class CausalSelfAttention(nn.Module):

    def __init__(self, config):

        super().__init__()

        assert (
            config.d_model % config.n_heads == 0
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

    def forward(self, x):

        batch, seq_len, channels = x.shape

        qkv = self.qkv(x)

        q, k, v = qkv.chunk(
            3,
            dim=-1,
        )

        q = q.view(
            batch,
            seq_len,
            self.n_heads,
            self.head_dim,
        ).transpose(1, 2)

        k = k.view(
            batch,
            seq_len,
            self.n_heads,
            self.head_dim,
        ).transpose(1, 2)

        v = v.view(
            batch,
            seq_len,
            self.n_heads,
            self.head_dim,
        ).transpose(1, 2)

        q, k = apply_rope(
            q,
            k,
            seq_len,
            x.device,
        )

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

        y = (
            y.transpose(1, 2)
            .contiguous()
        )

        y = y.view(
            batch,
            seq_len,
            channels,
        )

        return self.out(y)


class SwiGLU(nn.Module):

    def __init__(self, config):

        super().__init__()

        hidden = int(
            config.d_model
            * config.ffn_multiplier
        )

        hidden = 256 * (
            (hidden + 255) // 256
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

        return self.down(
            F.silu(
                self.gate(x)
            )
            * self.up(x)
        )


class TransformerBlock(nn.Module):

    def __init__(self, config):

        super().__init__()

        self.norm1 = RMSNorm(
            config.d_model
        )

        self.attention = CausalSelfAttention(
            config
        )

        self.norm2 = RMSNorm(
            config.d_model
        )

        self.mlp = SwiGLU(
            config
        )

    def forward(self, x):

        x = x + self.attention(
            self.norm1(x)
        )

        x = x + self.mlp(
            self.norm2(x)
        )

        return x


class ShrekAI(nn.Module):

    def __init__(self, config=None):

        super().__init__()

        if config is None:
            config = ModelConfig()

        self.config = config

        self.token_embedding = nn.Embedding(
            config.vocab_size,
            config.d_model,
        )

        self.layers = nn.ModuleList(
            [
                TransformerBlock(config)
                for _ in range(config.n_layers)
            ]
        )

        self.norm = RMSNorm(
            config.d_model
        )

        self.lm_head = nn.Linear(
            config.d_model,
            config.vocab_size,
            bias=False,
        )

        # Weight tying.
        self.lm_head.weight = (
            self.token_embedding.weight
        )

        self.apply(
            self._init_weights
        )

    def _init_weights(self, module):

        if isinstance(
            module,
            nn.Linear,
        ):

            std = 0.02

            nn.init.normal_(
                module.weight,
                mean=0.0,
                std=std,
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

    def forward(
        self,
        input_ids,
        targets=None,
    ):

        batch, seq_len = input_ids.shape

        if (
            seq_len
            > self.config.max_seq_len
        ):

            raise ValueError(
                f"Sequence length {seq_len} exceeds "
                f"maximum {self.config.max_seq_len}"
            )

        x = self.token_embedding(
            input_ids
        )

        for layer in self.layers:

            x = layer(x)

        x = self.norm(x)

        logits = self.lm_head(x)

        loss = None

        if targets is not None:

            loss = F.cross_entropy(
                logits.reshape(
                    -1,
                    logits.size(-1),
                ),
                targets.reshape(-1),
                ignore_index=-100,
            )

        return logits, loss

    @torch.no_grad()
    def count_parameters(self):

        return sum(
            parameter.numel()
            for parameter in self.parameters()
            if parameter.requires_grad
        )

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

        for _ in range(max_new_tokens):

            context = input_ids[
                :,
                -self.config.max_seq_len:
            ]

            logits, _ = self(
                context
            )

            logits = logits[:, -1, :]

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

            logits = logits / max(
                temperature,
                1e-5,
            )

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

            remove[..., 1:] = (
                remove[..., :-1]
                .clone()
            )

            remove[..., 0] = False

            sorted_logits[remove] = (
                float("-inf")
            )

            probabilities = F.softmax(
                sorted_logits,
                dim=-1,
            )

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