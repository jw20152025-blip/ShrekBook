from fastapi import FastAPI
from pydantic import BaseModel

from model import generate


app = FastAPI(
    title="ShrekAI"
)


class GenerateRequest(BaseModel):
    prompt: str


@app.get("/")
def home():

    return {
        "name": "ShrekAI",
        "status": "online",
        "model": "Qwen/Qwen2.5-3B-Instruct"
    }


@app.post("/generate")
def make_response(request: GenerateRequest):

    if not request.prompt.strip():

        return {
            "error": "No prompt provided."
        }

    try:

        result = generate(
            request.prompt
        )

        return {
            "response": result
        }

    except Exception as error:

        print(
            "AI GENERATION ERROR:",
            error
        )

        return {
            "error":
                "AI generation failed."
        }