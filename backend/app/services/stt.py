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


async def transcribe(audio: bytes, filename: str = "audio.webm") -> str:
    """Transcribe an audio clip with the Azure Whisper deployment; returns plain text."""
    result = await _client().audio.transcriptions.create(
        model=settings.whisper_deployment,
        file=(filename, audio),
    )
    return (result.text or "").strip()
