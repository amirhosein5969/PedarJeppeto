"""Secure OTP authentication (Phase: api.ir gateway + JWT).

Flow
----
1. ``POST /auth/request-otp`` — generate a 5-digit code, store it in Redis
   (TTL 120 s) and dispatch it via the api.ir SmsOTP endpoint
   (``method="sms"``) or the api.ir CallOTP voice endpoint
   (``method="voice"``).
2. ``POST /auth/verify-otp``  — verify the code, find-or-create the
   :class:`User` in Postgres and issue a JWT access token.

Security & cost control (the top priorities)
---------------------------------------------
* **Resend cooldown (120 s)** — ``SET otp:cool:{phone} NX EX 120`` is the
  FIRST thing the endpoint does: an atomic per-phone lock. If the lock is
  already held, a plain ``GET``/``SET NX`` returns immediately with
  ``429`` and the paid provider is NEVER called. On provider failure the
  lock is released so a genuine network hiccup never costs the user 2 min.
* **Rate limit (anti SMS-bombing)** — ``INCR otp:reqs:{phone}`` per phone;
  the key gets a 900 s (15 min) TTL. ``MAX_OTP_REQUESTS`` (5) dispatches
  inside the window — any further request short-circuits to ``429``
  BEFORE touching api.ir; a lost race (concurrent requests) is caught
  again after ``INCR`` and the slot is released back.
* **Brute-force protection** — ``INCR otp:fails:{phone}`` on wrong code
  entries (900 s TTL). More than 5 wrong attempts → the pending code is
  deleted and the client must request a fresh one.
* Codes are stored only in Redis for 120 s; a successful verify clears the
  ``otp:code`` / ``otp:fails`` / ``otp:reqs`` / ``otp:cool`` keys.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.cache import get_redis
from core.config import get_settings
from db.database import get_db
from db.models import User, UserRole
from schemas.auth import OtpMethod, OtpRequestIn, OtpRequestOut, OtpVerifyIn, TokenOut
from services.sms import SmsError, SmsNotConfiguredError, send_otp_call, send_otp_sms

router = APIRouter(prefix="/auth", tags=["auth"])

# --- Tunables (cost/security) ---------------------------------------------------
OTP_TTL_SECONDS = 120          # code validity
OTP_COOLDOWN_SECONDS = 120     # minimum gap between two dispatches per phone
RATE_WINDOW_SECONDS = 900      # 15-minute rate-limit window
MAX_OTP_REQUESTS = 5           # dispatches allowed per phone per window
MAX_CODE_FAILURES = 5          # wrong-code attempts allowed per code

# --- Persian error details ---------------------------------------------------------
_DETAIL_TOO_MANY_REQUESTS = (
    "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ۱۵ دقیقه صبر کنید."
)
_DETAIL_COOLDOWN = (
    "برای هر شماره، دریافت کد جدید تنها پس از ۲ دقیقه ممکن است."
)
_DETAIL_WRONG_CODE = "کد تأیید نادرست است."
_DETAIL_CODE_GONE = "کد تأیید منقضی شده یا یافت نشد؛ لطفاً کد جدید دریافت کنید."
_DETAIL_LOCKED = (
    "تلاش‌های ناموفق بیش از حد مجاز است؛ کد باطل شد. لطفاً کد جدید دریافت کنید."
)
_DETAIL_GATEWAY_DOWN = "ارسال کد در حال حاضر ممکن نیست؛ لطفاً بعداً تلاش کنید."


def _code_key(phone: str) -> str:
    return f"otp:code:{phone}"


def _fails_key(phone: str) -> str:
    return f"otp:fails:{phone}"


def _reqs_key(phone: str) -> str:
    return f"otp:reqs:{phone}"


def _cool_key(phone: str) -> str:
    return f"otp:cool:{phone}"


async def _release_slot(redis: Redis, reqs_key: str) -> None:
    """Give a window slot back after a dispatch that never reached the
    provider (config/gateway failure) so the user is not silently charged
    for an SMS that was never sent."""
    left = await redis.decr(reqs_key)
    if left < 1:
        await redis.delete(reqs_key)


def _mint_token(user: User) -> tuple[str, int]:
    """Encode the user's JWT; returns ``(token, expires_in_seconds)``."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires_in = settings.jwt_expire_minutes * 60
    payload = {
        "sub": str(user.id),
        "phone": user.phone,
        "role": user.role.value,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_in


@router.post(
    "/request-otp",
    response_model=OtpRequestOut,
    summary="Dispatch a 5-digit OTP by SMS (api.ir SmsOTP) or voice call (api.ir CallOTP)",
)
async def request_otp(
    payload: OtpRequestIn,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> OtpRequestOut:
    phone = payload.phone
    method = payload.method
    reqs_key = _reqs_key(phone)
    cool_key = _cool_key(phone)

    # SECURITY 1a — 15-minute dispatch budget (anti SMS-bombing). Checked
    # BEFORE anything else so a blocked phone never pays for a provider call.
    window = await redis.get(reqs_key)
    if window is not None and int(window) >= MAX_OTP_REQUESTS:
        retry_after = max(await redis.ttl(reqs_key), 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=_DETAIL_TOO_MANY_REQUESTS,
            headers={"Retry-After": str(retry_after)},
        )

    # SECURITY 1b — 120 s resend cooldown. ``SET NX EX`` is atomic: the
    # first arriving request takes the lock, concurrent/early retries get
    # an immediate 429 without ever touching api.ir.
    lock_taken = await redis.set(
        cool_key, "1", ex=OTP_COOLDOWN_SECONDS, nx=True
    )
    if not lock_taken:
        retry_after = max(await redis.ttl(cool_key), 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=_DETAIL_COOLDOWN,
            headers={"Retry-After": str(retry_after)},
        )

    # SECURITY 1c — consume a window slot (with a self-healing TTL) and
    # re-check the cap to survive concurrent requests that both passed 1a.
    count = await redis.incr(reqs_key)
    if count == 1 or (await redis.ttl(reqs_key)) < 0:
        await redis.expire(reqs_key, RATE_WINDOW_SECONDS)
    if count > MAX_OTP_REQUESTS:
        await redis.decr(reqs_key)
        await redis.delete(cool_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=_DETAIL_TOO_MANY_REQUESTS,
        )

    # Fresh cryptographically-secure 5-digit code, valid for 120 s.
    code = f"{secrets.randbelow(100_000):05d}"
    await redis.setex(_code_key(phone), OTP_TTL_SECONDS, code)

    try:
        if method is OtpMethod.voice:
            await send_otp_call(number=phone, code=code)
        else:
            await send_otp_sms(mobile=phone, code=code)
    except SmsNotConfiguredError as exc:
        # Zero-cost failure: the gateway token is not configured. Release
        # the cooldown + window slot — the user never got an SMS anyway.
        await redis.delete(_code_key(phone), cool_key)
        await _release_slot(redis, reqs_key)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except SmsError as exc:
        # Provider failure — drop the (undeliverable) code so a stale one
        # cannot be verified later, release the locks, and surface a 502.
        await redis.delete(_code_key(phone), cool_key)
        await _release_slot(redis, reqs_key)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=_DETAIL_GATEWAY_DOWN
        ) from exc

    return OtpRequestOut(sent=True, method=method, ttl_seconds=OTP_TTL_SECONDS)


@router.post(
    "/verify-otp",
    response_model=TokenOut,
    summary="Verify the OTP and receive a JWT access token",
)
async def verify_otp(
    payload: OtpVerifyIn,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> TokenOut:
    phone = payload.phone
    code_key = _code_key(phone)
    fails_key = _fails_key(phone)

    stored = await redis.get(code_key)
    if stored is None:
        # No pending code (never requested or expired) — nothing to brute-force.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=_DETAIL_CODE_GONE
        )

    if stored != payload.code:
        # SECURITY 2 — brute-force protection: after MAX_CODE_FAILURES wrong
        # attempts the pending code is destroyed.
        fails = await redis.incr(fails_key)
        if fails == 1:
            await redis.expire(fails_key, RATE_WINDOW_SECONDS)
        if fails > MAX_CODE_FAILURES:
            await redis.delete(code_key, fails_key)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=_DETAIL_LOCKED
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=_DETAIL_WRONG_CODE
        )

    # Success — clear all OTP state for this phone.
    await redis.delete(code_key, fails_key, _reqs_key(phone), _cool_key(phone))

    # Find or create the account row (the phone was just proven via OTP).
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if user is None:
        # New customer: EMPTY name on purpose — the real name is collected
        # on the profile page (and required by checkout before an order).
        user = User(phone=phone, full_name="", role=UserRole.customer)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token, expires_in = _mint_token(user)
    return TokenOut(
        access_token=token,
        phone=user.phone,
        role=user.role.value,
        expires_in=expires_in,
    )