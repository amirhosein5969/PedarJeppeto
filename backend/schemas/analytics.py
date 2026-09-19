"""Analytics schemas (Phase 5.1) — dashboard aggregates.

The admin dashboard consumes two read-only endpoints that aggregate the
durable Postgres data (orders / users / products). No caching layer: the
datasets are tiny (a shop's day of orders) and the admin panel is low
traffic, so a direct query per dashboard load is the honest cost.

**Money contract** (same as the rest of the API): every money field is a
2-place decimal string (pydantic v2 JSON mode for ``Decimal``).
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from db.models import OrderStatus


class SalesDayOut(BaseModel):
    """One day of the 7-day revenue series (chart-ready)."""

    date: date  # ISO date, e.g. "2026-09-18"
    total: Decimal  # sum of non-cancelled order totals that day


class TrafficDayOut(BaseModel):
    """One day of the 7-day page-view series (chart-ready).

    ``views`` is the Redis ``page_views:YYYY-MM-DD`` counter maintained by
    ``core.middleware.TrafficMiddleware`` (0 when the key is absent).
    """

    date: date  # ISO date, e.g. "2026-09-18"
    views: int


class FeedOrderOut(BaseModel):
    """A recent order for the activity timeline."""

    kind: Literal["order"] = "order"
    order_number: str
    customer: str
    status: OrderStatus
    total: Decimal
    created_at: datetime


class FeedUserOut(BaseModel):
    """A recently registered customer for the activity timeline."""

    kind: Literal["user"] = "user"
    full_name: str
    phone: str
    created_at: datetime


class FeedStockOut(BaseModel):
    """A low-stock product alert (current state, so no timestamp)."""

    kind: Literal["low_stock"] = "low_stock"
    product_id: int
    title: str
    stock_count: int


class ActivityFeedOut(BaseModel):
    """The combined recent-activity feed (newest first in each list).

    ``orders``    — the 3 newest orders (any status),
    ``users``     — the 2 newest registered customers,
    ``low_stock`` — every ACTIVE product with ``stock_count < 3``
                    (0 = out of stock), worst first.
    """

    orders: list[FeedOrderOut]
    users: list[FeedUserOut]
    low_stock: list[FeedStockOut]


__all__ = [
    "ActivityFeedOut",
    "FeedOrderOut",
    "FeedStockOut",
    "FeedUserOut",
    "SalesDayOut",
]