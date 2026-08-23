"""Prep-plan builder (Point 0).

Turns a target job description (JD) + the candidate's CV into a personalized,
cross-pillar preparation plan. gpt-5 analyzes the JD against the CV and selects
practice items — ONLY by id — from the existing curated banks (system design,
coding, mock, behavioral). We then validate every referenced id against those
banks and repair/fill any misses, so the returned plan is always renderable and
never points at a problem that doesn't exist.
"""

import json
import logging

from app import arena_problems, behavioral_questions, interviewer
from app.services import llm

log = logging.getLogger("interview.prep_planner")

PLANNER_SYSTEM = """You are a senior technical-interview coach. You are given a target job \
description (JD), the candidate's CV/resume, and a fixed CATALOG of practice items across four \
interview rounds: system design, coding, a live timed mock-coding round, and behavioral. \
Analyze the JD (required skills, seniority, domain, tech stack, signals) against the CV \
(existing strengths and likely gaps), then produce a personalized preparation plan that selects \
items ONLY from the provided catalog, by their exact id.

Return ONLY JSON with EXACTLY this shape:
{
  "role_summary": "<1-2 sentences naming the role, seniority, and domain as you understand them>",
  "focus_areas": ["<3-6 short skill/theme bullets the JD emphasizes>"],
  "gaps": ["<2-4 short bullets: likely gaps between the CV and the JD to shore up>"],
  "system_design": {"problem_id": "<id>", "reason": "<1 sentence: why this one for this role>"},
  "coding": [{"problem_id": "<id>", "reason": "<1 sentence>"}],
  "mock": {"problem_id": "<id>", "reason": "<1 sentence: a timed round matched to the level>"},
  "behavioral": [{"question_id": "<id>", "reason": "<1 sentence>"}],
  "closing_advice": "<2-3 sentences of specific, encouraging guidance for this candidate + role>"
}
Rules:
- Use ONLY ids that appear in the catalog. Never invent ids or titles.
- coding: 1 to 3 items, sequenced easiest-first. behavioral: 1 to 2 items.
- Choose items matching the JD's domain and patterns that also target the CV's gaps.
- Be specific to THIS candidate and THIS role. Output no text outside the JSON."""


def _catalog_text() -> str:
    lines = ["SYSTEM DESIGN problems (use as system_design.problem_id):"]
    for p in interviewer.DESIGN_PROBLEMS:
        lines.append(f"  - {p['id']}: {p['title']} — patterns: {', '.join(p['patterns'])}")
    lines.append("")
    lines.append("CODING problems (use for coding[].problem_id AND mock.problem_id — same bank):")
    for p in arena_problems.PROBLEMS:
        patterns = ", ".join(p["patterns"])
        lines.append(f"  - {p['id']}: {p['title']} [{p['difficulty']}] — patterns: {patterns}")
    lines.append("")
    lines.append("BEHAVIORAL questions (use as behavioral[].question_id):")
    for q in behavioral_questions.QUESTIONS:
        lines.append(f"  - {q['id']}: {q['title']} — {q['category']} ({', '.join(q['tags'])})")
    return "\n".join(lines)


async def build_plan(jd: str, cv: str, target_role: str) -> dict:
    """Call gpt-5 to draft a plan, then validate/repair it against the banks."""
    user = (
        f"TARGET ROLE (optional): {target_role or 'not specified'}\n\n"
        f"JOB DESCRIPTION:\n{jd.strip()}\n\n"
        f"CANDIDATE CV / RESUME:\n{cv.strip()}\n\n"
        f"AVAILABLE PRACTICE CATALOG (choose ONLY from these ids):\n{_catalog_text()}\n\n"
        "Produce the personalized plan now as JSON."
    )
    messages = [
        {"role": "system", "content": PLANNER_SYSTEM},
        {"role": "user", "content": user},
    ]
    raw = await llm.score_json(messages)
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        log.warning("planner returned non-JSON; using fallback plan")
        data = {}
    return _validate(data if isinstance(data, dict) else {})


def _str_list(value: object, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    out = [str(x).strip() for x in value if str(x).strip()]
    return out[:limit]


def _design_item(raw: object) -> dict:
    pid = raw.get("problem_id") if isinstance(raw, dict) else None
    reason = str(raw.get("reason", "")).strip() if isinstance(raw, dict) else ""
    problem = interviewer.get_design_problem(pid or "") or interviewer.DESIGN_PROBLEMS[0]
    return {"id": problem["id"], "title": problem["title"], "reason": reason}


def _coding_items(raw: object, count: int) -> list[dict]:
    items: list[dict] = []
    seen: set[str] = set()
    for entry in raw if isinstance(raw, list) else []:
        if not isinstance(entry, dict):
            continue
        problem = arena_problems.get(entry.get("problem_id") or "")
        if not problem or problem["id"] in seen:
            continue
        seen.add(problem["id"])
        items.append(
            {
                "id": problem["id"],
                "title": problem["title"],
                "difficulty": problem["difficulty"],
                "reason": str(entry.get("reason", "")).strip(),
            }
        )
        if len(items) >= count:
            break
    if not items:  # never return an empty pillar
        fallback = arena_problems.PROBLEMS[0]
        items.append(
            {
                "id": fallback["id"],
                "title": fallback["title"],
                "difficulty": fallback["difficulty"],
                "reason": "",
            }
        )
    return items


def _mock_item(raw: object) -> dict:
    problem = None
    if isinstance(raw, dict):
        problem = arena_problems.get(raw.get("problem_id") or "")
    problem = problem or arena_problems.PROBLEMS[0]
    reason = str(raw.get("reason", "")).strip() if isinstance(raw, dict) else ""
    return {
        "id": problem["id"],
        "title": problem["title"],
        "difficulty": problem["difficulty"],
        "reason": reason,
    }


def _behavioral_items(raw: object, count: int) -> list[dict]:
    items: list[dict] = []
    seen: set[str] = set()
    for entry in raw if isinstance(raw, list) else []:
        if not isinstance(entry, dict):
            continue
        question = behavioral_questions.get(entry.get("question_id") or "")
        if not question or question["id"] in seen:
            continue
        seen.add(question["id"])
        items.append(
            {
                "id": question["id"],
                "title": question["title"],
                "category": question["category"],
                "reason": str(entry.get("reason", "")).strip(),
            }
        )
        if len(items) >= count:
            break
    if not items:
        fallback = behavioral_questions.QUESTIONS[0]
        items.append(
            {
                "id": fallback["id"],
                "title": fallback["title"],
                "category": fallback["category"],
                "reason": "",
            }
        )
    return items


def _validate(data: dict) -> dict:
    """Coerce the model's output into a safe, fully-resolved plan."""
    return {
        "role_summary": str(data.get("role_summary", "")).strip(),
        "focus_areas": _str_list(data.get("focus_areas"), 6),
        "gaps": _str_list(data.get("gaps"), 4),
        "system_design": _design_item(data.get("system_design")),
        "coding": _coding_items(data.get("coding"), 3),
        "mock": _mock_item(data.get("mock")),
        "behavioral": _behavioral_items(data.get("behavioral"), 2),
        "closing_advice": str(data.get("closing_advice", "")).strip(),
    }


def plan_title(target_role: str, plan: dict) -> str:
    if target_role:
        return target_role[:80]
    summary = (plan.get("role_summary") or "").strip()
    if summary:
        head = summary.split(".")[0]
        return head[:80]
    return "Interview prep plan"
