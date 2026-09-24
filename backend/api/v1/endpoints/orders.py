"""Order endpoints (Phase 4) — checkout + admin order management.

RBAC: ``GET /orders``, ``PATCH /orders/{id}/status`` are admin-only.
``GET /orders/{id}`` is admin-or-owner (the printable invoice is opened by
customers from their own order history; any other customer gets 403).
"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.deps import get_current_admin_user, get_current_user_or_none
from db.database import get_db
from db.models import Order, OrderItem, User, UserRole
from schemas.order import OrderCreateIn, OrderOut, OrderStatusIn, to_order_out
from services.cart import InvalidSessionError, cart_service
from services.lock import checkout_lock
from services.order import CheckoutError, place_order

router = APIRouter(prefix="/orders", tags=["orders"])

_DETAIL_LOGIN = "برای دسترسی به این بخش ابتدا وارد شوید."
_DETAIL_NOT_OWNER = "این سفارش متعلق به حساب شما نیست."

_ORDER_LOAD_OPTIONS = (
    selectinload(Order.user),
    selectinload(Order.items).selectinload(OrderItem.product),
)


def _require_session(session_id: str) -> str:
    try:
        return cart_service.validate_session(session_id)
    except InvalidSessionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.post(
    "",
    response_model=OrderOut,
    status_code=status.HTTP_201_CREATED,
    summary="Checkout: create an order from the cart",
)
async def create_order(
    payload: OrderCreateIn,
    session_id: str = Header(..., alias="X-Session-Id"),
    # Optional client-supplied idempotency key; defaults to the cart session.
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    # Secure OTP auth: when a valid JWT is present, the order is bound to
    # THIS account, not the receiver. Guests (no token) check out too —
    # the order then binds to the receiver's phone.
    current_user: User | None = Depends(get_current_user_or_none),
    db: AsyncSession = Depends(get_db),
) -> OrderOut:
    _require_session(session_id)
    account_phone = current_user.phone if current_user is not None else None
    # Distributed lock: reject a concurrent checkout of the same cart (or the
    # same explicit idempotency key) immediately, before any work is done.
    lock_id = (idempotency_key or session_id).strip()
    token = await checkout_lock.acquire(lock_id)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A checkout for this cart is already in progress; "
                "please wait a moment and retry."
            ),
        )
    try:
        order = await place_order(
            db, session_id, payload, account_phone=account_phone
        )
    except CheckoutError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    finally:
        await checkout_lock.release(lock_id, token)
    return to_order_out(order)


@router.get("", response_model=list[OrderOut], summary="List all orders (admin)")
async def list_orders(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> list[OrderOut]:
    result = await db.execute(
        select(Order).options(*_ORDER_LOAD_OPTIONS).order_by(Order.id.desc())
    )
    return [to_order_out(order) for order in result.scalars().all()]


@router.get(
    "/{order_id}",
    response_model=OrderOut,
    summary="Get one order (admin, or the owning customer)",
)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_or_none),
) -> OrderOut:
    result = await db.execute(
        select(Order).options(*_ORDER_LOAD_OPTIONS).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} does not exist.",
        )
    # RBAC: every authenticated role sees the invoice of its OWN orders;
    # admins see all; guests are pushed to log in first.
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=_DETAIL_LOGIN
        )
    if current_user.role is not UserRole.admin and order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_DETAIL_NOT_OWNER
        )
    return to_order_out(order)


@router.patch(
    "/{order_id}/status",
    response_model=OrderOut,
    summary="Update an order's status (admin)",
)
async def update_order_status(
    order_id: int,
    payload: OrderStatusIn,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> OrderOut:
    result = await db.execute(
        select(Order).options(*_ORDER_LOAD_OPTIONS).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} does not exist.",
        )
    order.status = payload.status
    await db.commit()
    # Re-fetch with relationships for the full response shape.
    result = await db.execute(
        select(Order).options(*_ORDER_LOAD_OPTIONS).where(Order.id == order_id)
    )
    return to_order_out(result.scalar_one())