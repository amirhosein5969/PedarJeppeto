"""api.ir OTP gateway (SMS + IVR Call) — secure auth transport.

Endpoints (per the api.ir OpenAPI spec):

* ``POST {base}/SmsOTP``  ``{"code": "12345", "mobile": "0912...", "template": 1}``
* ``POST {base}/CallOTP`` ``{"code": "12345", "number": "0912..."}``

Cost control does NOT live here — it lives in ``api.v1.endpoints.auth``
(Redis rate limits). This module is a thin async transport with strict
error surfacing:

* :class:`SmsNotConfiguredError` — ``API_IR_TOKEN`` is empty (503 upstream,
  the provider is never called).
* :class:`SmsError` — network failure or a non-2xx provider response
  (502 upstream).
"""

from __future__ import annotations

import httpx

from core.config import get_settings

_TIMEOUT_SECONDS = 20.0


class SmsError(Exception):
    """The provider was reached but the OTP could not be dispatched."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class SmsNotConfiguredError(SmsError):
    """No ``API_IR_TOKEN`` configured — fail before any provider call."""


async def _post(path: str, payload: dict[str, object]) -> dict:
    """POST one api.ir endpoint with the Bearer token; return the JSON body."""
    settings = get_settings()
    if not settings.api_ir_token:
        raise SmsNotConfiguredError(
            503, "The SMS gateway (api.ir) is not configured (API_IR_TOKEN)."
        )

    headers = {"Authorization": f"Bearer {settings.api_ir_token}"}
    url = f"{settings.api_ir_base_url.rstrip('/')}{path}"
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            raise SmsError(0, f"api.ir network error: {exc}") from exc

    if resp.status_code >= 400:
        raise SmsError(
            resp.status_code, f"api.ir {path} returned HTTP {resp.status_code}"
        )
    try:
        return resp.json()
    except ValueError:
        return {}


async def send_otp_sms(mobile: str, code: str) -> None:
    """Dispatch the OTP by SMS (``template: 1`` = the OTP template)."""
    await _post("/SmsOTP", {"code": code, "mobile": mobile, "template": 1})


async def send_otp_call(number: str, code: str) -> None:
    """Read the OTP aloud via an automated phone call (IVR)."""
    await _post("/CallOTP", {"code": code, "number": number})