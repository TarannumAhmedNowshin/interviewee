"""Deterministic orchestrator / bank logic tests — no LLM, DB, or sandbox calls.

The empty-session `evaluate` paths short-circuit before any model call, so they
are safe to run offline. Run from backend/:  python -m pytest
"""

import asyncio

from app import arena_problems, behavioral_questions
from app import behavioral_orchestrator as beh
from app import mock_orchestrator as mock
from app.arena import _normalize


def test_arena_normalize_trims_trailing_space_and_blank_lines():
    assert _normalize("a \nb  \n") == "a\nb"
    assert _normalize("  x  ") == "x"
    assert _normalize("") == ""


def test_behavioral_question_bank():
    summary = behavioral_questions.public_summary()
    assert len(summary) == 8
    assert all({"id", "title", "category", "tags"} <= set(q) for q in summary)
    assert behavioral_questions.get("conflict")["title"] == "Team Conflict"
    assert behavioral_questions.get("does-not-exist") is None


def test_arena_problem_bank():
    assert len(arena_problems.public_summary()) >= 1
    assert arena_problems.get("two-sum") is not None
    assert arena_problems.get("nope") is None


def test_behavioral_configure_loads_prompt_and_falls_back():
    s = beh.BehavioralSession(id="t1")
    beh.configure(s, "failure")
    assert s.question_id == "failure"
    assert s.question  # prompt text loaded
    assert s.category

    fallback = beh.BehavioralSession(id="t2")
    beh.configure(fallback, "not-a-real-question")
    assert fallback.question_id == behavioral_questions.QUESTIONS[0]["id"]


def test_behavioral_empty_session_gets_friendly_report():
    s = beh.BehavioralSession(id="t3")
    beh.configure(s, "conflict")
    report = asyncio.run(beh.evaluate(s))
    assert report["overall_score"] == 0
    assert report["dimensions"] == []
    assert report["improvements"]  # actionable tips present


def test_mock_empty_session_is_friendly_even_with_starter_code():
    s = mock.MockSession(id="t4")
    mock.configure(s, "two-sum", "python")
    s.code = "def two_sum(nums, target):\n    pass"  # starter-like, no conversation
    report = asyncio.run(mock.evaluate(s))
    assert report["overall_score"] == 0
    assert report["dimensions"] == []


def test_mock_transcript_and_code_block_helpers():
    s = mock.MockSession(id="t5")
    assert "no messages yet" in mock._transcript(s)
    s.history.append({"role": "user", "content": "hello"})
    s.history.append({"role": "assistant", "content": "hi"})
    transcript = mock._transcript(s)
    assert "Candidate: hello" in transcript
    assert "Interviewer: hi" in transcript

    assert "empty" in mock._code_block(s).lower()
    s.code = "print(1)"
    assert "print(1)" in mock._code_block(s)


def test_mock_time_hint_bands():
    s = mock.MockSession(id="t6")
    assert "unknown" in mock._time_hint(s).lower()
    s.seconds_left = 0
    assert "up" in mock._time_hint(s).lower()
    s.seconds_left = 90
    assert "short" in mock._time_hint(s).lower()
    s.seconds_left = 600
    assert "min" in mock._time_hint(s).lower()
