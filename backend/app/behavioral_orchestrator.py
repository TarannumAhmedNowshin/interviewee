"""Turn logic for the Behavioral Voice Round (Pillar 4).

Mirrors app/mock_orchestrator.py but for a spoken behavioral interview: no editor
and no clock — the director walks the candidate through a STAR answer and the
interviewer reacts to what they say.
"""

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from app import behavioral_questions
from app.behavioral_interviewer import (
    DIRECTOR_SYSTEM,
    INTERVIEWER_SYSTEM,
    MOVES,
    SCORING_SYSTEM,
    STAGES,
)
from app.db import repo
from app.services import llm


@dataclass
class BehavioralSession:
    id: str
    question_id: str = ""
    question_title: str = ""
    question: str = ""
    category: str = ""
    stage: str = "intro"
    voice_enabled: bool = True
    history: list[dict] = field(default_factory=list)


_SESSIONS: dict[str, BehavioralSession] = {}


async def get_or_create(session_id: str) -> BehavioralSession:
    if session_id not in _SESSIONS:
        session = BehavioralSession(id=session_id)
        await _try_rehydrate(session)
        _SESSIONS[session_id] = session
    return _SESSIONS[session_id]


async def _try_rehydrate(session: BehavioralSession) -> None:
    """Restore a live session's context from the DB (e.g. after a backend restart)."""
    try:
        data = await repo.get_behavioral_session(session.id)
    except Exception:
        return
    if not data or data.get("status") == "ended":
        return
    q = behavioral_questions.get(data.get("question_id") or "")
    if q:
        session.question_id = q["id"]
        session.question_title = q["title"]
        session.question = q["prompt"]
        session.category = q["category"]
    session.history = [{"role": t["role"], "content": t["text"]} for t in data.get("turns", [])]
    for turn in reversed(data.get("turns", [])):
        if turn.get("stage"):
            session.stage = turn["stage"]
            break


def configure(session: BehavioralSession, question_id: str) -> None:
    """Load the chosen question into the session (called on `start`)."""
    q = behavioral_questions.get(question_id) or behavioral_questions.QUESTIONS[0]
    session.question_id = q["id"]
    session.question_title = q["title"]
    session.question = q["prompt"]
    session.category = q["category"]


def _transcript(session: BehavioralSession) -> str:
    if not session.history:
        return "(no messages yet)"
    lines = []
    for turn in session.history:
        who = "Candidate" if turn["role"] == "user" else "Interviewer"
        lines.append(f"{who}: {turn['content']}")
    return "\n".join(lines)


async def decide(session: BehavioralSession) -> dict:
    """The gpt-5-mini director picks the next stage + move for this turn."""
    user = (
        f"Question: {session.question}\n\n"
        f"Current stage: {session.stage}\n\n"
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
    move = data.get("move") if data.get("move") in MOVES else "probe_situation"
    session.stage = stage
    return {"stage": stage, "move": move, "note": data.get("note", "")}


async def stream_opening(session: BehavioralSession) -> AsyncIterator[str]:
    system = (
        f"{INTERVIEWER_SYSTEM}\n\n"
        f"The behavioral question for this round: {session.question}\n\n"
        "Open the interview now: greet the candidate warmly in one sentence, then ask them the "
        "question in your own natural words. 2-3 sentences maximum."
    )
    async for delta in llm.stream_interviewer([{"role": "system", "content": system}]):
        yield delta


async def stream_reply(session: BehavioralSession, move: str, stage: str) -> AsyncIterator[str]:
    system = (
        f"{INTERVIEWER_SYSTEM}\n\n"
        f"The behavioral question the candidate is answering: {session.question}\n\n"
        f"Current stage: {stage}\n"
        f"Your move this turn: {move}\n\n"
        "Respond in 1-3 natural spoken sentences, reacting to what the candidate just said."
    )
    messages: list[dict] = [{"role": "system", "content": system}, *session.history]
    async for delta in llm.stream_interviewer(messages):
        yield delta


async def evaluate(session: BehavioralSession) -> dict:
    """Grade the behavioral answer with gpt-5 against a STAR rubric; returns the report dict."""
    if not any(t["role"] == "user" for t in session.history):
        return {
            "overall_score": 0,
            "summary": (
                "This round ended before you answered. Start a fresh round and walk through a "
                "real example — the situation, what you did, and the result — to get a full "
                "scored debrief."
            ),
            "dimensions": [],
            "strengths": [],
            "improvements": [
                "Answer with a specific, real example rather than a general statement.",
                "Cover the full story: situation, your actions, and the measurable result.",
            ],
        }
    user = (
        f"Question: {session.question}\n\n"
        f"Transcript:\n{_transcript(session)}\n\n"
        "Grade the candidate's behavioral answer now."
    )
    messages = [
        {"role": "system", "content": SCORING_SYSTEM},
        {"role": "user", "content": user},
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
