from fastapi import FastAPI
from pydantic import BaseModel

from model import generate


# ============================================================
# SHREK AI API
# ============================================================

app = FastAPI(
    title="ShrekAI",
    version="1.0.0"
)


# ============================================================
# REQUEST MODEL
# ============================================================

class ChatRequest(BaseModel):
    prompt: str


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():

    return {
        "name": "ShrekAI",
        "status": "online"
    }


# ============================================================
# CHAT
# ============================================================

@app.post("/generate")
def make_response(request: ChatRequest):

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
            "AI ERROR:",
            error
        )

        return {
            "error": "AI generation failed."
        }