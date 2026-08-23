import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.arena import router as arena_router
from app.behavioral import router as behavioral_router
from app.behavioral_ws import router as behavioral_ws_router
from app.config import get_settings
from app.db import repo
from app.db.session import init_db
from app.mock import router as mock_router
from app.mock_ws import router as mock_ws_router
from app.prep import router as prep_router
from app.rate_limit import RateLimiter
from app.ws import router as ws_router

log = logging.getLogger("interview.main")
settings = get_settings()

# Per-client HTTP limiter (WebSocket connections are limited inside app/ws_guard.py).
_http_limiter = RateLimiter(settings.rate_limit_per_minute, 60.0)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await init_db()
        log.info("db initialized")
    except Exception:
        log.exception("db init failed — persistence disabled")
    try:
        retired = await repo.expire_stale_sessions()
        if retired:
            log.info("retired %d stale active sessions", retired)
    except Exception:
        log.exception("stale-session sweep failed")
    yield


app = FastAPI(title="Interviewwee API", version="0.1.0", lifespan=lifespan)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    # Cheap unauthenticated probes are always allowed; everything else is capped.
    if request.url.path in ("/", "/health"):
        return await call_next(request)
    client = request.client.host if request.client else "unknown"
    if not _http_limiter.allow(client):
        return JSONResponse(status_code=429, content={"detail": "rate limit exceeded"})
    return await call_next(request)


# Added last so CORS is the OUTERMOST layer — even a 429 carries CORS headers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws_router)
app.include_router(arena_router)
app.include_router(mock_router)
app.include_router(mock_ws_router)
app.include_router(behavioral_router)
app.include_router(behavioral_ws_router)
app.include_router(prep_router)


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
