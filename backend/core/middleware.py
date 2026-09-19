"""Page-view traffic middleware (Phase 6).

Counts incoming GET requests as page views in Redis — the signal behind
``GET /api/v1/analytics/traffic`` and the dashboard's "Website Traffic" chart.

Design
------
* **Best-effort**: every Redis failure is swallowed. Analytics must never
  break (or delay) a request.
* **Non-blocking**: the counter uses the shared *async* Redis client with a
  hard 0.5 s timeout guard, so even a wedged Redis can't stall the event
  loop or the response.
* **Static assets are ignored**: requests whose path ends in a media/asset
  extension (JS/CSS/images/fonts/documents/video) never increment the
  counter — only "content" GETs count.
* **Self-exclusion**: ``/api/v1/analytics/*`` is skipped so the dashboard's
  own polling can't inflate its own chart.

Counting semantics (honest, documented): the backend sees the storefront's
data fetches — a page load in the browser fires the GETs that load it — so
"page views" here are the counted backend GETs: a deliberate lightweight
proxy until a dedicated per-navigation frontend beacon lands later.
"""

from __future__ import annotations

import asyncio
from datetime import date

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.cache import get_redis

#: File extensions that are never "views": static assets, media, documents.
_IGNORED_EXTENSIONS = frozenset(
    {
        ".js",
        ".mjs",
        ".css",
        ".map",
        ".json",
        ".txt",
        ".xml",
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".gif",
        ".svg",
        ".ico",
        ".avif",
        ".woff",
        ".woff2",
        ".ttf",
        ".otf",
        ".eot",
        ".mp3",
        ".mp4",
        ".webm",
        ".avi",
    }
)

#: Paths that must not count themselves (the dashboard's own polling).
_EXCLUDED_PREFIXES = ("/api/v1/analytics",)

#: Daily counters are kept for two weeks (7-day chart + headroom).
_KEY_TTL_SECONDS = 14 * 86_400

#: Hard ceiling (seconds) on how long the counter may take before giving up.
_INCR_TIMEOUT = 0.5


def _should_count(path: str) -> bool:
    """True when the path represents a "view" (not an asset, not self)."""
    if path.startswith(_EXCLUDED_PREFIXES):
        return False
    dot = path.rfind(".")
    if dot != -1 and path[dot:].lower() in _IGNORED_EXTENSIONS:
        return False
    return True


class TrafficMiddleware(BaseHTTPMiddleware):
    """Increment ``page_views:YYYY-MM-DD`` for every counted GET request."""

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "GET" and _should_count(request.url.path):
            key = f"page_views:{date.today().isoformat()}"
            try:
                redis = get_redis()
                await asyncio.wait_for(redis.incr(key), timeout=_INCR_TIMEOUT)
                # First hit of the day sets the expiry (nx: keep it on repeats).
                await asyncio.wait_for(
                    redis.expire(key, _KEY_TTL_SECONDS, nx=True), timeout=_INCR_TIMEOUT
                )
            except Exception:
                # Never fail — or slow — a request because of analytics.
                pass
        return await call_next(request)