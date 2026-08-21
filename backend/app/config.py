from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# The single .env lives at the repo root, two levels up from this file.
ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_ENV,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # gpt-5 — interviewer brain + vision
    azure_gpt5_endpoint: str | None = None
    azure_gpt5_api_key: str | None = None
    azure_gpt5_api_version: str = "2024-12-01-preview"
    azure_gpt5_deployment: str = "gpt-5"

    # gpt-5-mini — cheap per-turn moves
    azure_gpt5_mini_endpoint: str | None = None
    azure_gpt5_mini_api_key: str | None = None
    azure_gpt5_mini_api_version: str = "2024-12-01-preview"
    azure_gpt5_mini_deployment: str = "gpt-5-mini"

    # embeddings — RAG prompt bank (later)
    azure_openai_embed_endpoint: str | None = None
    azure_openai_embed_api_key: str | None = None
    azure_openai_embed_api_version: str = "2024-12-01-preview"
    azure_openai_embed_deployment: str = "text-embedding-3-large"
    azure_openai_embed_dimensions: int = 3072

    # whisper — speech-to-text
    whisper_endpoint: str | None = None
    whisper_key: str | None = None
    whisper_deployment: str = "whisper"
    whisper_api_version: str = "2024-06-01"

    # azure ai speech — text-to-speech
    azure_speech_key: str | None = None
    azure_speech_region: str = "eastus"
    azure_speech_voice: str = "en-US-Ava:DragonHDLatestNeural"
    azure_speech_endpoint: str | None = None

    # infrastructure
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/interviewwee"
    frontend_origin: str = "http://localhost:3000"

    @property
    def gpt5_configured(self) -> bool:
        return bool(self.azure_gpt5_endpoint and self.azure_gpt5_api_key)

    @property
    def gpt5_mini_configured(self) -> bool:
        return bool(self.azure_gpt5_mini_endpoint and self.azure_gpt5_mini_api_key)

    @property
    def whisper_configured(self) -> bool:
        return bool(self.whisper_endpoint and self.whisper_key)

    @property
    def speech_configured(self) -> bool:
        return bool(self.azure_speech_key and self.azure_speech_region)

    @property
    def embeddings_configured(self) -> bool:
        return bool(self.azure_openai_embed_endpoint and self.azure_openai_embed_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
