"""Async SQLAlchemy engine, session factory, declarative base, and DB dependency.

No models live here yet (Phase 2). This module is the single entry point
for all database access in the application.
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from core.config import get_settings

settings = get_settings()

# Async engine (lazy — no connection is opened until first use).
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Session factory for all application sessions.
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Declarative base class for all ORM models (added in Phase 2)."""


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: yields one AsyncSession per request.

    Commit/rollback is explicit in the handler/service layer; the session
    is always closed when the request ends.
    """
    async with AsyncSessionLocal() as session:
        yield session