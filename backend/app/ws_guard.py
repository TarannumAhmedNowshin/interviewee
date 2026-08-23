"""Shared WebSocket connection guard (Point 4).

A per-client-IP cap on NEW WebSocket connections. Each conversational pillar opens
a socket that then drives paid LLM / Whisper / TTS calls, and the client
auto-reconnects on drop — so an endless reconnect loop (or many tabs) is the real
runaway-cost risk. This caps the connection rate. Full per-message limiting is
intentionally omitted: this is a local, single-user tool and the connect cap plus
the HTTP limiter already bound the spend.
"""

import logging

from fastapi import WebSocket

from app.config import get_settings
from app.rate_limit import RateLimiter

log = logging.getLogger("interview.ws_guard")
_settings = get_settings()
_connect_limiter = RateLimiter(_settings.ws_connections_per_minute, 60.0)

WS_TRY_LATER = 1013  # RFC 6455 "Try Again Later" — the correct close code for rate limiting.


async def accept_within_limit(ws: WebSocket) -> bool:
    """Accept the socket, then close it if the client is over its connection budget.

    Returns True if the caller should proceed, False if the socket was closed.
    """
    await ws.accept()
    client = ws.client.host if ws.client else "unknown"
    if not _connect_limiter.allow(client):
        log.warning("ws connection rate-limited: %s", client)
        await ws.close(code=WS_TRY_LATER)
        return False
    return True
