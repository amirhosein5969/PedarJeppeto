"""Analytics endpoints (Phase 5.1 / Phase 6) — live dashboard aggregates.

Three read-only routes for the admin dashboard:

* ``GET /analytics/sales``      — daily revenue for the last 7 days
  (non-cancelled orders, bucketed by the *server-local* day; zero-filled).
* ``GET /analytics/activities`` — a combined recent-activity feed: the 3
  newest orders, the 2 newest registered customers, and a stock alert for
  every active product with ``stock_count < 3``.
* ``GET /analytics/traffic``    — daily page-view counts for the last 7 days,
  read straight from the Redis counters maintained by
  ``core.middleware.TrafficMiddleware`` (``page_views:YYYY-MM-DD``).

``sales``/``activities`` aggregate directly in Postgres/ORM — no cache (the
datasets are tiny and the admin panel is low traffic).
"""

from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.cache import get_redis
from core.pricing import q2
from db.database import get_db
from db.models import Order, OrderStatus, Product, User
from schemas.analytics import (
    ActivityFeedOut,
    FeedOrderOut,
    FeedStockOut,
    FeedUserOut,
    SalesDayOut,
    TrafficDayOut,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])

SALES_WINDOW_DAYS = 7
LOW_STOCK_THRESHOLD = 3
MAX_STOCK_ALERTS = 5


@router.get(
    "/sales",
    response_model=list[SalesDayOut],
    summary="Daily revenue, last 7 days (non-cancelled orders)",
)
async def sales_summary(db: AsyncSession = Depends(get_db)) -> list[SalesDayOut]:
    now = datetime.now().astimezone()
    # Start of local day, 6 days back — so the window covers today..-6.
    since = (
        (now - timedelta(days=SALES_WINDOW_DAYS - 1))
        .replace(hour=0, minute=0, second=0, microsecond=0)
    )
    result = await db.execute(
        select(Order.created_at, Order.total_amount).where(
            Order.status != OrderStatus.cancelled,
            Order.created_at >= since,
        )
    )
    by_day: dict[date, Decimal] = defaultdict(lambda: Decimal("0.00"))
    for created_at, total in result.all():
        by_day[created_at.astimezone().date()] += total

    days = [(now - timedelta(days=offset)).date() for offset in range(SALES_WINDOW_DAYS - 1, -1, -1)]
    return [SalesDayOut(date=day, total=q2(by_day.get(day, Decimal("0.00")))) for day in days]


@router.get(
    "/traffic",
    response_model=list[TrafficDayOut],
    summary="Daily page views, last 7 days (Redis counters)",
)
async def traffic_summary() -> list[TrafficDayOut]:
    """Read the last 7 days of ``page_views:YYYY-MM-DD`` counters from Redis.

    The counters are incremented by :class:`core.middleware.TrafficMiddleware`
    on every counted GET. We fetch the 7 keys in a single ``MGET`` (one
    round-trip) and zero-fill any day whose key is absent (e.g. before the
    middleware was deployed, or a Redis restart). A Redis outage degrades to
    an all-zero series rather than an error — the dashboard is informational.
    """
    today = date.today()
    days = [today - timedelta(days=offset) for offset in range(SALES_WINDOW_DAYS - 1, -1, -1)]
    keys = [f"page_views:{day.isoformat()}" for day in days]
    try:
        raw = await get_redis().mget(keys)
    except Exception:
        raw = [None] * len(keys)
    return [
        TrafficDayOut(date=day, views=int(value) if value is not None else 0)
        for day, value in zip(days, raw)
    ]


@router.get(
    "/activities",
    response_model=ActivityFeedOut,
    summary="Combined recent-activity feed (orders + users + low stock)",
)
async def activity_feed(db: AsyncSession = Depends(get_db)) -> ActivityFeedOut:
    orders_res = await db.execute(
        select(Order).options(selectinload(Order.user))
        .order_by(Order.id.desc())
        .limit(3)
    )
    orders = [
        FeedOrderOut(
            order_number=order.order_number,
            customer=order.user.full_name,
            status=order.status,
            total=order.total_amount,
            created_at=order.created_at,
        )
        for order in orders_res.scalars().all()
    ]

    users_res = await db.execute(
        select(User).order_by(User.created_at.desc(), User.id.desc()).limit(2)
    )
    users = [
        FeedUserOut(full_name=user.full_name, phone=user.phone, created_at=user.created_at)
        for user in users_res.scalars().all()
    ]

    stock_res = await db.execute(
        select(Product)
        .where(
            Product.is_active.is_(True),
            Product.stock_count < LOW_STOCK_THRESHOLD,
        )
        .order_by(Product.stock_count.asc(), Product.id.asc())
        .limit(MAX_STOCK_ALERTS)
    )
    low_stock = [
        FeedStockOut(product_id=p.id, title=p.title, stock_count=p.stock_count)
        for p in stock_res.scalars().all()
    ]

    return ActivityFeedOut(orders=orders, users=users, low_stock=low_stock)