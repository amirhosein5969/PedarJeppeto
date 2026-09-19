"""User (customer) endpoints (Phase 5 board + customer portal).

* Admin read-only board: ``GET /users`` (customers are created/updated at
  checkout; role/block mutations are intentionally not exposed).
* Customer portal: the ``/users/me`` family for the logged-in customer's
  own profile + order history.

Identity: the ``/me`` routes are protected by the JWT issued by
``/auth/verify-otp`` (secure OTP via the api.ir gateway) — see
``api.deps.get_current_user``. The old ``X-User-Phone`` mock bridge is
gone; a valid Bearer token is the only way in.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.deps import get_current_user
from db.database import get_db
from db.models import Order, OrderItem, OrderStatus, User, UserAddress
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
async def get_me(user: User = Depends(get_current_user)) -> UserMeOut:
    # The account row is guaranteed: /auth/verify-otp creates it.
    return UserMeOut.model_validate(user)


@router.patch(
    "/me",
    response_model=UserMeOut,
    summary="Update the logged-in customer's profile (upsert by phone)",
)
async def update_me(
    payload: UserMeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserMeOut:
    updates = payload.model_dump(exclude_unset=True)
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
    user: User = Depends(get_current_user),
) -> list[MyOrderOut]:
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
    user: User = Depends(get_current_user),
) -> list[UserAddressOut]:
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
    user: User = Depends(get_current_user),
) -> UserAddressOut:
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
    user: User = Depends(get_current_user),
) -> UserAddressOut:
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
    user: User = Depends(get_current_user),
) -> dict:
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