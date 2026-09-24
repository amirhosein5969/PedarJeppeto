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

from __future__ import annotations

import json
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.deps import get_current_admin_user, get_current_user
from core.cache import get_redis
from db.database import get_db
from db.models import Order, OrderItem, OrderStatus, User, UserAddress
from schemas.user import (
    MyOrderItemOut,
    MyOrderOut,
    PhoneChangeRequestIn,
    PhoneChangeSentOut,
    PhoneChangeVerifyIn,
    UserAddressIn,
    UserAddressOut,
    UserAddressUpdate,
    UserMeOut,
    UserMeUpdate,
    UserResponse,
)
from services.sms import SmsError, SmsNotConfiguredError, send_otp_sms

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserResponse], summary="List all users (admin)")
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> list[UserResponse]:
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
# Secure phone change (Phase 13) — /users/me/change-phone-request|verify
# =============================================================================
#
# Proof-of-possession flow: the OTP is dispatched to the NEW number, and
# the phone only changes after that code is verified. Cost/abuse control
# mirrors the login OTP (120 s cooldown via atomic ``SET NX`` + a
# 5-per-15-min dispatch budget, keyed per USER ID so one account can
# never burn SMS credit across many target numbers).

PC_CODE_TTL_SECONDS = 120      # confirmation-code validity
PC_COOLDOWN_SECONDS = 120      # minimum gap between two dispatches
PC_WINDOW_SECONDS = 900        # 15-minute rate-limit window
PC_MAX_REQUESTS = 5            # dispatches allowed per user per window
PC_MAX_FAILURES = 5            # wrong-code attempts before the code dies

_PC_DETAIL_SAME = "شماره جدید با شماره فعلی شما یکسان است."
_PC_DETAIL_TAKEN = "این شماره قبلاً ثبت شده است."
_PC_DETAIL_TOO_MANY = (
    "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ۱۵ دقیقه صبر کنید."
)
_PC_DETAIL_COOLDOWN = (
    "برای هر حساب، دریافت کد جدید تنها پس از ۲ دقیقه ممکن است."
)
_PC_DETAIL_GONE = "کد تأیید منقضی شده یا یافت نشد؛ لطفاً کد جدید دریافت کنید."
_PC_DETAIL_WRONG = "کد تأیید نادرست است."
_PC_DETAIL_LOCKED = (
    "تلاش‌های ناموفق بیش از حد مجاز است؛ کد باطل شد. لطفاً دوباره درخواست دهید."
)
_PC_DETAIL_GATEWAY_DOWN = "ارسال کد در حال حاضر ممکن نیست؛ لطفاً بعداً تلاش کنید."


def _pc_code_key(user_id: int) -> str:
    return f"phonechange:code:{user_id}"


def _pc_fails_key(user_id: int) -> str:
    return f"phonechange:fails:{user_id}"


def _pc_reqs_key(user_id: int) -> str:
    return f"phonechange:reqs:{user_id}"


def _pc_cool_key(user_id: int) -> str:
    return f"phonechange:cool:{user_id}"


async def _phone_taken(db: AsyncSession, phone: str, *, exclude_id: int | None = None) -> bool:
    stmt = select(User.id).where(User.phone == phone)
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    return (await db.execute(stmt)).scalar_one_or_none() is not None


@router.post(
    "/me/change-phone-request",
    response_model=PhoneChangeSentOut,
    summary="Start a phone change — SMS a 6-digit code to the NEW number",
)
async def request_phone_change(
    payload: PhoneChangeRequestIn,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> PhoneChangeSentOut:
    new_phone = payload.new_phone
    if new_phone == user.phone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=_PC_DETAIL_SAME)
    if await _phone_taken(db, new_phone):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=_PC_DETAIL_TAKEN)

    user_id = user.id
    reqs_key = _pc_reqs_key(user_id)
    cool_key = _pc_cool_key(user_id)

    # Rate limits first — a blocked account never reaches the paid gateway.
    window = await redis.get(reqs_key)
    if window is not None and int(window) >= PC_MAX_REQUESTS:
        retry_after = max(await redis.ttl(reqs_key), 1)
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=_PC_DETAIL_TOO_MANY,
            headers={"Retry-After": str(retry_after)},
        )
    lock_taken = await redis.set(cool_key, "1", ex=PC_COOLDOWN_SECONDS, nx=True)
    if not lock_taken:
        retry_after = max(await redis.ttl(cool_key), 1)
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=_PC_DETAIL_COOLDOWN,
            headers={"Retry-After": str(retry_after)},
        )
    count = await redis.incr(reqs_key)
    if count == 1 or (await redis.ttl(reqs_key)) < 0:
        await redis.expire(reqs_key, PC_WINDOW_SECONDS)
    if count > PC_MAX_REQUESTS:
        await redis.decr(reqs_key)
        await redis.delete(cool_key)
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, detail=_PC_DETAIL_TOO_MANY
        )

    # 6-digit code + the target number, stored together for 120 s.
    code = f"{secrets.randbelow(1_000_000):06d}"
    code_key = _pc_code_key(user_id)
    await redis.setex(
        code_key, PC_CODE_TTL_SECONDS, json.dumps({"code": code, "phone": new_phone})
    )

    try:
        await send_otp_sms(mobile=new_phone, code=code)
    except (SmsNotConfiguredError, SmsError) as exc:
        # Nothing was delivered — release the locks so the user can retry.
        await redis.delete(code_key, cool_key)
        left = await redis.decr(reqs_key)
        if left < 1:
            await redis.delete(reqs_key)
        detail = (
            str(exc)
            if isinstance(exc, SmsNotConfiguredError)
            else _PC_DETAIL_GATEWAY_DOWN
        )
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=detail) from exc

    return PhoneChangeSentOut(sent=True, ttl_seconds=PC_CODE_TTL_SECONDS)


@router.post(
    "/me/change-phone-verify",
    response_model=UserMeOut,
    summary="Confirm the phone change with the 6-digit code",
)
async def verify_phone_change(
    payload: PhoneChangeVerifyIn,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> UserMeOut:
    user_id = user.id
    code_key = _pc_code_key(user_id)
    fails_key = _pc_fails_key(user_id)

    raw = await redis.get(code_key)
    if raw is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=_PC_DETAIL_GONE)
    try:
        pending = json.loads(raw)
    except ValueError:  # defensive: a corrupt value kills the flow, never merges
        await redis.delete(code_key)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=_PC_DETAIL_GONE)

    if pending.get("code") != payload.code:
        fails = await redis.incr(fails_key)
        if fails == 1:
            await redis.expire(fails_key, PC_WINDOW_SECONDS)
        if fails > PC_MAX_FAILURES:
            await redis.delete(code_key, fails_key)
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=_PC_DETAIL_LOCKED)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=_PC_DETAIL_WRONG)

    new_phone = str(pending.get("phone") or "")
    # The number may have been claimed while the code was in flight.
    if not new_phone or await _phone_taken(db, new_phone, exclude_id=user.id):
        await redis.delete(code_key, fails_key)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=_PC_DETAIL_TAKEN)

    user.phone = new_phone
    await db.commit()
    await db.refresh(user)

    await redis.delete(
        code_key, fails_key, _pc_reqs_key(user_id), _pc_cool_key(user_id)
    )
    return UserMeOut.model_validate(user)


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