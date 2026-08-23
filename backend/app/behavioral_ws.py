"""WebSocket for the Behavioral Voice Round (Pillar 4).

Protocol (client -> server): start {question_id}, user_message {text},
audio {data, filename}, interrupt, set_voice {enabled}, finish, end.
Reuses the same voice pipeline (TTS + Whisper STT + client VAD + barge-in).
"""

import asyncio
import base64
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app import behavioral_orchestrator as orch
from app.db import repo
from app.services import stt, tts
from app.ws_guard import accept_within_limit

log = logging.getLogger("interview.behavioral_ws")
router = APIRouter()


async def _persist(coro) -> None:
    """Best-effort DB write; never let persistence break a live interview."""
    try:
        await coro
    except Exception:
        log.exception("persist failed")


@router.websocket("/ws/behavioral/{session_id}")
async def behavioral(ws: WebSocket, session_id: str) -> None:
    if not await accept_within_limit(ws):
        return
    session = await orch.get_or_create(session_id)

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
                orch.configure(session, data.get("question_id") or "")
                await ws.send_json(
                    {
                        "type": "session",
                        "session_id": session_id,
                        "question_id": session.question_id,
                        "question_title": session.question_title,
                        "question": session.question,
                        "category": session.category,
                    }
                )
                await _persist(
                    repo.create_behavioral_session(
                        session_id, session.question_id, session.question_title, session.category
                    )
                )
                await respond(opening=True)
            elif msg_type == "user_message":
                text = (data.get("text") or "").strip()
                if not text:
                    continue
                await cancel_current()
                session.history.append({"role": "user", "content": text})
                await _persist(
                    repo.add_behavioral_turn(session_id, len(session.history) - 1, "user", text)
                )
                await respond(opening=False)
            elif msg_type == "audio":
                audio = base64.b64decode(data.get("data") or "")
                if not audio:
                    continue
                try:
                    text = (await stt.transcribe(audio, data.get("filename", "audio.webm"))).strip()
                except Exception:
                    log.exception("stt failed")
                    await ws.send_json({"type": "stt_error"})
                    continue
                if not text:
                    await ws.send_json({"type": "stt_empty"})
                    continue
                # Only real speech interrupts the in-flight reply (empty/phantom clips must not).
                await cancel_current()
                await ws.send_json({"type": "transcript", "text": text})
                session.history.append({"role": "user", "content": text})
                await _persist(
                    repo.add_behavioral_turn(session_id, len(session.history) - 1, "user", text)
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
                await _persist(repo.save_behavioral_report(session_id, report))
            elif msg_type == "end":
                await cancel_current()
                await ws.send_json({"type": "ended"})
                await ws.close()
                return
    except WebSocketDisconnect:
        await cancel_current()
        log.info("behavioral client disconnected: %s", session_id)


async def _safe_emit(ws: WebSocket, session, *, opening: bool) -> None:
    try:
        await _emit(ws, session, opening=opening)
    except asyncio.CancelledError:
        raise
    except Exception:
        log.exception("emit failed")


async def _emit(ws: WebSocket, session, *, opening: bool) -> None:
    if opening:
        state = {"stage": "intro", "move": "ask_question", "note": "greet and ask the question"}
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
            repo.add_behavioral_turn(
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
