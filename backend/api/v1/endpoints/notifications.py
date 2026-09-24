"""Notification feed for the header bell — ``GET /notifications``.

Placeholder contract endpoint: it exists so the frontend bell fetches
REAL data (and shows "هیچ اعلانی ندارید") instead of the old hard-coded
dummy feed. There is no notification producer yet, so the list is always
empty — wiring order-status/restock events into it later needs no
frontend change beyond adding rows here.

Auth: the JWT from ``/auth/verify-otp`` (a bell belongs to a person).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from api.deps import get_current_user
from db.models import User
from schemas.notification import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get(
    "",
    response_model=list[NotificationOut],
    summary="The logged-in customer's notifications (empty until producers land)",
)
async def list_notifications(
    _user: User = Depends(get_current_user),
) -> list[NotificationOut]:
    return []
