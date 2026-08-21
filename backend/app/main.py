import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import repo
from app.db.session import init_db
from app.ws import router as ws_router

log = logging.getLogger("interview.main")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await init_db()
        log.info("db initialized")
    except Exception:
        log.exception("db init failed — persistence disabled")
    yield


app = FastAPI(title="Interviewwee API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws_router)


@app.get("/")
def root() -> dict:
    return {"name": "Interviewwee API", "status": "ok"}


@app.get("/health")
def health() -> dict:
    # Booleans only — never expose secret values.
    return {
        "status": "ok",
        "services": {
            "gpt5": settings.gpt5_configured,
            "gpt5_mini": settings.gpt5_mini_configured,
            "whisper": settings.whisper_configured,
            "speech": settings.speech_configured,
            "embeddings": settings.embeddings_configured,
        },
    }


@app.get("/sessions")
async def sessions() -> list[dict]:
    try:
        return await repo.list_sessions()
    except Exception:
        log.exception("list_sessions failed")
        return []


@app.get("/sessions/{session_id}")
async def session_detail(session_id: str) -> dict:
    try:
        data = await repo.get_session(session_id)
    except Exception as e:
        log.exception("get_session failed")
        raise HTTPException(status_code=500, detail="db error") from e
    if data is None:
        raise HTTPException(status_code=404, detail="not found")
    return data
