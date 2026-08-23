// Persist a per-room session id so a page refresh RESUMES the same interview
// instead of silently starting a brand-new one (Point 1). The key includes the
// pathname + query, so each problem/room gets its own id and different problems
// never collide, while a refresh of the same room reconnects to the same session.

const PREFIX = "iw:sid:";

function scopeKey(): string {
  if (typeof window === "undefined") return PREFIX;
  return PREFIX + window.location.pathname + window.location.search;
}

export function getPersistentSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const key = scopeKey();
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID(); // private mode / storage disabled — fall back to ephemeral
  }
}

export function clearPersistentSessionId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(scopeKey());
  } catch {
    // ignore
  }
}
