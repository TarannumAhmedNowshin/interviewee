"""In-memory store for live sessions with TTL + capacity eviction.

The orchestrators keep hot session state in memory for the fast path. Left
unbounded that dict only ever grows — one entry per session, never removed — so
long uptime leaks memory. This adds lazy idle-TTL expiry and an LRU capacity cap.
Full session state still lives in Postgres, so an evicted session simply
rehydrates from the DB on the next connect.
"""

from __future__ import annotations

import time
from collections import OrderedDict

DEFAULT_TTL_SECONDS = 6 * 3600  # a session idle this long is dropped from memory
DEFAULT_MAX_SIZE = 500  # hard cap on concurrently cached sessions


class SessionStore[T]:
    """A dict-like LRU cache keyed by session id, with idle-time expiry."""

    def __init__(
        self, *, max_size: int = DEFAULT_MAX_SIZE, ttl_seconds: int = DEFAULT_TTL_SECONDS
    ) -> None:
        self._data: OrderedDict[str, tuple[float, T]] = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl_seconds

    def get(self, key: str) -> T | None:
        item = self._data.get(key)
        if item is None:
            return None
        ts, value = item
        if time.monotonic() - ts > self._ttl:
            del self._data[key]
            return None
        self._data[key] = (time.monotonic(), value)  # refresh idle timer
        self._data.move_to_end(key)
        return value

    def set(self, key: str, value: T) -> None:
        self._prune_expired()
        self._data[key] = (time.monotonic(), value)
        self._data.move_to_end(key)
        while len(self._data) > self._max_size:
            self._data.popitem(last=False)  # evict least-recently-used

    def __contains__(self, key: str) -> bool:
        return self.get(key) is not None

    def __len__(self) -> int:
        return len(self._data)

    def _prune_expired(self) -> None:
        now = time.monotonic()
        expired = [k for k, (ts, _) in self._data.items() if now - ts > self._ttl]
        for k in expired:
            del self._data[k]
