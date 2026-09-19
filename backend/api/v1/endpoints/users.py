"""User (customer) endpoints (Phase 5 board + Phase 6 customer portal).

* Admin read-only board: ``GET /users`` (customers are created/updated at
  checkout; role/block mutations are intentionally not exposed).
* Customer portal: the ``/users/me`` family for the logged-in customer's
  own profile + order history.

Phase 6 identity bridge (documented): real token/JWT auth does not exist
yet — the storefront's mock OTP login stores the customer's phone client-side
and the axios interceptor ships it as the ``X-User-Phone`` header. The
``/me`` routes resolve the :class:`User` by canonical phone. When real auth
lands, only this header dependency changes.
"""

import re

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.database import get_db
from db.models import Order, OrderItem, OrderStatus, User, UserAddress, UserRole
from schemas.order import canonical_phone
from schemas.user import (
    MyOrderItemOut,
    MyOrderOut,
    UserAddressIn,
    UserAddressOut,
    UserAddressUpdate,
    UserMeOut,
    UserMeUpdate,
    UserResponse,
)

router = APIRouter(prefix="/users", tags=["users"])

# Mirrors schemas.order._CANONICAL_PHONE_RE (kept private there).
_CANONICAL_PHONE_RE = re.compile(r"^09\d{9}$")

_UNAUTHED = "برای مشاهده‌ی حساب کاربری ابتدا وارد شوید."
_NOT_FOUND = "حساب کاربری یافت نشد."


def user_phone(
    x_user_phone: str | None = Header(default=None, alias="X-User-Phone"),
) -> str | None:
    """FastAPI dependency: the logged-in phone (Phase 6 mock-auth bridge).

    Returns the canonical ``09xxxxxxxxx`` form, or ``None`` when the header
    is absent/invalid — the routes map that to 401.
    """
    if not x_user_phone:
        return None
    phone = canonical_phone(x_user_phone)
    return phone if _CANONICAL_PHONE_RE.match(phone) else None


async def _get_user_by_phone(
    db: AsyncSession, phone: str | None
) -> User | None:
    if not phone:
        return None
    result = await db.execute(select(User).where(User.phone == phone))
    return result.scalar_one_or_none()


async def _require_phone(phone: str | None) -> None:
    if not phone:
        raise HTTPException(status_code=401, detail=_UNAUTHED)


@router.get("", response_model=list[UserResponse], summary="List all users (admin)")
async def list_users(db: AsyncSession = Depends(get_db)) -> list[UserResponse]:
    order_count = (
        select(func.count(Order.id))
        .where(Order.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    total_spent = (
        select(func.coalesce(func.sum(Order.total_amount), 0))
        .where(Order.user_id == User.id, Order.status != OrderStatus.cancelled)
        .correlate(User)
        .scalar_subquery()
    )
    result = await db.execute(select(User, order_count, total_spent).order_by(User.id))
    rows = result.all()
    # Each user's default shipping address (Phase 7 address book) — one query.
    addr_result = await db.execute(
        select(UserAddress).where(UserAddress.is_default.is_(True))
    )
    default_addr = {a.user_id: a for a in addr_result.scalars().all()}

    out: list[UserResponse] = []
    for user, count, spent in rows:
        a = default_addr.get(user.id)
        out.append(
            UserResponse(
                id=user.id,
                phone=user.phone,
                role=user.role,
                full_name=user.full_name,
                is_active=user.is_active,
                province=a.province if a else None,
                city=a.city if a else None,
                zip_code=a.zip_code if a else None,
                address=a.address if a else None,
                created_at=user.created_at,
                order_count=count,
                total_spent=spent,
            )
        )
    return out


# =============================================================================
# Customer portal (Phase 6) — /users/me
# =============================================================================


@router.get(
    "/me",
    response_model=UserMeOut,
    summary="The logged-in customer's profile",
)
async def get_me(
    db: AsyncSession = Depends(get_db),
    phone: str | None = Depends(user_phone),
) -> UserMeOut:
    await _require_phone(phone)
    user = await _get_user_by_phone(db, phone)
    if user is None:
        # Logged in (mock OTP) but never placed an order & never saved the
        # profile yet — the client renders an empty form for this case.
        raise HTTPException(status_code=404, detail=_NOT_FOUND)
    return UserMeOut.model_validate(user)


@router.patch(
    "/me",
    response_model=UserMeOut,
    summary="Update the logged-in customer's profile (upsert by phone)",
)
async def update_me(
    payload: UserMeUpdate,
    db: AsyncSession = Depends(get_db),
    phone: str | None = Depends(user_phone),
) -> UserMeOut:
    await _require_phone(phone)
    updates = payload.model_dump(exclude_unset=True)

    user = await _get_user_by_phone(db, phone)
    if user is None:
        # First save from the portal: create the account row (the phone is
        # already verified client-side by the mock OTP flow).
        user = User(
            phone=phone,
            full_name=updates.pop("full_name", None) or "مشتری چوب‌کار",
            role=UserRole.customer,
        )
        db.add(user)
    for field, value in updates.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return UserMeOut.model_validate(user)


@router.get(
    "/me/orders",
    response_model=list[MyOrderOut],
    summary="The logged-in customer's orders (items + product images)",
)
async def my_orders(
    db: AsyncSession = Depends(get_db),
    phone: str | None = Depends(user_phone),
) -> list[MyOrderOut]:
    await _require_phone(phone)
    user = await _get_user_by_phone(db, phone)
    # A logged-in customer without an account row simply has no history yet
    # (orders FK to users) — return an empty list, not a 404, so the portal
    # renders its "no orders yet" state.
    if user is None:
        return []

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
        .where(Order.user_id == user.id)
        .order_by(Order.id.desc())
    )
    return [
        MyOrderOut(
            id=order.id,
            order_number=order.order_number,
            status=order.status,
            total_amount=order.total_amount,
            created_at=order.created_at,
            items=[
                MyOrderItemOut(
                    product_id=item.product_id,
                    title=item.product.title,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    image=item.product.images[0] if item.product.images else None,
                )
                for item in order.items
            ],
        )
        for order in result.scalars().all()
    ]


# =============================================================================
# Customer address book (Phase 7) — /users/me/addresses
# =============================================================================


async def _me_user(db: AsyncSession, phone: str | None) -> User | None:
    """Resolve the logged-in user (401 when not authenticated), or None."""
    await _require_phone(phone)
    return await _get_user_by_phone(db, phone)


async def _me_or_404(db: AsyncSession, phone: str | None) -> User:
    user = await _me_user(db, phone)
    if user is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND)
    return user


async def _owned_address(db: AsyncSession, user: User, address_id: int) -> UserAddress:
    result = await db.execute(select(UserAddress).where(UserAddress.id == address_id))
    addr = result.scalar_one_or_none()
    if addr is None or addr.user_id != user.id:
        raise HTTPException(status_code=404, detail="این آدرس یافت نشد.")
    return addr


async def _list_addresses(db: AsyncSession, user: User) -> list[UserAddress]:
    result = await db.execute(
        select(UserAddress)
        .where(UserAddress.user_id == user.id)
        .order_by(UserAddress.is_default.desc(), UserAddress.id.asc())
    )
    return list(result.scalars().all())


@router.get(
    "/me/addresses",
    response_model=list[UserAddressOut],
    summary="The customer's saved addresses (default first)",
)
async def my_addresses(
    db: AsyncSession = Depends(get_db),
    phone: str | None = Depends(user_phone),
) -> list[UserAddressOut]:
    user = await _me_user(db, phone)
    if user is None:
        return []
    return [UserAddressOut.model_validate(a) for a in await _list_addresses(db, user)]


@router.post(
    "/me/addresses",
    response_model=UserAddressOut,
    status_code=201,
    summary="Add a saved address to the customer's book",
)
async def create_address(
    payload: UserAddressIn,
    db: AsyncSession = Depends(get_db),
    phone: str | None = Depends(user_phone),
) -> UserAddressOut:
    user = await _me_user(db, phone)
    if user is None:
        # First interaction from a brand-new account: create the row, then the
        # address (the account's first address becomes the default).
        user = User(phone=phone, full_name="مشتری چوب‌کار", role=UserRole.customer)
        db.add(user)
        await db.flush()

    existing = await _list_addresses(db, user)
    is_default = payload.is_default or not existing
    addr = UserAddress(
        user_id=user.id,
        title=payload.title,
        province=payload.province,
        city=payload.city,
        zip_code=payload.zip_code,
        address=payload.address,
        is_default=is_default,
    )
    db.add(addr)
    await db.flush()
    if is_default:
        await db.execute(
            update(UserAddress)
            .where(UserAddress.user_id == user.id, UserAddress.id != addr.id)
            .values(is_default=False)
        )
    await db.commit()
    await db.refresh(addr)
    return UserAddressOut.model_validate(addr)


@router.put(
    "/me/addresses/{address_id}",
    response_model=UserAddressOut,
    summary="Update one of the customer's saved addresses",
)
async def update_address(
    address_id: int,
    payload: UserAddressUpdate,
    db: AsyncSession = Depends(get_db),
    phone: str | None = Depends(user_phone),
) -> UserAddressOut:
    user = await _me_or_404(db, phone)
    addr = await _owned_address(db, user, address_id)
    updates = payload.model_dump(exclude_unset=True)
    is_default_set = updates.get("is_default")
    for field, value in updates.items():
        setattr(addr, field, value)
    if is_default_set:
        await db.execute(
            update(UserAddress)
            .where(UserAddress.user_id == user.id, UserAddress.id != addr.id)
            .values(is_default=False)
        )
    await db.commit()
    await db.refresh(addr)
    return UserAddressOut.model_validate(addr)


@router.delete(
    "/me/addresses/{address_id}",
    summary="Delete one of the customer's saved addresses",
)
async def delete_address(
    address_id: int,
    db: AsyncSession = Depends(get_db),
    phone: str | None = Depends(user_phone),
) -> dict:
    user = await _me_or_404(db, phone)
    addr = await _owned_address(db, user, address_id)
    was_default = addr.is_default
    # If we're deleting the default, promote the next-lowest-id address.
    if was_default:
        nxt = (
            await db.execute(
                select(UserAddress)
                .where(UserAddress.user_id == user.id, UserAddress.id != addr.id)
                .order_by(UserAddress.id.asc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if nxt is not None:
            nxt.is_default = True
    await db.delete(addr)
    await db.commit()
    return {"deleted": True}