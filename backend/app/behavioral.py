"""REST endpoints for the Behavioral Voice Round (Pillar 4)."""

import logging

from fastapi import APIRouter, HTTPException

from app import behavioral_questions
from app.db import repo

log = logging.getLogger("interview.behavioral")
router = APIRouter(prefix="/behavioral")


@router.get("/questions")
def list_questions() -> list[dict]:
    return behavioral_questions.public_summary()


@router.get("/questions/{question_id}")
def get_question(question_id: str) -> dict:
    q = behavioral_questions.get(question_id)
    if not q:
        raise HTTPException(404, "question not found")
    return {
        "id": q["id"],
        "title": q["title"],
        "category": q["category"],
        "tags": q["tags"],
        "prompt": q["prompt"],
    }


@router.get("/sessions")
async def sessions() -> list[dict]:
    try:
        return await repo.list_behavioral_sessions()
    except Exception:
        log.exception("list_behavioral_sessions failed")
        return []


@router.get("/sessions/{session_id}")
async def session_detail(session_id: str) -> dict:
    try:
        data = await repo.get_behavioral_session(session_id)
    except Exception as e:
        log.exception("get_behavioral_session failed")
        raise HTTPException(status_code=500, detail="db error") from e
    if data is None:
        raise HTTPException(status_code=404, detail="not found")
    return data
