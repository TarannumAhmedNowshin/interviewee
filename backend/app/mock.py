"""REST endpoints for the Live Mock Coding Interview (Pillar 3).

Problems are shared with the Coding Arena (same curated bank); the live round
just presents them differently.
"""

import logging

from fastapi import APIRouter, HTTPException

from app import arena_problems
from app.db import repo

log = logging.getLogger("interview.mock")
router = APIRouter(prefix="/mock")


@router.get("/problems")
def list_problems() -> list[dict]:
    return arena_problems.public_summary()


@router.get("/problems/{problem_id}")
def get_problem(problem_id: str) -> dict:
    p = arena_problems.get(problem_id)
    if not p:
        raise HTTPException(404, "problem not found")
    return {
        "id": p["id"],
        "title": p["title"],
        "difficulty": p["difficulty"],
        "patterns": p["patterns"],
        "prompt": p["prompt"],
        "io_note": p["io_note"],
        "starter": p["starter"],
    }


@router.get("/sessions")
async def sessions() -> list[dict]:
    try:
        return await repo.list_mock_sessions()
    except Exception:
        log.exception("list_mock_sessions failed")
        return []


@router.get("/sessions/{session_id}")
async def session_detail(session_id: str) -> dict:
    try:
        data = await repo.get_mock_session(session_id)
    except Exception as e:
        log.exception("get_mock_session failed")
        raise HTTPException(status_code=500, detail="db error") from e
    if data is None:
        raise HTTPException(status_code=404, detail="not found")
    return data
