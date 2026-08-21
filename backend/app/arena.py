"""Coding Arena: run/submit candidate code against test cases + AI review."""

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import arena_problems
from app.db import repo
from app.services import executor, llm

log = logging.getLogger("interview.arena")
router = APIRouter(prefix="/arena")

SUPPORTED = {"python", "javascript", "cpp"}

REVIEW_SYSTEM = """You are a senior engineer reviewing a candidate's solution to a coding \
problem, like a thoughtful interviewer. Given the problem, the candidate's code, and the test \
results, return ONLY JSON:
{
  "big_o_time": "<e.g. O(n)>",
  "big_o_space": "<e.g. O(1)>",
  "correctness": "<1-2 sentences: is the approach correct and optimal?>",
  "review": "<2-4 sentences on readability, edge cases, and how to improve>",
  "suggestions": ["<short, actionable bullet>", "..."]
}
Be specific to THEIR code. If tests failed, point at the likely cause. No text outside the JSON."""

HINT_SYSTEM = """You are an interviewer giving ONE progressive hint — never the full solution.
Level 1: a gentle nudge (what to notice, or a clarifying question about the approach).
Level 2: name the right technique/data structure and briefly why it fits.
Level 3: outline the algorithm as steps (still NO complete code).
Given the problem, the candidate's current code, and the requested level, return ONLY JSON:
{"hint": "<2-4 sentences at exactly the requested level>"}
Never write a full working solution."""


class RunRequest(BaseModel):
    problem_id: str
    language: str
    source: str


class HintRequest(BaseModel):
    problem_id: str
    source: str = ""
    level: int = 1


def _normalize(s: str) -> str:
    return "\n".join(line.rstrip() for line in (s or "").strip().splitlines())


async def _run_one(language: str, source: str, test: dict, index: int) -> dict:
    res = await executor.execute(language, source, stdin=test["input"])
    if not res.get("ok"):
        return {
            "index": index,
            "passed": False,
            "hidden": test["hidden"],
            "error": res.get("error"),
        }
    ok = _normalize(res.get("stdout", "")) == _normalize(test["output"])
    out: dict = {"index": index, "passed": ok, "hidden": test["hidden"]}
    if not test["hidden"]:
        out |= {
            "input": test["input"],
            "expected": test["output"],
            "got": (res.get("stdout") or "").strip(),
        }
    err = res.get("stderr") or res.get("compile_stderr")
    if err and not ok:
        out["stderr"] = err.strip()[:2000]
    return out


async def _grade(problem: dict, language: str, source: str, *, include_hidden: bool) -> dict:
    tests = problem["tests"] if include_hidden else [t for t in problem["tests"] if not t["hidden"]]
    results = await asyncio.gather(
        *[_run_one(language, source, t, i) for i, t in enumerate(tests)]
    )
    passed = sum(1 for r in results if r["passed"])
    return {"passed": passed, "total": len(tests), "results": list(results)}


async def _review(problem: dict, language: str, source: str, graded: dict) -> dict | None:
    user = (
        f"Problem: {problem['title']}\n{problem['prompt']}\n\n"
        f"Language: {language}\nPassed {graded['passed']}/{graded['total']} tests.\n\n"
        f"Candidate code:\n```\n{source}\n```"
    )
    try:
        raw = await llm.score_json(
            [{"role": "system", "content": REVIEW_SYSTEM}, {"role": "user", "content": user}]
        )
        return json.loads(raw)
    except Exception:
        log.exception("code review failed")
        return None


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
        "complexity": p["complexity"],
        "starter": p["starter"],
        "examples": [
            {"input": t["input"], "output": t["output"]} for t in p["tests"] if not t["hidden"]
        ],
    }


@router.post("/run")
async def run_code(req: RunRequest) -> dict:
    p = arena_problems.get(req.problem_id)
    if not p:
        raise HTTPException(404, "problem not found")
    if req.language not in SUPPORTED:
        raise HTTPException(400, f"unsupported language: {req.language}")
    return await _grade(p, req.language, req.source, include_hidden=False)


@router.post("/submit")
async def submit_code(req: RunRequest) -> dict:
    p = arena_problems.get(req.problem_id)
    if not p:
        raise HTTPException(404, "problem not found")
    if req.language not in SUPPORTED:
        raise HTTPException(400, f"unsupported language: {req.language}")
    graded = await _grade(p, req.language, req.source, include_hidden=True)
    review = await _review(p, req.language, req.source, graded)
    solved = graded["passed"] == graded["total"]
    try:
        await repo.save_arena_submission(
            req.problem_id, req.language, graded["passed"], graded["total"], solved
        )
    except Exception:
        log.exception("save arena submission failed")
    return {**graded, "review": review, "solved": solved}


@router.get("/progress")
async def progress() -> dict:
    try:
        return await repo.get_arena_progress()
    except Exception:
        log.exception("arena progress failed")
        return {}


@router.post("/hint")
async def hint(req: HintRequest) -> dict:
    p = arena_problems.get(req.problem_id)
    if not p:
        raise HTTPException(404, "problem not found")
    level = max(1, min(3, req.level))
    user = (
        f"Problem: {p['title']}\n{p['prompt']}\n\n"
        f"Hint level: {level}\n\n"
        f"Candidate's current code:\n```\n{req.source}\n```"
    )
    try:
        raw = await llm.score_json(
            [{"role": "system", "content": HINT_SYSTEM}, {"role": "user", "content": user}]
        )
        return {"hint": json.loads(raw).get("hint", ""), "level": level}
    except Exception:
        log.exception("hint failed")
        return {"hint": "", "level": level}
