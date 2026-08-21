"""WebSocket for the Live Mock Coding Interview (Pillar 3).

Protocol (client -> server): start {problem_id, language}, user_message {text},
audio {data, filename}, code {code, language, seconds_left}, interrupt, set_voice
{enabled}, finish, end.
"""

import asyncio
import base64
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app import mock_orchestrator as orch
from app.db import repo
from app.services import stt, tts

log = logging.getLogger("interview.mock_ws")
router = APIRouter()


async def _persist(coro) -> None:
    """Best-effort DB write; never let persistence break a live interview."""
    try:
        await coro
    except Exception:
        log.exception("persist failed")


@router.websocket("/ws/mock/{session_id}")
async def mock(ws: WebSocket, session_id: str) -> None:
    await ws.accept()
    session = orch.get_or_create(session_id)

    current: asyncio.Task | None = None

    async def cancel_current() -> None:
        nonlocal current
        if current and not current.done():
            current.cancel()
            try:
                await current
            except asyncio.CancelledError:
                pass
        current = None

    async def respond(*, opening: bool) -> None:
        nonlocal current
        await cancel_current()
        current = asyncio.create_task(_safe_emit(ws, session, opening=opening))

    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")
            if msg_type == "start":
                orch.configure(
                    session, data.get("problem_id") or "", data.get("language") or "python"
                )
                await ws.send_json(
                    {
                        "type": "session",
                        "session_id": session_id,
                        "problem_id": session.problem_id,
                        "problem_title": session.problem_title,
                        "prompt": session.prompt,
                    }
                )
                await _persist(
                    repo.create_mock_session(
                        session_id, session.problem_id, session.problem_title, session.language
                    )
                )
                await respond(opening=True)
            elif msg_type == "code":
                session.code = data.get("code") or ""
                if data.get("language"):
                    session.language = data["language"]
                if data.get("seconds_left") is not None:
                    session.seconds_left = int(data["seconds_left"])
                await _persist(repo.update_mock_code(session_id, session.language, session.code))
            elif msg_type == "user_message":
                text = (data.get("text") or "").strip()
                if not text:
                    continue
                await cancel_current()
                session.history.append({"role": "user", "content": text})
                await _persist(
                    repo.add_mock_turn(session_id, len(session.history) - 1, "user", text)
                )
                await respond(opening=False)
            elif msg_type == "audio":
                audio = base64.b64decode(data.get("data") or "")
                if not audio:
                    continue
                await cancel_current()  # barge-in: stop any in-flight reply
                try:
                    text = (await stt.transcribe(audio, data.get("filename", "audio.webm"))).strip()
                except Exception:
                    log.exception("stt failed")
                    await ws.send_json({"type": "stt_error"})
                    continue
                if not text:
                    await ws.send_json({"type": "stt_empty"})
                    continue
                await ws.send_json({"type": "transcript", "text": text})
                session.history.append({"role": "user", "content": text})
                await _persist(
                    repo.add_mock_turn(session_id, len(session.history) - 1, "user", text)
                )
                await respond(opening=False)
            elif msg_type == "interrupt":
                await cancel_current()
                await ws.send_json({"type": "interrupted"})
            elif msg_type == "set_voice":
                session.voice_enabled = bool(data.get("enabled", True))
            elif msg_type == "finish":
                await cancel_current()
                await ws.send_json({"type": "evaluating"})
                try:
                    report = await orch.evaluate(session)
                except Exception:
                    log.exception("evaluate failed")
                    await ws.send_json({"type": "feedback_error"})
                    continue
                await ws.send_json({"type": "feedback", "report": report})
                await _persist(repo.save_mock_report(session_id, report))
            elif msg_type == "end":
                await cancel_current()
                await ws.send_json({"type": "ended"})
                await ws.close()
                return
    except WebSocketDisconnect:
        await cancel_current()
        log.info("mock client disconnected: %s", session_id)


async def _safe_emit(ws: WebSocket, session, *, opening: bool) -> None:
    try:
        await _emit(ws, session, opening=opening)
    except asyncio.CancelledError:
        raise
    except Exception:
        log.exception("emit failed")


async def _emit(ws: WebSocket, session, *, opening: bool) -> None:
    if opening:
        state = {"stage": "intro", "move": "pose_problem", "note": "greet and pose the problem"}
        stream = orch.stream_opening(session)
    else:
        state = await orch.decide(session)
        stream = orch.stream_reply(session, state["move"], state["stage"])

    await ws.send_json({"type": "state", **state})
    full = ""
    saved = False
    try:
        async for delta in stream:
            full += delta
            await ws.send_json({"type": "assistant_delta", "text": delta})
    except asyncio.CancelledError:
        if full.strip():
            session.history.append({"role": "assistant", "content": full})
            saved = True
        raise
    if full.strip() and not saved:
        session.history.append({"role": "assistant", "content": full})
    if full.strip():
        await _persist(
            repo.add_mock_turn(
                session.id,
                len(session.history) - 1,
                "assistant",
                full,
                state.get("stage"),
                state.get("move"),
            )
        )
    await ws.send_json({"type": "assistant_done", "text": full})
    if session.voice_enabled and full.strip():
        await _speak(ws, full)


async def _speak(ws: WebSocket, text: str) -> None:
    try:
        audio = await tts.synthesize(text)
    except asyncio.CancelledError:
        raise
    except Exception:
        log.exception("tts synthesis failed")
        return
    await ws.send_json({"type": "audio_chunk", "data": base64.b64encode(audio).decode("ascii")})
