from collections.abc import AsyncIterator
from functools import lru_cache

from openai import AsyncAzureOpenAI

from app.config import get_settings

settings = get_settings()


@lru_cache
def _client(endpoint: str | None, api_key: str | None, api_version: str) -> AsyncAzureOpenAI:
    return AsyncAzureOpenAI(
        azure_endpoint=endpoint or "",
        api_key=api_key or "",
        api_version=api_version,
    )


async def stream_interviewer(messages: list[dict]) -> AsyncIterator[str]:
    """Stream the interviewer's spoken reply from gpt-5."""
    client = _client(
        settings.azure_gpt5_endpoint,
        settings.azure_gpt5_api_key,
        settings.azure_gpt5_api_version,
    )
    stream = await client.chat.completions.create(
        model=settings.azure_gpt5_deployment,
        messages=messages,
        stream=True,
        reasoning_effort="minimal",
    )
    async for chunk in stream:
        choices = chunk.choices
        if choices and choices[0].delta and choices[0].delta.content:
            yield choices[0].delta.content


async def decide_json(messages: list[dict]) -> str:
    """One-shot JSON decision from gpt-5-mini (the interview director)."""
    client = _client(
        settings.azure_gpt5_mini_endpoint,
        settings.azure_gpt5_mini_api_key,
        settings.azure_gpt5_mini_api_version,
    )
    resp = await client.chat.completions.create(
        model=settings.azure_gpt5_mini_deployment,
        messages=messages,
        response_format={"type": "json_object"},
    )
    return resp.choices[0].message.content or "{}"


async def score_json(messages: list[dict]) -> str:
    """One-shot JSON grade from gpt-5 (supports image input)."""
    client = _client(
        settings.azure_gpt5_endpoint,
        settings.azure_gpt5_api_key,
        settings.azure_gpt5_api_version,
    )
    resp = await client.chat.completions.create(
        model=settings.azure_gpt5_deployment,
        messages=messages,
        response_format={"type": "json_object"},
    )
    return resp.choices[0].message.content or "{}"
