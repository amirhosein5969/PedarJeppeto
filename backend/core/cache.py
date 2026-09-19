"""Async Redis client (lazy singleton) for ephemeral data — shopping carts.

Usage:
    from core.cache import get_redis, close_redis

    r = get_redis()
    await r.set("key", "value", ex=60)

The client is created on first use and closed by the app lifespan on shutdown.
"""

from redis.asyncio import Redis

from core.config import get_settings

_settings = get_settings()
_redis: Redis | None = None


def get_redis() -> Redis:
    """Return the shared async Redis client, creating it on first call."""
    global _redis
    if _redis is None:
        _redis = Redis.from_url(
            _settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


async def close_redis() -> None:
    """Close the shared client (called from the FastAPI lifespan shutdown)."""
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None