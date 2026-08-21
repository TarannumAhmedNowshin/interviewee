"""Sandboxed code execution via a self-hosted Piston instance."""

import httpx

from app.config import get_settings

settings = get_settings()

# Candidate language -> Piston language name.
LANG_MAP = {
    "python": "python",
    "c": "c",
    "cpp": "c++",
    "c++": "c++",
    "javascript": "javascript",
    "js": "javascript",
}
# Piston language -> source filename (extension matters for compiled languages).
FILENAME = {
    "python": "main.py",
    "c": "main.c",
    "c++": "main.cpp",
    "javascript": "main.js",
}

_runtimes: list[dict] | None = None


async def _load_runtimes() -> list[dict]:
    global _runtimes
    if _runtimes is None:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.piston_url}/api/v2/runtimes")
            resp.raise_for_status()
            _runtimes = resp.json()
    return _runtimes


async def _resolve_version(piston_lang: str) -> str | None:
    for rt in await _load_runtimes():
        if rt.get("language") == piston_lang or piston_lang in rt.get("aliases", []):
            return rt.get("version")
    return None


async def execute(language: str, source: str, stdin: str = "", run_timeout_ms: int = 3000) -> dict:
    """Run a single source file against optional stdin. Never raises for user-code errors."""
    lang = LANG_MAP.get(language.lower())
    if not lang:
        return {"ok": False, "error": f"unsupported language: {language}"}
    version = await _resolve_version(lang)
    if not version:
        return {"ok": False, "error": f"runtime not installed: {lang}"}

    payload = {
        "language": lang,
        "version": version,
        "files": [{"name": FILENAME.get(lang, "main.txt"), "content": source}],
        "stdin": stdin,
        "run_timeout": run_timeout_ms,
        "compile_timeout": 10000,
    }
    try:
        async with httpx.AsyncClient(timeout=40) as client:
            resp = await client.post(f"{settings.piston_url}/api/v2/execute", json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        return {"ok": False, "error": f"executor error: {e}"}

    run = data.get("run") or {}
    compile_ = data.get("compile") or {}
    return {
        "ok": True,
        "stdout": run.get("stdout", ""),
        "stderr": run.get("stderr", ""),
        "code": run.get("code"),
        "signal": run.get("signal"),
        "compile_stderr": compile_.get("stderr", ""),
    }
