import hashlib
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from app.db import repo
from app.interviewer import (
    DIRECTOR_SYSTEM,
    INTERVIEWER_SYSTEM,
    MOVES,
    PROBLEMS,
    SCORING_SYSTEM,
    STAGES,
    get_design_problem,
)
from app.services import llm
from app.session_store import SessionStore


@dataclass
class Session:
    id: str
    problem: str
    stage: str = "intro"
    voice_enabled: bool = True
    diagram: str | None = None  # latest whiteboard PNG, base64 (no data-URL prefix)
    history: list[dict] = field(default_factory=list)  # {"role", "content"} messages


_SESSIONS: SessionStore[Session] = SessionStore()


def _select_problem(session_id: str, problem_id: str | None) -> str:
    if problem_id:
        chosen = get_design_problem(problem_id)
        if chosen:
            return chosen["prompt"]
    # sha256, not the built-in hash(): Python salts str hashing per process
    # (PYTHONHASHSEED), so hash() is NOT stable across restarts. sha256 is.
    digest = hashlib.sha256(session_id.encode()).hexdigest()
    return PROBLEMS[int(digest, 16) % len(PROBLEMS)]


async def get_or_create(session_id: str, problem_id: str | None = None) -> Session:
    existing = _SESSIONS.get(session_id)
    if existing is not None:
        return existing
    session = Session(id=session_id, problem=_select_problem(session_id, problem_id))
    await _try_rehydrate(session)
    _SESSIONS.set(session_id, session)
    return session


async def _try_rehydrate(session: Session) -> None:
    """Restore a live session's context from the DB (e.g. after a backend restart)."""
    try:
        data = await repo.get_session(session.id)
    except Exception:
        return
    if not data or data.get("status") != "active":
        return
    if data.get("problem"):
        session.problem = data["problem"]
    if data.get("stage"):
        session.stage = data["stage"]
    session.diagram = data.get("diagram")
    session.history = [{"role": t["role"], "content": t["text"]} for t in data.get("turns", [])]


def _transcript(session: Session) -> str:
    if not session.history:
        return "(no messages yet)"
    lines = []
    for turn in session.history:
        who = "Candidate" if turn["role"] == "user" else "Interviewer"
        lines.append(f"{who}: {turn['content']}")
    return "\n".join(lines)


async def decide(session: Session) -> dict:
    """The gpt-5-mini director picks the next stage + move for this turn."""
    user = (
        f"Current stage: {session.stage}\n"
        f"Whiteboard: {'has a diagram' if session.diagram else 'empty'}\n\n"
        f"Transcript so far:\n{_transcript(session)}\n\n"
        "Decide the next stage and move. Return JSON."
    )
    messages = [
        {"role": "system", "content": DIRECTOR_SYSTEM},
        {"role": "user", "content": user},
    ]
    raw = await llm.decide_json(messages)
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        data = {}
    stage = data.get("stage") if data.get("stage") in STAGES else session.stage
    move = data.get("move") if data.get("move") in MOVES else "probe_deeper"
    session.stage = stage
    return {"stage": stage, "move": move, "note": data.get("note", "")}


async def stream_opening(session: Session) -> AsyncIterator[str]:
    system = (
        f"{INTERVIEWER_SYSTEM}\n\n"
        f"The problem: {session.problem}\n\n"
        "Open the interview now: greet the candidate in one sentence, state the problem, and "
        "invite them to start by asking clarifying questions. 2-3 sentences maximum."
    )
    async for delta in llm.stream_interviewer([{"role": "system", "content": system}]):
        yield delta


async def stream_reply(session: Session, move: str, stage: str) -> AsyncIterator[str]:
    system = (
        f"{INTERVIEWER_SYSTEM}\n\n"
        f"The problem the candidate is solving: {session.problem}\n\n"
        f"Current stage: {stage}\n"
        f"Your move this turn: {move}\n"
        "Respond in 1-3 natural spoken sentences."
    )
    messages: list[dict] = [{"role": "system", "content": system}, *session.history]
    if session.diagram:
        messages.append(
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "This is my current whiteboard for the design. "
                            "Refer to it when relevant."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{session.diagram}"},
                    },
                ],
            }
        )
    async for delta in llm.stream_interviewer(messages):
        yield delta


async def evaluate(session: Session) -> dict:
    """Grade the whole interview with gpt-5 against a rubric; returns the report dict."""
    if not any(t["role"] == "user" for t in session.history) and not session.diagram:
        return {
            "overall_score": 0,
            "summary": (
                "This session ended before you engaged with the interviewer. Start a fresh "
                "round, ask clarifying questions, talk through your design, and sketch on the "
                "whiteboard to get a full scored debrief."
            ),
            "dimensions": [],
            "strengths": [],
            "improvements": [
                "Begin by clarifying the functional and non-functional requirements.",
                "Think out loud and sketch your high-level design on the whiteboard.",
            ],
        }
    user_content: list[dict] = [
        {
            "type": "text",
            "text": (
                f"Problem: {session.problem}\n\n"
                f"Transcript:\n{_transcript(session)}\n\n"
                "Grade the candidate now."
            ),
        }
    ]
    if session.diagram:
        user_content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{session.diagram}"},
            }
        )
    messages = [
        {"role": "system", "content": SCORING_SYSTEM},
        {"role": "user", "content": user_content},
    ]
    raw = await llm.score_json(messages)
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {
            "overall_score": 0,
            "summary": "Could not generate a report for this session.",
            "dimensions": [],
            "strengths": [],
            "improvements": [],
        }
