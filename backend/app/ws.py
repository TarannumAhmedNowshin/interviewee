import asyncio
import base64
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app import orchestrator
from app.db import repo
from app.services import stt, tts

log = logging.getLogger("interview.ws")
router = APIRouter()


async def _persist(coro) -> None:
    """Best-effort DB write; never let persistence break a live interview."""
    try:
        await coro
    except Exception:
        log.exception("persist failed")


@router.websocket("/ws/interview/{session_id}")
async def interview(ws: WebSocket, session_id: str) -> None:
    await ws.accept()
    session = orchestrator.get_or_create(session_id)
    await ws.send_json({"type": "session", "session_id": session_id, "problem": session.problem})
    await _persist(repo.create_session(session_id, session.problem))

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
                await respond(opening=True)
            elif msg_type == "user_message":
                text = (data.get("text") or "").strip()
                if not text:
                    continue
                await cancel_current()
                session.history.append({"role": "user", "content": text})
                await _persist(repo.add_turn(session_id, len(session.history) - 1, "user", text))
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
                await _persist(repo.add_turn(session_id, len(session.history) - 1, "user", text))
                await respond(opening=False)
            elif msg_type == "interrupt":
                await cancel_current()
                await ws.send_json({"type": "interrupted"})
            elif msg_type == "set_voice":
                session.voice_enabled = bool(data.get("enabled", True))
            elif msg_type == "diagram":
                session.diagram = data.get("data") or None
                await _persist(repo.update_diagram(session_id, session.diagram))
            elif msg_type == "finish":
                await cancel_current()
                await ws.send_json({"type": "evaluating"})
                try:
                    report = await orchestrator.evaluate(session)
                except Exception:
                    log.exception("evaluate failed")
                    await ws.send_json({"type": "feedback_error"})
                    continue
                await ws.send_json({"type": "feedback", "report": report})
                await _persist(repo.save_report(session_id, report, session.stage))
            elif msg_type == "end":
                await cancel_current()
                await ws.send_json({"type": "ended"})
                await ws.close()
                return
    except WebSocketDisconnect:
        await cancel_current()
        log.info("client disconnected: %s", session_id)


async def _safe_emit(ws: WebSocket, session, *, opening: bool) -> None:
    try:
        await _emit(ws, session, opening=opening)
    except asyncio.CancelledError:
        raise
    except Exception:
        log.exception("emit failed")


async def _emit(ws: WebSocket, session, *, opening: bool) -> None:
    if opening:
        state = {"stage": "intro", "move": "open", "note": "greet and pose the problem"}
        stream = orchestrator.stream_opening(session)
    else:
        state = await orchestrator.decide(session)
        stream = orchestrator.stream_reply(session, state["move"], state["stage"])

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
            repo.add_turn(
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
