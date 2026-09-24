"""Promo code endpoints (Phase 4) — admin CRUD + checkout validation.

RBAC: the CRUD surface (list/create/update/delete) is admin-only; only
``POST /promotions/validate`` stays public because the checkout preview —
including guests — needs to price a promo before ordering.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_admin_user
from db.database import get_db
from db.models import PromoCode, User
from schemas.promotion import (
    PromoCreate,
    PromoResponse,
    PromoUpdate,
    PromoValidateIn,
    PromoValidateOut,
)
from services.promotion import PromoError, assert_redeemable, calc_discount

router = APIRouter(prefix="/promotions", tags=["promotions"])


def _get_promo_or_404(promo: PromoCode | None, code: int | str) -> PromoCode:
    if promo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promo code {code} does not exist.",
        )
    return promo


@router.get("", response_model=list[PromoResponse], summary="List promo codes (admin)")
async def list_promos(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> list[PromoCode]:
    result = await db.execute(select(PromoCode).order_by(PromoCode.id))
    return list(result.scalars().all())


@router.post(
    "",
    response_model=PromoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a promo code (admin)",
)
async def create_promo(
    payload: PromoCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> PromoCode:
    exists = await db.execute(select(PromoCode).where(PromoCode.code == payload.code))
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Promo code '{payload.code}' already exists.",
        )
    promo = PromoCode(**payload.model_dump())
    db.add(promo)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Promo code '{payload.code}' already exists.",
        ) from exc
    await db.refresh(promo)
    return promo


@router.patch(
    "/{promo_id}",
    response_model=PromoResponse,
    summary="Update a promo code (partial, admin)",
)
async def update_promo(
    promo_id: int,
    payload: PromoUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> PromoCode:
    result = await db.execute(select(PromoCode).where(PromoCode.id == promo_id))
    promo = _get_promo_or_404(result.scalar_one_or_none(), promo_id)

    data = payload.model_dump(exclude_unset=True)
    if "code" in data and data["code"] != promo.code:
        dup = await db.execute(select(PromoCode).where(PromoCode.code == data["code"]))
        if dup.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Promo code '{data['code']}' already exists.",
            )
    for field, value in data.items():
        setattr(promo, field, value)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not update the promo code (duplicate conflict).",
        ) from exc
    await db.refresh(promo)
    return promo


@router.delete(
    "/{promo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a promo code (admin)",
)
async def delete_promo(
    promo_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> None:
    result = await db.execute(select(PromoCode).where(PromoCode.id == promo_id))
    promo = _get_promo_or_404(result.scalar_one_or_none(), promo_id)
    await db.delete(promo)
    await db.commit()


@router.post(
    "/validate",
    response_model=PromoValidateOut,
    summary="Validate a promo for a cart (checkout preview)",
)
async def validate_promo(
    payload: PromoValidateIn, db: AsyncSession = Depends(get_db)
) -> PromoValidateOut:
    result = await db.execute(
        select(PromoCode).where(PromoCode.code == payload.code.strip().upper())
    )
    promo = _get_promo_or_404(result.scalar_one_or_none(), payload.code)

    try:
        assert_redeemable(promo, payload.cart_subtotal)
    except PromoError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message
        ) from exc

    return PromoValidateOut(
        code=promo.code,
        valid=True,
        discount_percentage=promo.discount_percentage,
        max_discount_amount=promo.max_discount_amount,
        min_purchase_amount=promo.min_purchase_amount,
        discount_amount=calc_discount(promo, payload.cart_subtotal),
    )