"""Secure OTP authentication schemas (api.ir gateway + JWT)."""

from __future__ import annotations

import enum
import re

from pydantic import BaseModel, Field, field_validator

from schemas.order import canonical_phone, to_ascii_digits

_CANONICAL_PHONE_RE = re.compile(r"^09[0-9]{9}$")
_CODE_RE = re.compile(r"^[0-9]{5}$")


class OtpMethod(str, enum.Enum):
    sms = "sms"
    voice = "voice"


class OtpRequestIn(BaseModel):
    """Body for ``POST /auth/request-otp``.

    ``phone`` is normalized (Persian digits, ``+98``/``0098`` prefixes) to
    the canonical ``09xxxxxxxxx`` form; anything else is a 422.
    """

    phone: str
    method: OtpMethod = OtpMethod.sms

    @field_validator("phone")
    @classmethod
    def _canonicalize(cls, value: str) -> str:
        phone = canonical_phone(value.strip())
        if not _CANONICAL_PHONE_RE.match(phone):
            raise ValueError(
                "شماره موبایل معتبر نیست؛ باید ۱۱ رقم و با 09 شروع شود."
            )
        return phone


class OtpVerifyIn(BaseModel):
    """Body for ``POST /auth/verify-otp``."""

    phone: str
    code: str

    @field_validator("phone")
    @classmethod
    def _canonicalize(cls, value: str) -> str:
        phone = canonical_phone(value.strip())
        if not _CANONICAL_PHONE_RE.match(phone):
            raise ValueError(
                "شماره موبایل معتبر نیست؛ باید ۱۱ رقم و با 09 شروع شود."
            )
        return phone

    @field_validator("code")
    @classmethod
    def _digits_only(cls, value: str) -> str:
        code = re.sub(r"\D", "", to_ascii_digits(value).strip())
        if not _CODE_RE.match(code):
            raise ValueError("کد تأیید باید ۵ رقم باشد.")
        return code


class OtpRequestOut(BaseModel):
    sent: bool
    method: OtpMethod
    #: How long the code stays valid in Redis (seconds).
    ttl_seconds: int


class TokenOut(BaseModel):
    """JWT access token issued after a successful OTP verification."""

    access_token: str
    token_type: str = "bearer"
    #: Convenience claim echo so the client can hydrate its local state.
    phone: str
    role: str
    expires_in: int = Field(description="Token lifetime in seconds.")