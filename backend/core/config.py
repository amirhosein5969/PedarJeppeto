"""Application configuration (12-factor).

All environment-specific values and secrets are read from the process
environment or a local `.env` file (never committed to version control).

Usage:
    from core.config import get_settings
    settings = get_settings()
"""

from functools import lru_cache
from urllib.parse import quote_plus

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central, env-driven application settings."""

    # NOTE: case_sensitive must stay False (the default) — otherwise
    # lowercase field names (postgres_password) would not match uppercase
    # env vars / .env keys (POSTGRES_PASSWORD) and settings would silently
    # fall back to defaults.
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Application -----------------------------------------------------
    app_name: str = "Handcrafted Hearthwood API"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # --- CORS ------------------------------------------------------------
    # The frontend (TanStack Start dev server) is explicitly allowed.
    # To add origins, set CORS_ORIGINS as a JSON list in `.env`, e.g.
    # CORS_ORIGINS=["http://localhost:8080","http://localhost:5173"]
    cors_origins: list[str] = Field(default=["http://localhost:8080"])

    # --- PostgreSQL --------------------------------------------------------
    postgres_user: str = "hearthwood"
    postgres_password: str = "hearthwood"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "hearthwood"

    # --- Redis -------------------------------------------------------------
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str | None = None
    redis_db: int = 0

    # --- MinIO / S3 (object storage) -----------------------------------------
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key_id: str = "hearthwood"
    s3_secret_access_key: str = "hearthwood"
    s3_region: str = "us-east-1"
    s3_bucket: str = "hearthwood-media"
    # Optional public base URL for media (CDN / reverse proxy). When empty,
    # URLs are derived from the MinIO endpoint: {s3_endpoint_url}/{s3_bucket}.
    media_public_base_url: str = ""

    # --- OTP / SMS gateway (api.ir) ------------------------------------------
    # Bearer token for https://s.api.ir (SmsOTP / CallOTP). Empty = the
    # gateway is not configured; /auth/request-otp answers 503 and never
    # touches the provider (zero cost).
    api_ir_token: str = ""
    api_ir_base_url: str = "https://s.api.ir/api/sw1"

    # --- JWT (secure OTP auth) -------------------------------------------------
    jwt_secret: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    # --- Derived connection URLs -----------------------------------------
    @property
    def database_url(self) -> str:
        """Async SQLAlchemy URL for PostgreSQL (asyncpg driver)."""
        user = quote_plus(self.postgres_user)
        password = quote_plus(self.postgres_password)
        return (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        """redis-py connection URL (with optional password auth)."""
        auth = f":{quote_plus(self.redis_password)}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"


@lru_cache
def get_settings() -> Settings:
    """Return the cached Settings instance (single source of truth)."""
    return Settings()