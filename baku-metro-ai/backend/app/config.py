"""Application configuration loaded from environment variables.

Centralised so that any future swap from mock generator to real camera
ingestion only changes env vars, never source code.
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    log_level: str = Field(default="info")
    # Stored as a raw string to avoid pydantic-settings auto-JSON-decoding
    # complex types from env vars. Use `cors_origins_list` to get the parsed
    # list. Accepts "*" or a comma-separated list (e.g. "http://a,http://b").
    cors_origins: str = Field(default="*")

    # Domain constants — kept here so they are easy to change for real deploys.
    num_trains: int = Field(default=10)
    wagons_per_train: int = Field(default=5)

    @property
    def cors_origins_list(self) -> List[str]:
        raw = self.cors_origins.strip()
        if raw == "*" or not raw:
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor (singleton)."""
    return Settings()
