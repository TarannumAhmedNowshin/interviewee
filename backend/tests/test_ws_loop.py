"""WebSocket interview-loop tests with the LLM / STT / TTS / DB adapters mocked.

These exercise the actual agentic turn loop end-to-end over a real WebSocket
(via TestClient) without any network, model, or database: the seams that exist
precisely for this are stubbed, and we assert the stage/move progression and the
final scored report. Run from backend/:  python -m pytest
"""

import json

from fastapi.testclient import TestClient

from app.db import repo
from app.main import app
from app.services import llm, stt, tts


async def _fake_stream(messages):
    for token in ("Hello", " there"):
        yield token


async def _fake_decide(messages):
    return json.dumps({"stage": "requirements", "move": "probe_deeper", "note": "dig in"})


async def _fake_decide_mock(messages):
    return json.dumps({"stage": "approach", "move": "probe_approach", "note": "plan first"})


async def _fake_score(messages):
    return json.dumps(
        {
            "overall_score": 4.0,
            "summary": "Solid.",
            "dimensions": [],
            "strengths": ["clear"],
            "improvements": ["go deeper"],
        }
    )


async def _fake_tts(text):
    return b"\x00"


async def _fake_stt(audio, filename):
    return "here is my spoken answer"


async def _anoop(*args, **kwargs):
    return None


def _stub_common(monkeypatch):
    monkeypatch.setattr(llm, "stream_interviewer", _fake_stream)
    monkeypatch.setattr(llm, "score_json", _fake_score)
    monkeypatch.setattr(tts, "synthesize", _fake_tts)
    monkeypatch.setattr(stt, "transcribe", _fake_stt)
    for name in (
        "create_session",
        "add_turn",
        "save_report",
        "update_diagram",
        "get_session",
        "create_mock_session",
        "add_mock_turn",
        "update_mock_code",
        "save_mock_report",
        "get_mock_session",
    ):
        monkeypatch.setattr(repo, name, _anoop)


def _drain_until(ws, target, limit=60):
    out = []
    for _ in range(limit):
        msg = ws.receive_json()
        out.append(msg)
        if msg.get("type") == target:
            return out
    raise AssertionError(f"never saw {target!r}; got {[m.get('type') for m in out]}")


def test_interview_loop_progresses_and_scores(monkeypatch):
    _stub_common(monkeypatch)
    monkeypatch.setattr(llm, "decide_json", _fake_decide)
    client = TestClient(app)

    with client.websocket_connect("/ws/interview/loop-design-1") as ws:
        session = ws.receive_json()
        assert session["type"] == "session"
        assert session["problem"]  # a design problem was assigned

        ws.send_json({"type": "set_voice", "enabled": False})
        ws.send_json({"type": "start"})
        opening = _drain_until(ws, "assistant_done")
        assert opening[0]["type"] == "state"
        assert opening[0]["stage"] == "intro"
        assert any(m["type"] == "assistant_delta" for m in opening)
        assert opening[-1]["text"] == "Hello there"

        # A candidate turn — the director should advance the stage/move.
        ws.send_json({"type": "user_message", "text": "What is the expected scale?"})
        turn = _drain_until(ws, "assistant_done")
        state = next(m for m in turn if m["type"] == "state")
        assert state["stage"] == "requirements"
        assert state["move"] == "probe_deeper"

        # Finishing yields an evaluating signal then a scored report.
        ws.send_json({"type": "finish"})
        finish = _drain_until(ws, "feedback")
        assert any(m["type"] == "evaluating" for m in finish)
        assert finish[-1]["report"]["overall_score"] == 4.0


def test_seeded_design_problem_via_query_param(monkeypatch):
    _stub_common(monkeypatch)
    monkeypatch.setattr(llm, "decide_json", _fake_decide)
    client = TestClient(app)

    with client.websocket_connect("/ws/interview/loop-seed-1?problem=ride-hailing") as ws:
        session = ws.receive_json()
        assert "ride-hailing backend" in session["problem"].lower()


def test_mock_loop_starts_and_progresses(monkeypatch):
    _stub_common(monkeypatch)
    monkeypatch.setattr(llm, "decide_json", _fake_decide_mock)
    client = TestClient(app)

    with client.websocket_connect("/ws/mock/loop-mock-1") as ws:
        ws.send_json({"type": "set_voice", "enabled": False})
        ws.send_json({"type": "start", "problem_id": "two-sum", "language": "python"})
        session = _drain_until(ws, "session")
        assert session[-1]["problem_id"] == "two-sum"

        opening = _drain_until(ws, "assistant_done")
        assert opening[0]["type"] == "state"
        assert opening[-1]["text"] == "Hello there"

        ws.send_json({"type": "user_message", "text": "I'll use a hash map."})
        turn = _drain_until(ws, "assistant_done")
        state = next(m for m in turn if m["type"] == "state")
        assert state["stage"] == "approach"
        assert state["move"] == "probe_approach"
