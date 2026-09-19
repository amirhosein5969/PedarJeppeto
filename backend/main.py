"""FastAPI application entry point for the Handcrafted Hearthwood backend.

Run (dev):
    uvicorn main:app --reload --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.v1.api import api_router
from core.cache import close_redis
from core.config import get_settings
from core.middleware import TrafficMiddleware
from db.database import engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: infrastructure is provisioned externally (docker compose).
    yield
    # Shutdown: release the Redis pool, then all pooled DB connections.
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

# CORS: explicitly allow the TanStack Start frontend (dev server on :8080).
# Driven by `cors_origins` in core/config.py, whose default is exactly
# ["http://localhost:8080"]. Extend via CORS_ORIGINS in `.env` if needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Phase 6: best-effort page-view counter — a non-blocking Redis INCR on a
# daily key for every counted GET (assets & the analytics endpoints excluded).
# Runs inside CORS so preflight OPTIONS (not GET) never touch it.
app.add_middleware(TrafficMiddleware)

# Versioned API — every v1 router is aggregated in api.v1.api.
app.include_router(api_router, prefix=settings.api_v1_prefix)