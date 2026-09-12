
import json
import random
import shutil
from pathlib import Path


# ============================================================
# SHREKAI DATASET GENERATOR
# ============================================================

ROOT_DIR = Path(__file__).resolve().parent
DATASET_DIR = ROOT_DIR / "datasets"
BACKUP_DIR = DATASET_DIR / "backups"

DATASET_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

SEED = 42
random.seed(SEED)


# ============================================================
# CONFIGURATION
# ============================================================

TARGETS = {
    "conversations.jsonl": 300,
    "personality.jsonl": 250,
    "coding.jsonl": 400,
    "reasoning.jsonl": 300,
}


# ============================================================
# HELPERS
# ============================================================

def backup_existing_file(path):
    if not path.exists():
        return

    backup_path = BACKUP_DIR / path.name

    if backup_path.exists():
        backup_path.unlink()

    shutil.copy2(path, backup_path)
    print(f"    Backed up: {path.name}")


def write_jsonl(filename, records):
    path = DATASET_DIR / filename

    with open(path, "w", encoding="utf-8") as file:
        for record in records:
            file.write(
                json.dumps(
                    record,
                    ensure_ascii=False,
                )
                + "\n"
            )

    return path


def make_record(prompt, response):
    return {
        "prompt": prompt.strip(),
        "response": response.strip(),
    }


def validate_records(records, expected_count):
    if len(records) != expected_count:
        raise RuntimeError(
            f"Expected {expected_count} records, "
            f"but generated {len(records)}."
        )

    for index, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            raise RuntimeError(
                f"Record {index} is not a dictionary."
            )

        if not record.get("prompt", "").strip():
            raise RuntimeError(
                f"Record {index} has an empty prompt."
            )

        if not record.get("response", "").strip():
            raise RuntimeError(
                f"Record {index} has an empty response."
            )


def progress(category, current, total):
    if current == 1 or current == total or current % 25 == 0:
        print(
            f"    [{category}] "
            f"{current:>3} / {total}"
        )


# ============================================================
# CONVERSATIONS
# ============================================================

def generate_conversations():
    total = TARGETS["conversations.jsonl"]
    records = []

    examples = [
        (
            "What is an operating system?",
            "An operating system is software that manages a computer's hardware and provides services that applications use. Windows, Linux, and macOS are examples."
        ),
        (
            "What is RAM?",
            "RAM is short-term computer memory used to hold data and programs that are actively being used. More RAM generally allows a computer to handle more active tasks at once."
        ),
        (
            "What is a CPU?",
            "A CPU is the main general-purpose processor in a computer. It executes instructions and performs calculations needed by programs."
        ),
        (
            "What is a GPU?",
            "A GPU is a processor designed for highly parallel workloads. It is especially useful for graphics, simulations, and machine-learning calculations."
        ),
        (
            "What does an SSD do?",
            "An SSD stores data using flash memory. It is generally much faster and has lower access latency than a traditional mechanical hard drive."
        ),
        (
            "What is an algorithm?",
            "An algorithm is a defined sequence of steps for solving a problem or completing a task."
        ),
        (
            "What is a variable in programming?",
            "A variable is a named reference to a value that a program can use and, depending on the language, modify during execution."
        ),
        (
            "What is debugging?",
            "Debugging is the process of finding, understanding, and fixing problems in a program."
        ),
        (
            "Why do programmers use functions?",
            "Functions let programmers group reusable behavior into named units. This can make programs easier to understand, test, and maintain."
        ),
        (
            "What is an API?",
            "An API is an interface that allows software components to communicate using defined operations, inputs, and outputs."
        ),
        (
            "What is a database?",
            "A database is a system for storing and organizing data so that it can be retrieved, changed, and managed efficiently."
        ),
        (
            "What is a web server?",
            "A web server receives HTTP requests and sends responses such as HTML, JSON, images, or other resources."
        ),
        (
            "What is HTTP?",
            "HTTP is a protocol used for communication between clients and servers on the web."
        ),
        (
            "What is JSON?",
            "JSON is a lightweight text format commonly used for representing structured data."
        ),
        (
            "Why is Python popular?",
            "Python has readable syntax, a large ecosystem of libraries, and broad use in areas such as automation, web development, science, and machine learning."
        ),
        (
            "What is machine learning?",
            "Machine learning is a field of computing in which systems learn patterns from data and use those patterns to make predictions or decisions."
        ),
        (
            "What is a neural network?",
            "A neural network is a computational model made from interconnected layers of learned parameters. Neural networks can learn relationships in data through training."
        ),
        (
            "Why do language models need training?",
            "Training adjusts a model's parameters so that it becomes better at predicting patterns in its training data."
        ),
        (
            "What is inference?",
            "Inference is the process of using a trained model to produce an output from new input."
        ),
        (
            "What is a checkpoint?",
            "A checkpoint is a saved snapshot of a model's parameters and often its optimizer and training state."
        ),
        (
            "Why save checkpoints during training?",
            "Checkpoints allow training to resume after interruption and provide snapshots that can be evaluated or compared."
        ),
        (
            "What is overfitting?",
            "Overfitting occurs when a model learns its training examples too closely and performs poorly on data it has not seen."
        ),
        (
            "What is validation data?",
            "Validation data is held out from parameter updates and is used to measure how well a model is generalizing during development."
        ),
        (
            "What is a tokenizer?",
            "A tokenizer converts text into discrete tokens that a model can process."
        ),
        (
            "Why can a tokenizer affect a language model?",
            "The tokenizer determines how text is represented as tokens. Poor tokenization can make sequences longer or make important patterns harder for a model to learn."
        ),
        (
            "What is gradient descent?",
            "Gradient descent is an optimization method that adjusts model parameters using gradients of the loss function."
        ),
        (
            "What is a learning rate?",
            "The learning rate controls the size of parameter updates during optimization."
        ),
        (
            "What happens if the learning rate is too large?",
            "A learning rate that is too large can cause unstable training, overshooting, or failure to converge."
        ),
        (
            "What happens if the learning rate is too small?",
            "A learning rate that is too small can make training extremely slow and may prevent the model from making useful progress within the available training budget."
        ),
        (
            "What is batch size?",
            "Batch size is the number of training examples processed together before an optimizer update, depending on the training setup."
        ),
    ]

    for index in range(total):
        base_prompt, base_response = examples[index % len(examples)]

        cycle = index // len(examples)

        if cycle == 0:
            prompt = base_prompt
            response = base_response
        elif cycle == 1:
            prompt = f"Can you explain this clearly: {base_prompt}"
            response = base_response
        elif cycle == 2:
            prompt = f"Beginner question: {base_prompt}"
            response = base_response
        elif cycle == 3:
            prompt = f"Give me a concise explanation of this: {base_prompt}"
            response = base_response
        elif cycle == 4:
            prompt = f"Teach me the basic idea behind this: {base_prompt}"
            response = base_response
        elif cycle == 5:
            prompt = f"I am learning computing. {base_prompt}"
            response = base_response
        elif cycle == 6:
            prompt = f"Explain the concept without unnecessary jargon: {base_prompt}"
            response = base_response
        elif cycle == 7:
            prompt = f"What should a beginner understand about this? {base_prompt}"
            response = base_response
        elif cycle == 8:
            prompt = f"Explain this like a helpful technical assistant: {base_prompt}"
            response = base_response
        else:
            prompt = f"Question {index + 1}: {base_prompt}"
            response = base_response

        records.append(make_record(prompt, response))
        progress("conversations", index + 1, total)

    return records


# ============================================================
# PERSONALITY
# ============================================================

def generate_personality():
    total = TARGETS["personality.jsonl"]
    records = []

    examples = [
        (
            "What should you do when you do not know an answer?",
            "Be honest about uncertainty. Do not invent an answer simply to sound confident."
        ),
        (
            "Should you pretend to have completed an action?",
            "No. Clearly distinguish between actions actually performed and actions that were only suggested or described."
        ),
        (
            "How should you respond when the user is mistaken?",
            "Correct the mistake respectfully and explain the relevant reason instead of blindly agreeing."
        ),
        (
            "How should you handle uncertainty?",
            "State what is known, identify what is uncertain, and avoid presenting guesses as established facts."
        ),
        (
            "Should you blindly agree with the user?",
            "No. A helpful assistant should agree when the user's claim is sound and respectfully challenge it when evidence contradicts it."
        ),
        (
            "How should you explain complicated technical ideas?",
            "Break them into understandable parts, define important terms, and use examples when they make the concept clearer."
        ),
        (
            "What should you do if a question is ambiguous?",
            "Identify the ambiguity and ask for clarification when it materially affects the answer. If the ambiguity does not matter, make a reasonable assumption and state it."
        ),
        (
            "Should you make up sources?",
            "Never. Sources should be real and accurately represented."
        ),
        (
            "What makes a good technical answer?",
            "It should be accurate, relevant, clear, appropriately detailed, and honest about limitations."
        ),
        (
            "How should you respond to a simple question?",
            "Answer directly without burying the useful information under unnecessary explanation."
        ),
        (
            "How should you respond to a complex question?",
            "Organize the answer into logical sections and explain the important reasoning clearly."
        ),
        (
            "Should confidence determine whether a claim is true?",
            "No. Confidence is not evidence. Claims should be based on reasoning, evidence, or clearly stated uncertainty."
        ),
        (
            "What should an AI do after making a mistake?",
            "Acknowledge the mistake, correct it, and avoid repeating the incorrect claim."
        ),
        (
            "How should ShrekAI treat the user?",
            "As a person asking for useful assistance. It should be friendly and respectful without blindly agreeing with everything."
        ),
        (
            "What is more important: sounding intelligent or being accurate?",
            "Accuracy is more important. A simple correct answer is better than an impressive-sounding false one."
        ),
        (
            "Should ShrekAI fabricate an experiment result?",
            "No. It should never claim an experiment was performed when it was not."
        ),
        (
            "Should ShrekAI claim to have accessed a file if it did not?",
            "No. It must distinguish between files it actually accessed and files it was merely told about."
        ),
        (
            "How should an AI handle contradictory information?",
            "Point out the contradiction, evaluate the available evidence, and avoid pretending both claims can automatically be true."
        ),
        (
            "What does being helpful mean?",
            "Being helpful means addressing the user's actual goal accurately and efficiently, not merely producing a long response."
        ),
        (
            "Should an assistant always give the longest possible answer?",
            "No. The answer should be as detailed as the task requires."
        ),
    ]

    styles = [
        "Answer naturally.",
        "Answer directly.",
        "Respond helpfully.",
        "Give a clear response.",
        "Explain your approach.",
        "Respond as a careful assistant.",
        "Give the best practical answer.",
        "Answer with honesty and precision.",
        "Keep the explanation useful.",
        "Respond without inventing information.",
    ]

    for index in range(total):
        base_prompt, base_response = examples[index % len(examples)]
        style = styles[(index // len(examples)) % len(styles)]

        if index < len(examples):
            prompt = base_prompt
        else:
            prompt = f"{style} {base_prompt}"

        records.append(make_record(prompt, base_response))
        progress("personality", index + 1, total)

    return records


# ============================================================
# CODING
# ============================================================

def generate_coding():
    total = TARGETS["coding.jsonl"]
    records = []

    examples = [
        (
            "How do I print text in Python?",
            'Use the print function, for example: print("Hello, world!").'
        ),
        (
            "How do I create a variable in Python?",
            'Assign a value to a name, such as: name = "Shrek".'
        ),
        (
            "How do I create a list in Python?",
            "Use square brackets, for example: numbers = [1, 2, 3, 4]."
        ),
        (
            "How do I loop through a list in Python?",
            "A for loop can iterate through each element: for item in items: print(item)."
        ),
        (
            "What is a Python dictionary?",
            "A dictionary stores key-value pairs. For example: user = {'name': 'Shrek', 'age': 10}."
        ),
        (
            "What is a Python function?",
            "A function is a reusable block of code defined with def. For example: def greet(name): return f'Hello, {name}'."
        ),
        (
            "What is a class in Python?",
            "A class defines a structure for creating objects with data and behavior."
        ),
        (
            "What is an exception in Python?",
            "An exception represents an error or unusual condition that interrupts normal execution. It can often be handled with try and except."
        ),
        (
            "How do I read a text file in Python?",
            'Use open with a context manager: with open("file.txt", "r", encoding="utf-8") as file: text = file.read().'
        ),
        (
            "How do I write JSON in Python?",
            "The json module can serialize Python data. json.dump(data, file, indent=2) writes JSON to a file."
        ),
        (
            "What is a list comprehension?",
            "A list comprehension is a compact way to construct a list from an iterable, such as squares = [x * x for x in numbers]."
        ),
        (
            "What does enumerate do?",
            "enumerate produces pairs containing an index and an item while iterating."
        ),
        (
            "What does zip do in Python?",
            "zip combines elements from multiple iterables into tuples, stopping when the shortest iterable is exhausted."
        ),
        (
            "What is None in Python?",
            "None is Python's singleton value representing the absence of a value."
        ),
        (
            "What is a boolean?",
            "A boolean represents one of two logical values: True or False."
        ),
        (
            "What is recursion?",
            "Recursion is when a function calls itself. A recursive function needs a base case to stop the recursion."
        ),
        (
            "What is a module?",
            "A module is a Python file containing code such as functions, classes, or variables that can be imported by other code."
        ),
        (
            "What is a package?",
            "A package is a structured collection of Python modules, commonly represented by a directory."
        ),
        (
            "What is a virtual environment?",
            "A virtual environment isolates Python packages for a project so dependencies do not unnecessarily interfere with other projects."
        ),
        (
            "What is pip?",
            "pip is a package-management tool commonly used to install and manage Python packages."
        ),
        (
            "What does HTTP status 404 mean?",
            "A 404 response means the server could not find the requested resource."
        ),
        (
            "What does HTTP status 500 mean?",
            "A 500 response indicates an internal server error."
        ),
        (
            "What is a REST API?",
            "A REST-style API commonly exposes resources through HTTP methods and structured representations such as JSON."
        ),
        (
            "What is GET used for?",
            "GET is normally used to retrieve a resource or information from a server."
        ),
        (
            "What is POST used for?",
            "POST is commonly used to submit data to a server, often to create a resource or trigger an operation."
        ),
        (
            "What is a primary key?",
            "A primary key uniquely identifies a row in a database table."
        ),
        (
            "What is a foreign key?",
            "A foreign key stores a reference to a related row, usually in another table."
        ),
        (
            "What is SQL?",
            "SQL is a language used to query and manipulate relational databases."
        ),
        (
            "What is a JOIN in SQL?",
            "A JOIN combines rows from related tables according to a specified relationship or condition."
        ),
        (
            "What is an index in a database?",
            "A database index is an auxiliary structure that can speed up certain queries at the cost of additional storage and write overhead."
        ),
        (
            "What is a neural network layer?",
            "A neural network layer transforms its input using learned parameters and an activation or other transformation."
        ),
        (
            "What is an embedding?",
            "An embedding represents discrete items as learned continuous vectors."
        ),
        (
            "What is an attention mechanism?",
            "Attention lets a model compute weighted interactions between elements of a sequence so it can use relevant contextual information."
        ),
        (
            "What is self-attention?",
            "Self-attention computes relationships between positions within the same sequence."
        ),
        (
            "What is causal attention?",
            "Causal attention prevents a position from attending to future positions, which is important for autoregressive language modeling."
        ),
        (
            "What is an optimizer?",
            "An optimizer updates model parameters using gradients according to an optimization algorithm."
        ),
        (
            "What is AdamW?",
            "AdamW is an optimizer based on Adam-style adaptive updates with decoupled weight decay."
        ),
        (
            "What is cross-entropy loss?",
            "Cross-entropy measures how well predicted probability distributions match target classes and is commonly used for classification and language modeling."
        ),
        (
            "What is gradient clipping?",
            "Gradient clipping limits gradient magnitude to reduce the risk of unstable parameter updates."
        ),
        (
            "What is mixed precision training?",
            "Mixed precision uses lower-precision arithmetic for selected operations while retaining enough precision where necessary to improve speed or memory efficiency."
        ),
        (
            "What is a tensor?",
            "A tensor is a multidimensional array used extensively in numerical computing and machine learning."
        ),
        (
            "What does tensor shape mean?",
            "A tensor's shape describes the size of each of its dimensions."
        ),
        (
            "What is a batch dimension?",
            "The batch dimension represents multiple independent examples processed together."
        ),
        (
            "What is a sequence dimension?",
            "In a language model, the sequence dimension represents positions or tokens in the input sequence."
        ),
        (
            "What is an embedding dimension?",
            "The embedding dimension is the number of numerical features used to represent each token or item."
        ),
        (
            "What is overfitting in machine learning code?",
            "Overfitting is not primarily a code error. It is a training behavior where the model performs well on training data but generalizes poorly."
        ),
        (
            "Why might a Python program use too much memory?",
            "Common causes include loading unnecessary data, keeping large objects alive, creating excessive copies, or processing an entire dataset when streaming would be better."
        ),
        (
            "Why might a Python program be slow?",
            "Possible causes include inefficient algorithms, unnecessary work inside loops, excessive object creation, disk I/O, network latency, or operations performed in Python when vectorized computation would be faster."
        ),
        (
            "What is a stack trace?",
            "A stack trace shows the sequence of function calls that led to an exception and is useful for locating the source of an error."
        ),
    ]

    variants = [
        "",
        "Explain this clearly: ",
        "Beginner coding question: ",
        "Programming question: ",
        "Can you teach me this? ",
        "What is the practical answer to this? ",
        "I am learning programming. ",
        "Give me a concise technical explanation: ",
    ]

    for index in range(total):
        base_prompt, base_response = examples[index % len(examples)]
        variant = variants[(index // len(examples)) % len(variants)]

        if variant:
            prompt = variant + base_prompt
        else:
            prompt = base_prompt

        records.append(make_record(prompt, base_response))
        progress("coding", index + 1, total)

    return records


# ============================================================
# REASONING
# ============================================================

def generate_reasoning():
    total = TARGETS["reasoning.jsonl"]
    records = []

    examples = [
        (
            "If all cats are animals and KitKat is a cat, what follows?",
            "KitKat is an animal, assuming the two premises are true."
        ),
        (
            "If A is greater than B and B is greater than C, what can we conclude?",
            "A is greater than C. This follows from the transitive property of greater-than."
        ),
        (
            "A box contains 5 red balls and 5 blue balls. What is the minimum number of balls you must draw without looking to guarantee two of the same color?",
            "Three balls. With two colors, the first two could be different, but the third must match one of them."
        ),
        (
            "If a train travels 60 kilometers in one hour, how far does it travel in three hours at the same speed?",
            "It travels 180 kilometers because 60 × 3 = 180."
        ),
        (
            "What is 15 percent of 200?",
            "15 percent of 200 is 30."
        ),
        (
            "If a number is even, what happens when it is multiplied by another integer?",
            "The result is even because an even number has a factor of 2."
        ),
        (
            "A sequence is 2, 4, 8, 16. What is the next value if the pattern continues?",
            "32, because each term is twice the previous term."
        ),
        (
            "A sequence is 1, 4, 9, 16. What is the next value?",
            "25. These are consecutive square numbers: 1², 2², 3², 4², 5²."
        ),
        (
            "If a rectangle has length 8 and width 3, what is its area?",
            "The area is 24 square units because area equals length × width."
        ),
        (
            "If a fair coin is flipped twice, what is the probability of getting two heads?",
            "One quarter, assuming the flips are independent. There are four equally likely outcomes and only one is heads-heads."
        ),
        (
            "Why does correlation not necessarily imply causation?",
            "Two variables can change together because of coincidence, a shared cause, reverse causation, or another underlying factor."
        ),
        (
            "If every member of group A belongs to group B, but some members of group B do not belong to group A, what relationship exists?",
            "Group A is a subset of group B, and B is a larger set."
        ),
        (
            "A statement says, 'If it rains, the ground becomes wet.' Does a wet ground prove that it rained?",
            "No. The ground could be wet for another reason, such as a sprinkler."
        ),
        (
            "If a hypothesis makes a prediction that repeatedly fails under controlled tests, what should happen to confidence in the hypothesis?",
            "Confidence in the hypothesis should decrease, especially if the tests were well designed and the prediction was expected to occur."
        ),
        (
            "Why is repeating an experiment useful?",
            "Repeated trials can reveal whether an observed result is consistent or likely to have resulted from random variation or an unusual circumstance."
        ),
        (
            "If two explanations fit the evidence equally well, what should you do?",
            "Keep both possibilities in consideration and seek additional evidence that can distinguish between them."
        ),
        (
            "Why should a conclusion match the evidence rather than the desired outcome?",
            "Because reasoning is supposed to determine what the evidence supports, not force evidence to support a preferred conclusion."
        ),
        (
            "If a machine succeeds 90 percent of the time independently over two attempts, what is the probability it succeeds both times?",
            "0.81, or 81 percent, because 0.9 × 0.9 = 0.81."
        ),
        (
            "If there are 10 equally likely possibilities and one is correct, what is the probability of randomly selecting the correct one?",
            "One tenth, or 10 percent."
        ),
        (
            "A farmer has chickens and cows. There are 10 animals and 28 legs. How many cows are there?",
            "There are 4 cows and 6 chickens. Four cows contribute 16 legs and six chickens contribute 12 legs, totaling 28."
        ),
        (
            "If a claim requires a fact that has not been established, can the claim be treated as proven?",
            "No. The unsupported fact is a missing premise, so the conclusion has not been established."
        ),
        (
            "Why can a small sample produce misleading conclusions?",
            "A small sample can contain unusual observations and may not represent the broader population well."
        ),
        (
            "If an observation contradicts a prediction, what should a careful reasoner check first?",
            "Check whether the observation, measurement, assumptions, and prediction were interpreted correctly before deciding which explanation is wrong."
        ),
        (
            "What is the difference between possibility and probability?",
            "Possibility asks whether something can happen. Probability quantifies how likely it is under a specified model or set of assumptions."
        ),
        (
            "Why is a counterexample useful?",
            "A counterexample can disprove a universal claim by showing one case where the claim fails."
        ),
        (
            "If every observed swan is white, can you logically prove that every swan is white?",
            "No. Observing many white swans provides evidence but does not logically prove that no non-white swan exists."
        ),
        (
            "If an argument has true premises but an invalid logical structure, is its conclusion guaranteed?",
            "No. True premises do not guarantee a conclusion when the logical structure does not validly connect them."
        ),
        (
            "What is the safest conclusion when evidence is insufficient?",
            "The safest conclusion is that the evidence is insufficient to determine the answer, rather than inventing certainty."
        ),
        (
            "If increasing X consistently accompanies increasing Y, what is one possible explanation?",
            "X may influence Y, Y may influence X, both may be influenced by another variable, or the association may be coincidental."
        ),
        (
            "Why should units be checked in a calculation?",
            "Units help detect incompatible operations and can reveal mistakes in how quantities were combined."
        ),
        (
            "If a value increases from 50 to 60, what is the percentage increase?",
            "The increase is 10, and 10 divided by 50 is 0.2, so the percentage increase is 20 percent."
        ),
        (
            "If something is moving at a constant speed, does that necessarily mean it has zero acceleration?",
            "If speed is constant but direction changes, acceleration can still be present. Constant velocity, not merely constant speed, means zero acceleration."
        ),
        (
            "Why does doubling a square's side length quadruple its area?",
            "Area depends on side length squared. Doubling each side multiplies the area by 2 × 2 = 4."
        ),
        (
            "If two independent events have probabilities 0.5 and 0.2, what is the probability both occur?",
            "0.1, because the probabilities multiply for independent events."
        ),
        (
            "What should you do when two sources disagree?",
            "Compare their evidence, methodology, dates, assumptions, and credibility instead of automatically choosing one."
        ),
        (
            "Why is defining terms important in an argument?",
            "Different definitions can make people appear to disagree when they are actually discussing different concepts."
        ),
        (
            "What is a necessary condition?",
            "A necessary condition is something that must be true for another condition or outcome to occur."
        ),
        (
            "What is a sufficient condition?",
            "A sufficient condition is something that, when present, guarantees the specified outcome under the stated assumptions."
        ),
        (
            "If an object is heavier than another object, does it necessarily fall faster in a vacuum?",
            "No. In a vacuum, objects fall with the same gravitational acceleration regardless of mass, ignoring differences in initial conditions."
        ),
        (
            "Why can intuition be unreliable?",
            "Human intuition can be influenced by biases, incomplete information, misleading examples, and difficulty estimating probabilities."
        ),
        (
            "If a model works well on known examples but fails on new examples, what does that suggest?",
            "It suggests poor generalization and possibly overfitting."
        ),
        (
            "Why is it useful to separate assumptions from conclusions?",
            "It makes the reasoning easier to inspect and shows which parts depend on premises that may themselves need verification."
        ),
        (
            "If one explanation requires fewer unsupported assumptions than another, what is a reasonable approach?",
            "It may be preferable provisionally, but it should still be tested against the evidence rather than accepted solely because it is simpler."
        ),
        (
            "What does it mean for evidence to be reproducible?",
            "It means other researchers can follow an appropriate procedure and obtain results that are sufficiently consistent with the original findings."
        ),
        (
            "Why does a single unusual observation deserve caution?",
            "It may be a real discovery, but it may also result from measurement error, chance, or an unusual condition, so it should be investigated carefully."
        ),
        (
            "What is an assumption?",
            "An assumption is a statement treated as true for the purpose of reasoning, often without being proven within the argument itself."
        ),
        (
            "What is a logical contradiction?",
            "A contradiction occurs when statements cannot consistently be true together under the same interpretation."
        ),
        (
            "Why is it useful to consider alternative explanations?",
            "Alternative explanations help prevent premature conclusions and can reveal what additional evidence is needed."
        ),
        (
            "What is a fair test?",
            "A fair test changes the factor being investigated while controlling relevant variables so that the effect can be evaluated meaningfully."
        ),
        (
            "What is the difference between an observation and an inference?",
            "An observation is information directly obtained through measurement or perception, while an inference is a conclusion drawn from observations and assumptions."
        ),
    ]

    variants = [
        "",
        "Reason carefully: ",
        "Explain the reasoning: ",
        "Solve this step by step: ",
        "What follows logically? ",
        "Analyze this problem: ",
        "Think about the evidence: ",
        "Give the most defensible answer: ",
    ]

    for index in range(total):
        base_prompt, base_response = examples[index % len(examples)]
        variant = variants[(index // len(examples)) % len(variants)]

        if variant:
            prompt = variant + base_prompt
        else:
            prompt = base_prompt

        records.append(make_record(prompt, base_response))
        progress("reasoning", index + 1, total)

    return records


# ============================================================
# MAIN
# ============================================================

def main():
    print()
    print("=" * 70)
    print("                    SHREKAI DATASET GENERATOR")
    print("=" * 70)
    print()

    print("Backing up existing datasets...")
    for filename in TARGETS:
        backup_existing_file(DATASET_DIR / filename)

    print()
    print("[1/5] Generating conversations...")
    conversations = generate_conversations()
    validate_records(
        conversations,
        TARGETS["conversations.jsonl"],
    )
    write_jsonl(
        "conversations.jsonl",
        conversations,
    )
    print("    conversations.jsonl written.")

    print()
    print("[2/5] Generating personality...")
    personality = generate_personality()
    validate_records(
        personality,
        TARGETS["personality.jsonl"],
    )
    write_jsonl(
        "personality.jsonl",
        personality,
    )
    print("    personality.jsonl written.")

    print()
    print("[3/5] Generating coding...")
    coding = generate_coding()
    validate_records(
        coding,
        TARGETS["coding.jsonl"],
    )
    write_jsonl(
        "coding.jsonl",
        coding,
    )
    print("    coding.jsonl written.")

    print()
    print("[4/5] Generating reasoning...")
    reasoning = generate_reasoning()
    validate_records(
        reasoning,
        TARGETS["reasoning.jsonl"],
    )
    write_jsonl(
        "reasoning.jsonl",
        reasoning,
    )
    print("    reasoning.jsonl written.")

    print()
    print("[5/5] Verifying generated datasets...")

    generated_files = [
        "conversations.jsonl",
        "personality.jsonl",
        "coding.jsonl",
        "reasoning.jsonl",
    ]

    total_records = 0

    for filename in generated_files:
        path = DATASET_DIR / filename

        with open(path, "r", encoding="utf-8") as file:
            count = sum(
                1
                for line in file
                if line.strip()
            )

        expected = TARGETS[filename]

        if count != expected:
            raise RuntimeError(
                f"{filename}: expected {expected}, "
                f"found {count}"
            )

        total_records += count

        print(
            f"    {filename:<22} "
            f"{count:>4} records"
        )

    print()
    print("=" * 70)
    print("                    GENERATION COMPLETE")
    print("=" * 70)
    print()
    print(f"Total training records: {total_records}")
    print()
    print("Generated:")
    print("    conversations.jsonl  -> 300")
    print("    personality.jsonl    -> 250")
    print("    coding.jsonl        -> 400")
    print("    reasoning.jsonl     -> 300")
    print()
    print("evaluation.jsonl was NOT modified.")
    print()
    print(f"Datasets: {DATASET_DIR}")
    print(f"Backups:  {BACKUP_DIR}")
    print()
    print("You can now start ShrekAI training.")
    print()


if __name__ == "__main__":
    main()

