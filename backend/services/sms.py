"""sms.ir OTP gateway — Verify SMS dispatch (+ mocked IVR Call).

* ``send_otp_sms`` uses the official **sms.ir Verify API**:
  ``POST https://api.sms.ir/v1/send/verify`` with the ``X-API-KEY``
  header and the payload
  ``{"mobile", "templateId", "parameters": [{"name": "CODE", "value"}]}``.
* ``send_otp_call`` — sms.ir uses a different flow for voice calls. The
  function signature (and the storefront's "دریافت کد از طریق تماس" UX)
  is intentionally unchanged; the actual provider call is **mocked for
  now** (logged, returns success).

Cost control does NOT live here — it lives in ``api.v1.endpoints.auth``
(Redis rate limits). This module is a thin async transport with strict
error surfacing:

* :class:`SmsNotConfiguredError` — ``SMS_IR_API_KEY`` is empty (503
  upstream; the provider is never called).
* :class:`SmsError` — network failure or a non-2xx provider response
  (502 upstream).
"""

from __future__ import annotations

import logging

import httpx

from core.config import get_settings

logger = logging.getLogger("services.sms")

_TIMEOUT_SECONDS = 20.0
_VERIFY_URL = "https://api.sms.ir/v1/send/verify"


class SmsError(Exception):
    """The provider was reached but the OTP could not be dispatched."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class SmsNotConfiguredError(SmsError):
    """No ``SMS_IR_API_KEY`` configured — fail before any provider call."""


async def send_otp_sms(mobile: str, code: str) -> None:
    """Dispatch the OTP via the sms.ir Verify API (template parameter ``CODE``)."""
    settings = get_settings()
    if not settings.sms_ir_api_key:
        raise SmsNotConfiguredError(
            503, "The SMS gateway (sms.ir) is not configured (SMS_IR_API_KEY)."
        )

    payload = {
        "mobile": mobile,
        "templateId": settings.sms_ir_template_id,
        "parameters": [{"name": "CODE", "value": code}],
    }
    headers = {
        "X-API-KEY": settings.sms_ir_api_key,
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        try:
            resp = await client.post(_VERIFY_URL, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            raise SmsError(0, f"sms.ir network error: {exc}") from exc

    if resp.status_code >= 400:
        raise SmsError(
            resp.status_code,
            f"sms.ir send/verify returned HTTP {resp.status_code}",
        )
    # 2xx — sms.ir accepted the OTP for dispatch.


async def send_otp_call(number: str, code: str) -> None:
    """Voice OTP (IVR call) — MOCKED.

    sms.ir's voice flow differs from the Verify API and is not integrated
    yet. Kept so the storefront's "Call OTP" UX (and the 120 s / rate-limit
    flow) works unchanged; the provider call is only logged.
    """
    logger.info(
        "[sms] Call OTP requested for %s (code %s) — sms.ir voice flow "
        "not integrated yet; logged only (mock success).",
        number,
        code,
    )