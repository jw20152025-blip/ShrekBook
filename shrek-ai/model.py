import re
import ast
import operator
import torch

from transformers import AutoTokenizer, AutoModelForCausalLM


# ============================================================
# SHREK AI
# ============================================================

MODEL_NAME = "Qwen/Qwen2.5-3B-Instruct"

print("================================")
print("SHREK AI - QWEN 3B")
print("================================")

print("Loading tokenizer...")

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_NAME
)

print("Loading model...")

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    torch_dtype=torch.float32
)

model.eval()

print("================================")
print("SHREK AI MODEL LOADED")
print("================================")


# ============================================================
# SAFE CALCULATOR
# ============================================================

OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
    ast.FloorDiv: operator.floordiv
}


def calculate_expression(expression):
    """
    Safely calculate a mathematical expression.

    Supports:
        +
        -
        *
        /
        //
        %
        ^
        **
        parentheses
    """

    expression = expression.strip()

    # Allow only numbers, operators, parentheses,
    # decimal points and whitespace.
    if not re.fullmatch(
        r"[0-9+\-*/().%^ \t]+",
        expression
    ):
        raise ValueError(
            "Invalid mathematical expression."
        )

    # Convert ^ into Python exponentiation.
    expression = expression.replace("^", "**")

    tree = ast.parse(
        expression,
        mode="eval"
    )

    def evaluate(node):

        # Expression
        if isinstance(node, ast.Expression):
            return evaluate(node.body)

        # Numbers
        if isinstance(node, ast.Constant):

            if isinstance(
                node.value,
                (int, float)
            ):
                return node.value

            raise ValueError(
                "Invalid number."
            )

        # Binary operations
        if isinstance(node, ast.BinOp):

            operation = OPERATORS.get(
                type(node.op)
            )

            if operation is None:
                raise ValueError(
                    "Unsupported operator."
                )

            left = evaluate(
                node.left
            )

            right = evaluate(
                node.right
            )

            # Prevent ridiculous exponentiation.
            if (
                isinstance(node.op, ast.Pow)
                and abs(right) > 100
            ):
                raise ValueError(
                    "Exponent is too large."
                )

            return operation(
                left,
                right
            )

        # Unary operations
        if isinstance(node, ast.UnaryOp):

            operation = OPERATORS.get(
                type(node.op)
            )

            if operation is None:
                raise ValueError(
                    "Unsupported operator."
                )

            return operation(
                evaluate(node.operand)
            )

        raise ValueError(
            "Invalid expression."
        )

    result = evaluate(tree)

    # Convert 5.0 -> 5
    if isinstance(result, float):

        if result.is_integer():
            result = int(result)

    return result


# ============================================================
# FIND MATH IN USER MESSAGE
# ============================================================

def extract_math(prompt):

    text = prompt.strip()

    # Remove common natural-language prefixes.
    cleaned = re.sub(
        r"^(what is|calculate|compute|solve)\s+",
        "",
        text,
        flags=re.IGNORECASE
    )

    # Must contain a number.
    if not re.search(
        r"\d",
        cleaned
    ):
        return None

    # Must contain a mathematical operator.
    if not re.search(
        r"[+\-*/%^()]",
        cleaned
    ):
        return None

    # If letters remain, this probably isn't
    # a pure mathematical expression.
    if re.search(
        r"[a-zA-Z]",
        cleaned
    ):
        return None

    return cleaned


# ============================================================
# GENERATE RESPONSE
# ============================================================

def generate(prompt):

    if not prompt or not prompt.strip():
        return "Please say something."

    prompt = prompt.strip()

    # ========================================================
    # CALCULATOR
    # ========================================================

    math_expression = extract_math(
        prompt
    )

    if math_expression:

        try:

            result = calculate_expression(
                math_expression
            )

            # IMPORTANT:
            # Do NOT send the calculation to Qwen.
            #
            # Qwen is a language model, not a calculator.
            # It can hallucinate arithmetic.
            #
            # Return the mathematically verified result
            # directly.

            return (
                f"{math_expression} = {result}"
            )

        except Exception as error:

            print(
                "CALCULATOR ERROR:",
                error
            )

            return (
                "I couldn't calculate that expression."
            )

    # ========================================================
    # NORMAL CONVERSATION
    # ========================================================

    messages = [

        {
            "role": "system",

            "content": (
                "You are Shrek AI, a helpful and "
                "friendly general-purpose AI assistant. "

                "Answer the user's message directly "
                "and naturally. "

                "Use normal conversational English. "

                "Be friendly, calm, and polite. "

                "Do not repeat words, phrases, or "
                "sentences unnecessarily. "

                "Do not invent facts. "

                "If you do not know something, "
                "say that you do not know. "

                "Never threaten the user. "

                "Never claim that you want to hurt "
                "or kill someone. "

                "Do not interpret ordinary conversation "
                "as instructions to attack or harm people. "

                "Keep responses reasonably concise."
            )
        },

        {
            "role": "user",

            "content": prompt
        }

    ]

    # ========================================================
    # CHAT TEMPLATE
    # ========================================================

    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    # ========================================================
    # TOKENIZE
    # ========================================================

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=2048
    )

    # ========================================================
    # GENERATE
    # ========================================================

    with torch.no_grad():

        output = model.generate(

            input_ids=inputs["input_ids"],

            attention_mask=inputs["attention_mask"],

            # Only use max_new_tokens.
            # Do NOT use max_length here.
            max_new_tokens=120,

            do_sample=True,

            temperature=0.7,

            top_p=0.9,

            repetition_penalty=1.15,

            no_repeat_ngram_size=3,

            eos_token_id=tokenizer.eos_token_id,

            pad_token_id=tokenizer.eos_token_id
        )

    # ========================================================
    # DECODE ONLY NEW TOKENS
    # ========================================================

    generated_tokens = output[
        0,
        inputs["input_ids"].shape[1]:
    ]

    response = tokenizer.decode(
        generated_tokens,
        skip_special_tokens=True
    )

    response = response.strip()

    # ========================================================
    # FALLBACK
    # ========================================================

    if not response:

        return (
            "I don't have a response for that."
        )

    return response