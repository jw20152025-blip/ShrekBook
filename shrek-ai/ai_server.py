from fastapi import FastAPI
from pydantic import BaseModel

from model import summarize


app = FastAPI(
    title="ShrekAI"
)


class SummaryRequest(BaseModel):

    text: str


@app.get("/")
def home():

    return {
        "name": "ShrekAI",
        "status": "online"
    }


@app.post("/summarize")
def make_summary(request: SummaryRequest):

    if not request.text.strip():

        return {
            "error": "No text provided."
        }

    try:

        result = summarize(
            request.text
        )

        return {
            "summary": result
        }

    except Exception as error:

        print(
            "SUMMARY ERROR:",
            error
        )

        return {
            "error":
                "AI summarization failed."
        }