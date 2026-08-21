"""Turn logic for the Live Mock Coding Interview (Pillar 3).

Mirrors app/orchestrator.py but for a live coding round: the interviewer watches
the candidate's editor (sent as text, not vision) and the director picks a move
appropriate to a coding interview, aware of the time remaining.
"""

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from app import arena_problems
from app.mock_interviewer import (
    DIRECTOR_SYSTEM,
    INTERVIEWER_SYSTEM,
    MOVES,
    SCORING_SYSTEM,
    STAGES,
)
from app.services import llm


@dataclass
class MockSession:
    id: str
    problem_id: str = ""
    problem_title: str = ""
    prompt: str = ""
    language: str = "python"
    stage: str = "intro"
    voice_enabled: bool = True
    code: str = ""
    seconds_left: int | None = None
    history: list[dict] = field(default_factory=list)


_SESSIONS: dict[str, MockSession] = {}


def get_or_create(session_id: str) -> MockSession:
    if session_id not in _SESSIONS:
        _SESSIONS[session_id] = MockSession(id=session_id)
    return _SESSIONS[session_id]


def configure(session: MockSession, problem_id: str, language: str) -> None:
    """Load the chosen problem into the session (called on `start`)."""
    problem = arena_problems.get(problem_id) or arena_problems.PROBLEMS[0]
    session.problem_id = problem["id"]
    session.problem_title = problem["title"]
    session.prompt = problem["prompt"]
    session.language = language if language in problem["starter"] else "python"


def _transcript(session: MockSession) -> str:
    if not session.history:
        return "(no messages yet)"
    lines = []
    for turn in session.history:
        who = "Candidate" if turn["role"] == "user" else "Interviewer"
        lines.append(f"{who}: {turn['content']}")
    return "\n".join(lines)


def _code_block(session: MockSession) -> str:
    code = session.code.strip()
    if not code:
        return "The candidate's editor is currently empty."
    return f"The candidate's current {session.language} code:\n```\n{code}\n```"


def _time_hint(session: MockSession) -> str:
    if session.seconds_left is None:
        return "Time remaining: unknown."
    mins = session.seconds_left // 60
    if session.seconds_left <= 0:
        return "Time is up — wrap up now."
    if mins <= 3:
        return f"Time remaining: ~{mins} min — time is short, steer toward finishing."
    return f"Time remaining: ~{mins} min."


async def decide(session: MockSession) -> dict:
    """The gpt-5-mini director picks the next stage + move for this turn."""
    user = (
        f"Problem: {session.problem_title} — {session.prompt}\n\n"
        f"Current stage: {session.stage}\n"
        f"{_time_hint(session)}\n\n"
        f"{_code_block(session)}\n\n"
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
    move = data.get("move") if data.get("move") in MOVES else "probe_approach"
    session.stage = stage
    return {"stage": stage, "move": move, "note": data.get("note", "")}


async def stream_opening(session: MockSession) -> AsyncIterator[str]:
    system = (
        f"{INTERVIEWER_SYSTEM}\n\n"
        f"The problem: {session.problem_title} — {session.prompt}\n\n"
        "Open the interview now: greet the candidate in one sentence, state the problem in your "
        "own words, and invite them to ask clarifying questions or talk through their approach "
        "before coding. 2-3 sentences maximum."
    )
    async for delta in llm.stream_interviewer([{"role": "system", "content": system}]):
        yield delta


async def stream_reply(session: MockSession, move: str, stage: str) -> AsyncIterator[str]:
    system = (
        f"{INTERVIEWER_SYSTEM}\n\n"
        f"The problem the candidate is solving: {session.problem_title} — {session.prompt}\n\n"
        f"Current stage: {stage}\n"
        f"Your move this turn: {move}\n"
        f"{_time_hint(session)}\n\n"
        f"{_code_block(session)}\n\n"
        "Respond in 1-3 natural spoken sentences, reacting to what you see."
    )
    messages: list[dict] = [{"role": "system", "content": system}, *session.history]
    async for delta in llm.stream_interviewer(messages):
        yield delta


async def evaluate(session: MockSession) -> dict:
    """Grade the whole interview with gpt-5 against a rubric; returns the report dict."""
    # A live mock interview needs conversation; the editor starts with boilerplate, so the
    # real "didn't engage" signal is zero candidate messages (not an empty editor).
    if not any(t["role"] == "user" for t in session.history):
        return {
            "overall_score": 0,
            "summary": (
                "This round ended before you engaged with the interviewer. Start a fresh round, "
                "talk through your approach, and write your solution in the editor to get a full "
                "scored debrief."
            ),
            "dimensions": [],
            "strengths": [],
            "improvements": [
                "Explain your approach and trade-offs before you start coding.",
                "Write your solution in the editor so the interviewer can react to it.",
            ],
        }
    code = session.code.strip() or "(the editor was left empty)"
    user = (
        f"Problem: {session.problem_title} — {session.prompt}\n\n"
        f"Language: {session.language}\n\n"
        f"Candidate's final code:\n```\n{code}\n```\n\n"
        f"Transcript:\n{_transcript(session)}\n\n"
        "Grade the candidate now."
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
