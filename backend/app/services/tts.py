from xml.sax.saxutils import escape

import httpx

from app.config import get_settings

settings = get_settings()

# 24 kHz MP3 keeps latency and payload low while sounding natural in the browser.
_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"


def _ssml(text: str, voice: str) -> str:
    return (
        "<speak version='1.0' xml:lang='en-US'>"
        f"<voice name='{voice}'>{escape(text)}</voice>"
        "</speak>"
    )


async def synthesize(text: str) -> bytes:
    """Synthesize speech via the Azure AI Speech REST endpoint; returns MP3 bytes."""
    region = settings.azure_speech_region
    url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    headers = {
        "Ocp-Apim-Subscription-Key": settings.azure_speech_key or "",
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": _OUTPUT_FORMAT,
        "User-Agent": "interviewwee",
    }
    ssml = _ssml(text, settings.azure_speech_voice)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, headers=headers, content=ssml.encode("utf-8"))
        resp.raise_for_status()
        return resp.content
