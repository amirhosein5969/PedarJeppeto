"""Header-bell notification feed schemas (``GET /notifications``).

The feed is intentionally minimal for now: the endpoint returns an empty
list until real events (order status changes, restocks, promos) start
writing notifications. The shape below is the agreed contract with the
frontend popover (``src/lib/notifications.ts``).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

#: Mirrors the frontend ``NotificationKind`` union.
NOTIFICATION_KINDS = ("order", "promo", "stock", "system")


class NotificationOut(BaseModel):
    """One notification row for the header bell."""

    id: str = Field(min_length=1, max_length=64)
    #: ``order`` | ``promo`` | ``stock`` | ``system``
    kind: str = "system"
    title: str
    body: str
    created_at: datetime
    #: Read-flag as known server-side (the popover also marks locally).
    read: bool = False
