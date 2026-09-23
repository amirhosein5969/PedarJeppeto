"""api.ir OTP gateway — SMS OTP + voice-call (IVR) OTP dispatch.

* ``send_otp_sms`` uses the official **api.ir SmsOTP** endpoint:
  ``POST https://s.api.ir/api/sw1/SmsOTP`` with the
  ``Authorization: Bearer {API_IR_TOKEN}`` header and the payload
  ``{"mobile", "code", "template": 1}``.
* ``send_otp_call`` uses the official **api.ir CallOTP** endpoint:
  ``POST https://s.api.ir/api/sw1/CallOTP`` with the same Bearer header
  and the payload ``{"number", "code"}``.

Both endpoints answer ``ResultDataOfboolean``
(``{"data", "success", "code", "message"}``); ``success: false`` counts
as a dispatch failure even on HTTP 200.

Cost control does NOT live here — it lives in ``api.v1.endpoints.auth``
(Redis rate limits). This module is a thin async transport with strict
error surfacing:

* :class:`SmsNotConfiguredError` — ``API_IR_TOKEN`` is empty (503
  upstream; the provider is never called).
* :class:`SmsError` — network failure, a non-2xx provider response or
  ``success: false`` (502 upstream).
"""

from __future__ import annotations

import logging

import httpx

from core.config import get_settings

logger = logging.getLogger("services.sms")

_TIMEOUT_SECONDS = 20.0
_API_IR_BASE_URL = "https://s.api.ir"
_SMS_OTP_URL = f"{_API_IR_BASE_URL}/api/sw1/SmsOTP"
_CALL_OTP_URL = f"{_API_IR_BASE_URL}/api/sw1/CallOTP"
#: api.ir template 1 = "کد ورود" (login code).
_SMS_OTP_TEMPLATE = 1


class SmsError(Exception):
    """The provider was reached but the OTP could not be dispatched."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class SmsNotConfiguredError(SmsError):
    """No ``API_IR_TOKEN`` configured — fail before any provider call."""


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }


def _check_result(resp: httpx.Response, service: str) -> None:
    """Raise :class:`SmsError` on non-2xx or a ``success: false`` envelope."""
    if resp.status_code >= 400:
        raise SmsError(
            resp.status_code,
            f"api.ir {service} returned HTTP {resp.status_code}",
        )
    try:
        body = resp.json()
    except ValueError as exc:
        raise SmsError(
            resp.status_code, f"api.ir {service} returned a non-JSON body"
        ) from exc
    if not body.get("success", False):
        raise SmsError(
            resp.status_code,
            f"api.ir {service} rejected the dispatch: {body.get('message') or 'unknown error'}",
        )
    # success=true — api.ir accepted the OTP for dispatch.


async def send_otp_sms(mobile: str, code: str) -> None:
    """Dispatch the OTP via the api.ir SmsOTP endpoint (template 1 = login code)."""
    settings = get_settings()
    if not settings.api_ir_token:
        raise SmsNotConfiguredError(
            503, "The OTP gateway (api.ir) is not configured (API_IR_TOKEN)."
        )

    payload = {"mobile": mobile, "code": code, "template": _SMS_OTP_TEMPLATE}
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        try:
            resp = await client.post(
                _SMS_OTP_URL, json=payload, headers=_headers(settings.api_ir_token)
            )
        except httpx.HTTPError as exc:
            raise SmsError(0, f"api.ir network error: {exc}") from exc

    _check_result(resp, "SmsOTP")


async def send_otp_call(number: str, code: str) -> None:
    """Dispatch the OTP via the api.ir CallOTP endpoint (voice call / IVR)."""
    settings = get_settings()
    if not settings.api_ir_token:
        raise SmsNotConfiguredError(
            503, "The OTP gateway (api.ir) is not configured (API_IR_TOKEN)."
        )

    payload = {"number": number, "code": code}
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        try:
            resp = await client.post(
                _CALL_OTP_URL, json=payload, headers=_headers(settings.api_ir_token)
            )
        except httpx.HTTPError as exc:
            raise SmsError(0, f"api.ir network error: {exc}") from exc

    _check_result(resp, "CallOTP")
