from pathlib import Path

import torch

from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
)

from peft import LoraConfig

from trl import (
    SFTConfig,
    SFTTrainer,
)

from config import (
    MODEL_NAME,
    MODEL_DIR,
    CHECKPOINT_DIR,
    MAX_LENGTH,
    TRAIN_BATCH_SIZE,
    GRADIENT_ACCUMULATION_STEPS,
    LEARNING_RATE,
    NUM_EPOCHS,
    LORA_R,
    LORA_ALPHA,
    LORA_DROPOUT,
)

from training.dataset import load_training_dataset


def train():

    print()
    print("=" * 60)
    print(" SHREKAI TRAINING SESSION")
    print("=" * 60)

    CHECKPOINT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    dataset = load_training_dataset()

    tokenizer = AutoTokenizer.from_pretrained(
        MODEL_NAME,
        cache_dir=str(MODEL_DIR),
    )

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    print("[ShrekAI] Loading training model...")

    if torch.cuda.is_available():

        model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            cache_dir=str(MODEL_DIR),
            torch_dtype=torch.float16,
        )

    else:

        model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            cache_dir=str(MODEL_DIR),
            torch_dtype=torch.float32,
        )

    # --------------------------------------------------------
    # LoRA
    # --------------------------------------------------------

    peft_config = LoraConfig(
        r=LORA_R,
        lora_alpha=LORA_ALPHA,
        lora_dropout=LORA_DROPOUT,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
        ],
    )

    # --------------------------------------------------------
    # Training configuration
    # --------------------------------------------------------

    training_args = SFTConfig(

        output_dir=str(CHECKPOINT_DIR),

        num_train_epochs=NUM_EPOCHS,

        per_device_train_batch_size=TRAIN_BATCH_SIZE,

        gradient_accumulation_steps=(
            GRADIENT_ACCUMULATION_STEPS
        ),

        learning_rate=LEARNING_RATE,

        logging_steps=5,

        save_strategy="steps",

        save_steps=50,

        save_total_limit=3,

        max_length=MAX_LENGTH,

        packing=True,

        gradient_checkpointing=True,

        report_to="none",

        fp16=torch.cuda.is_available(),

        dataloader_num_workers=0,

    )

    trainer = SFTTrainer(

        model=model,

        args=training_args,

        train_dataset=dataset,

        processing_class=tokenizer,

        peft_config=peft_config,
    )

    print("[ShrekAI] Training started.")

    trainer.train()

    print("[ShrekAI] Training finished.")

    final_path = CHECKPOINT_DIR / "latest"

    trainer.save_model(
        str(final_path)
    )

    tokenizer.save_pretrained(
        str(final_path)
    )

    print(
        f"[ShrekAI] Saved adapter to: {final_path}"
    )

    return final_path