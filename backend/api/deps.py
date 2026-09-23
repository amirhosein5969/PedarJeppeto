"""Shared FastAPI dependencies — secure OTP authentication (JWT).

The storefront verifies the customer's phone via the api.ir OTP gateway
(``/auth/request-otp`` + ``/auth/verify-otp``) and receives a short-lived
JWT. This module is the single place that decodes that token and resolves
the :class:`User` row:

* :func:`get_current_user` — **required** identity (401/403). Protects the
  ``/users/me`` family.
* :func:`get_current_user_or_none` — **optional** identity for flows that
  must also serve guests (checkout binds the order to the account when a
  valid token is present, otherwise to the receiver's phone).
"""

from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from db.database import get_db
from db.models import User

#: Where clients can (re)obtain a token — surfaced in the Swagger UI.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/verify-otp")

_bearer_optional = HTTPBearer(auto_error=False)

_UNAUTHORIZED = "برای دسترسی به این بخش ابتدا وارد شوید."
_INACTIVE = "حساب شما غیرفعال شده است."

_UNAUTH_HEADERS = {"WWW-Authenticate": "Bearer"}


def _decode_user_id(token: str) -> int | None:
    """Decode + validate the JWT; return the user id from ``sub`` or None."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    try:
        return int(sub) if sub is not None else None
    except (TypeError, ValueError):
        return None


async def _load_user(db: AsyncSession, user_id: int | None) -> User | None:
    if user_id is None:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """The authenticated, active :class:`User` (401 without a valid JWT)."""
    user = await _load_user(db, _decode_user_id(token))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_UNAUTHORIZED,
            headers=_UNAUTH_HEADERS,
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_INACTIVE
        )
    return user


async def get_current_user_or_none(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_optional),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Optional identity: a valid, active token yields the :class:`User`;
    anything else (absent header, bad/expired token, inactive user) yields
    ``None`` — callers fall back to guest behavior without an error."""
    if credentials is None or not credentials.credentials:
        return None
    user = await _load_user(db, _decode_user_id(credentials.credentials))
    if user is None or not user.is_active:
        return None
    return user