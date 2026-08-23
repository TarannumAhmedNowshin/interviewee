"""Lightweight in-memory rate limiting (Point 4).

Single-process, per-client fixed-window counters. This is NOT a distributed
limiter — it exists so a runaway client or a reconnect loop can't spend unbounded
LLM / Whisper / TTS quota on this local, single-instance deployment. Set the
limits to 0 in config to disable.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque


class RateLimiter:
    """Sliding-window limiter: at most ``max_events`` per ``window_seconds`` per key."""

    def __init__(self, max_events: int, window_seconds: float) -> None:
        self.max = max_events
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        if self.max <= 0:  # disabled
            return True
        now = time.monotonic()
        cutoff = now - self.window
        q = self._hits[key]
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= self.max:
            return False
        q.append(now)
        return True
