"""Prep Plan API (Point 0): turn a JD + CV into a personalized cross-pillar plan.

POST /prep/plans   -> build (gpt-5) + persist a plan, return it
GET  /prep/plans   -> list saved plans
GET  /prep/plans/{id} -> one plan's detail

Note: the raw JD/CV text is stored but never logged. This is a local, single-user
tool, so there is no auth by design — the platform-wide rate limiter guards the
expensive gpt-5 call here.
"""

import logging
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import prep_planner
from app.db import repo

log = logging.getLogger("interview.prep")
router = APIRouter(prefix="/prep")


class PlanRequest(BaseModel):
    jd: str = Field(min_length=1, max_length=20000)
    cv: str = Field(min_length=1, max_length=20000)
    target_role: str = Field(default="", max_length=200)


async def _persist(coro) -> None:
    """Best-effort DB write; a persistence failure must not lose the built plan."""
    try:
        await coro
    except Exception:
        log.exception("prep persist failed")


@router.post("/plans")
async def create_plan(req: PlanRequest) -> dict:
    jd, cv, role = req.jd.strip(), req.cv.strip(), req.target_role.strip()
    if not jd or not cv:
        raise HTTPException(status_code=422, detail="jd and cv are required")
    try:
        plan = await prep_planner.build_plan(jd, cv, role)
    except Exception as e:
        log.exception("plan build failed")
        raise HTTPException(status_code=502, detail="could not build the plan") from e
    plan_id = uuid.uuid4().hex
    title = prep_planner.plan_title(role, plan)
    await _persist(repo.create_prep_plan(plan_id, title, role, jd, cv, plan))
    return {"id": plan_id, "title": title, "target_role": role, "plan": plan}


@router.get("/plans")
async def list_plans() -> list[dict]:
    try:
        return await repo.list_prep_plans()
    except Exception:
        log.exception("list_prep_plans failed")
        return []


@router.get("/plans/{plan_id}")
async def get_plan(plan_id: str) -> dict:
    try:
        data = await repo.get_prep_plan(plan_id)
    except Exception as e:
        log.exception("get_prep_plan failed")
        raise HTTPException(status_code=500, detail="db error") from e
    if data is None:
        raise HTTPException(status_code=404, detail="not found")
    return data
