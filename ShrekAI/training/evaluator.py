import math

import torch

from datasets import load_dataset


class ShrekAIEvaluator:

    def __init__(
        self,
        model,
        tokenizer,
    ):

        self.model = model
        self.tokenizer = tokenizer

    def evaluate(
        self,
        dataset_path,
    ):

        dataset = load_dataset(
            "json",
            data_files=str(dataset_path),
            split="train",
        )

        self.model.eval()

        total_loss = 0.0
        count = 0

        device = next(
            self.model.parameters()
        ).device

        for example in dataset:

            messages = example["messages"]

            prompt = self.tokenizer.apply_chat_template(
                messages,
                tokenize=False,
            )

            tokens = self.tokenizer(
                prompt,
                return_tensors="pt",
                truncation=True,
            )

            tokens = {
                key: value.to(device)
                for key, value in tokens.items()
            }

            with torch.inference_mode():

                outputs = self.model(
                    **tokens,
                    labels=tokens["input_ids"],
                )

            loss = outputs.loss.item()

            if math.isfinite(loss):

                total_loss += loss
                count += 1

        if count == 0:
            return None

        average_loss = total_loss / count

        perplexity = math.exp(
            min(average_loss, 20)
        )

        return {
            "loss": average_loss,
            "perplexity": perplexity,
            "samples": count,
        }