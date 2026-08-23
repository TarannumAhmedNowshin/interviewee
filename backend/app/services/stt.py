import re
from functools import lru_cache

from openai import AsyncAzureOpenAI

from app.config import get_settings

settings = get_settings()


def _openai_endpoint(raw: str | None) -> str:
    """Derive an Azure OpenAI-style endpoint from whatever WHISPER_ENDPOINT is set to.

    A Foundry *project* URL (…services.ai.azure.com/api/projects/…) can't be used by the
    OpenAI SDK directly, so we map it to the resource's cognitiveservices endpoint.
    """
    if not raw:
        return ""
    raw = raw.strip().rstrip("/")
    m = re.match(r"https://([^.]+)\.services\.ai\.azure\.com", raw)
    if m:
        return f"https://{m.group(1)}.cognitiveservices.azure.com"
    m = re.match(r"(https://[^/]+)", raw)
    return m.group(1) if m else raw


@lru_cache
def _client() -> AsyncAzureOpenAI:
    return AsyncAzureOpenAI(
        azure_endpoint=_openai_endpoint(settings.whisper_endpoint),
        api_key=settings.whisper_key or "",
        api_version=settings.whisper_api_version,
    )


# Whisper hallucinates on silent/near-silent audio — emojis, music notes, or stock phrases
# ("thank you", Korean "감사합니다", etc.). Force English decoding and drop the junk.
_SYMBOL_RE = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF"
    "\u2190-\u21FF\u2B00-\u2BFF\u2669-\u266F\uFE0F\u200D]+"
)
_HALLUCINATIONS = {"you", "thank you", "thanks for watching", "please subscribe", "bye"}


def _clean_transcript(text: str) -> str:
    cleaned = _SYMBOL_RE.sub("", text or "").strip()
    if not any(ch.isalnum() for ch in cleaned):
        return ""  # only emojis/symbols survived → treat as silence
    key = re.sub(r"[^\w\s]", "", cleaned).strip().lower()
    return "" if key in _HALLUCINATIONS else cleaned


async def transcribe(audio: bytes, filename: str = "audio.webm") -> str:
    """Transcribe an audio clip with the Azure Whisper deployment; returns plain text."""
    result = await _client().audio.transcriptions.create(
        model=settings.whisper_deployment,
        file=(filename, audio),
        language="en",  # force English; avoids Korean/other-language silence hallucinations
        temperature=0,
    )
    return _clean_transcript(result.text or "")
