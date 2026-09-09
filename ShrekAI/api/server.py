from fastapi import (
    FastAPI,
    Header,
    HTTPException,
)

from pydantic import BaseModel

from core.model import ShrekAIModel
from core.inference import ShrekAIInference

from config import API_KEY


app = FastAPI(
    title="ShrekAI",
    version="1.0.0",
)


# ------------------------------------------------------------
# GLOBAL MODEL
# ------------------------------------------------------------

shrek_model = None
inference = None


class ChatRequest(BaseModel):

    message: str

    history: list[dict] | None = None

    max_new_tokens: int | None = None


class ChatResponse(BaseModel):

    response: str


def authenticate(
    authorization: str | None,
):

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization.",
        )

    expected = f"Bearer {API_KEY}"

    if authorization != expected:

        raise HTTPException(
            status_code=403,
            detail="Invalid API key.",
        )


@app.on_event("startup")
def startup():

    global shrek_model
    global inference

    print(
        "[API] Loading ShrekAI..."
    )

    shrek_model = (
        ShrekAIModel()
        .load()
    )

    inference = (
        ShrekAIInference(
            shrek_model
        )
    )

    print(
        "[API] ShrekAI ready."
    )


@app.get("/health")
def health():

    return {
        "status": "ok",
        "model_loaded": (
            shrek_model is not None
        ),
    }


@app.post(
    "/chat",
    response_model=ChatResponse,
)
def chat(
    request: ChatRequest,
    authorization: str | None = Header(
        default=None
    ),
):

    authenticate(
        authorization
    )

    if not request.message.strip():

        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty.",
        )

    response = inference.generate(
        user_message=request.message,
        history=request.history,
        max_new_tokens=(
            request.max_new_tokens
            or 256
        ),
    )

    return {
        "response": response
    }