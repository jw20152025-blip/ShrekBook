import math
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F

from config import CONFIG, DEVICE


# ============================================================
# TOKENIZER
# ============================================================

class ShrekTokenizer:

    """
    Simple byte-level tokenizer.

    No pretrained tokenizer.
    No Hugging Face tokenizer.
    No external vocabulary.

    Every UTF-8 byte maps directly to a token.

    Token IDs:

        0 = PAD
        1 = BOS
        2 = EOS
        3 = UNK
        4-259 = byte values 0-255
    """

    PAD = 0
    BOS = 1
    EOS = 2
    UNK = 3

    BYTE_OFFSET = 4

    vocab_size = 260

    def encode(
        self,
        text,
        add_bos=False,
        add_eos=True,
    ):

        data = text.encode(
            "utf-8",
            errors="replace",
        )

        tokens = []

        if add_bos:
            tokens.append(self.BOS)

        tokens.extend(
            self.BYTE_OFFSET + byte
            for byte in data
        )

        if add_eos:
            tokens.append(self.EOS)

        return tokens

    def decode(self, tokens):

        data = []

        for token in tokens:

            if token < self.BYTE_OFFSET:
                continue

            value = token - self.BYTE_OFFSET

            if 0 <= value <= 255:
                data.append(value)

        return bytes(data).decode(
            "utf-8",
            errors="replace",
        )


# ============================================================
# RMS NORMALIZATION
# ============================================================

class RMSNorm(nn.Module):

    def __init__(self, dim, eps=1e-6):

        super().__init__()

        self.eps = eps

        self.weight = nn.Parameter(
            torch.ones(dim)
        )

    def forward(self, x):

        variance = x.pow(2).mean(
            dim=-1,
            keepdim=True,
        )

        x = x * torch.rsqrt(
            variance + self.eps
        )

        return self.weight * x


# ============================================================
# ROTARY POSITIONAL EMBEDDINGS
# ============================================================

class RotaryEmbedding(nn.Module):

    def __init__(
        self,
        head_dim,
        max_seq_len,
        base=10000,
    ):

        super().__init__()

        inv_freq = 1.0 / (
            base
            ** (
                torch.arange(
                    0,
                    head_dim,
                    2,
                    dtype=torch.float32,
                )
                / head_dim
            )
        )

        positions = torch.arange(
            max_seq_len,
            dtype=torch.float32,
        )

        frequencies = torch.outer(
            positions,
            inv_freq,
        )

        self.register_buffer(
            "cos",
            frequencies.cos(),
            persistent=False,
        )

        self.register_buffer(
            "sin",
            frequencies.sin(),
            persistent=False,
        )

    def forward(self, seq_len):

        return (
            self.cos[:seq_len],
            self.sin[:seq_len],
        )


def rotate_half(x):

    x1 = x[..., ::2]

    x2 = x[..., 1::2]

    return torch.stack(
        (-x2, x1),
        dim=-1,
    ).flatten(-2)


def apply_rotary(
    x,
    cos,
    sin,
):

    # x:
    # [batch, heads, sequence, head_dim]

    cos = torch.repeat_interleave(
        cos,
        2,
        dim=-1,
    )

    sin = torch.repeat_interleave(
        sin,
        2,
        dim=-1,
    )

    cos = cos.unsqueeze(0).unsqueeze(0)

    sin = sin.unsqueeze(0).unsqueeze(0)

    return (
        x * cos
        + rotate_half(x) * sin
    )


# ============================================================
# SELF ATTENTION
# ============================================================

class CausalSelfAttention(nn.Module):

    def __init__(self, config):

        super().__init__()

        self.num_heads = config.num_heads

        self.head_dim = config.head_dim

        self.dim = config.dim

        self.qkv = nn.Linear(
            self.dim,
            self.dim * 3,
            bias=False,
        )

        self.output = nn.Linear(
            self.dim,
            self.dim,
            bias=False,
        )

        self.rotary = RotaryEmbedding(
            self.head_dim,
            config.max_seq_len,
        )

    def forward(self, x):

        batch, seq_len, _ = x.shape

        qkv = self.qkv(x)

        q, k, v = qkv.chunk(
            3,
            dim=-1,
        )

        q = q.view(
            batch,
            seq_len,
            self.num_heads,
            self.head_dim,
        ).transpose(1, 2)

        k = k.view(
            batch,
            seq_len,
            self.num_heads,
            self.head_dim,
        ).transpose(1, 2)

        v = v.view(
            batch,
            seq_len,
            self.num_heads,
            self.head_dim,
        ).transpose(1, 2)

        cos, sin = self.rotary(seq_len)

        cos = cos.to(x.device)

        sin = sin.to(x.device)

        q = apply_rotary(
            q,
            cos,
            sin,
        )

        k = apply_rotary(
            k,
            cos,
            sin,
        )

        output = F.scaled_dot_product_attention(
            q,
            k,
            v,
            is_causal=True,
        )

        output = output.transpose(
            1,
            2,
        ).contiguous()

        output = output.view(
            batch,
            seq_len,
            self.dim,
        )

        return self.output(output)


# ============================================================
# SWIGLU FEED FORWARD
# ============================================================

class SwiGLU(nn.Module):

    def __init__(
        self,
        dim,
        hidden_dim,
    ):

        super().__init__()

        self.gate = nn.Linear(
            dim,
            hidden_dim,
            bias=False,
        )

        self.up = nn.Linear(
            dim,
            hidden_dim,
            bias=False,
        )

        self.down = nn.Linear(
            hidden_dim,
            dim,
            bias=False,
        )

    def forward(self, x):

        return self.down(
            F.silu(self.gate(x))
            * self.up(x)
        )


# ============================================================
# TRANSFORMER BLOCK
# ============================================================

class TransformerBlock(nn.Module):

    def __init__(self, config):

        super().__init__()

        self.attention_norm = RMSNorm(
            config.dim
        )

        self.attention = CausalSelfAttention(
            config
        )

        self.ffn_norm = RMSNorm(
            config.dim
        )

        self.ffn = SwiGLU(
            config.dim,
            config.hidden_dim,
        )

    def forward(self, x):

        x = x + self.attention(
            self.attention_norm(x)
        )

        x = x + self.ffn(
            self.ffn_norm(x)
        )

        return x


# ============================================================
# SHREKAI
# ============================================================

class ShrekAIModel(nn.Module):

    def __init__(self):

        super().__init__()

        self.config = CONFIG

        self.tokenizer = ShrekTokenizer()

        self.embedding = nn.Embedding(
            CONFIG.vocab_size,
            CONFIG.dim,
        )

        self.layers = nn.ModuleList(
            [
                TransformerBlock(CONFIG)
                for _ in range(CONFIG.num_layers)
            ]
        )

        self.norm = RMSNorm(
            CONFIG.dim
        )

        self.lm_head = nn.Linear(
            CONFIG.dim,
            CONFIG.vocab_size,
            bias=False,
        )

        # Tie input/output embeddings.
        self.lm_head.weight = (
            self.embedding.weight
        )

        self._initialize_weights()

    # --------------------------------------------------------
    # INITIALIZATION
    # --------------------------------------------------------

    def _initialize_weights(self):

        for module in self.modules():

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

    # --------------------------------------------------------
    # FORWARD
    # --------------------------------------------------------

    def forward(
        self,
        input_ids,
        labels=None,
    ):

        x = self.embedding(
            input_ids
        )

        for layer in self.layers:

            x = layer(x)

        x = self.norm(x)

        logits = self.lm_head(x)

        loss = None

        if labels is not None:

            loss = F.cross_entropy(
                logits.view(-1, logits.size(-1)),
                labels.view(-1),
                ignore_index=CONFIG.pad_token_id,
            )

        return {
            "logits": logits,
            "loss": loss,
        }

    # --------------------------------------------------------
    # GENERATION
    # --------------------------------------------------------

    @torch.no_grad()
    def generate(
        self,
        input_ids,
        max_new_tokens=200,
        temperature=0.8,
        top_k=40,
    ):

        self.eval()

        for _ in range(max_new_tokens):

            input_ids = input_ids[
                :,
                -CONFIG.max_seq_len:
            ]

            output = self.forward(
                input_ids
            )

            logits = output["logits"][:, -1, :]

            logits = logits / max(
                temperature,
                1e-5,
            )

            if top_k is not None:

                values, _ = torch.topk(
                    logits,
                    min(
                        top_k,
                        logits.size(-1),
                    ),
                )

                minimum = values[:, -1].unsqueeze(-1)

                logits = torch.where(
                    logits < minimum,
                    torch.full_like(
                        logits,
                        float("-inf"),
                    ),
                    logits,
                )

            probabilities = F.softmax(
                logits,
                dim=-1,
            )

            next_token = torch.multinomial(
                probabilities,
                num_samples=1,
            )

            input_ids = torch.cat(
                [
                    input_ids,
                    next_token,
                ],
                dim=1,
            )

            if (
                next_token
                == CONFIG.eos_token_id
            ).all():

                break

        return input_ids

    # --------------------------------------------------------
    # DEVICE
    # --------------------------------------------------------

    def get_device(self):

        return next(
            self.parameters()
        ).device


# ============================================================
# MODEL LOADING
# ============================================================

def create_model():

    model = ShrekAIModel()

    model.to(
        torch.device(DEVICE)
    )

    parameter_count = sum(
        parameter.numel()
        for parameter in model.parameters()
    )

    print(
        f"[ShrekAI] Parameters: "
        f"{parameter_count:,}"
    )

    print(
        f"[ShrekAI] Device: "
        f"{DEVICE}"
    )

    return model