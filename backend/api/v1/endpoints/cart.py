"""Shopping cart endpoints (Phase 4) — Redis-backed, prices from the DB.

The cart is addressed by the client-supplied ``X-Session-Id`` header on every
call (kept out of URLs/logs on purpose).
"""

from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.pricing import q2
from db.database import get_db
from db.models import Product
from schemas.cart import (
    CartAddIn,
    CartClearOut,
    CartLineOut,
    CartLineUpdateIn,
    CartOut,
    CartRemoveOut,
)
from services.cart import CartError, InvalidSessionError, cart_service
from services.settings import get_store_settings_data

_ZERO = Decimal("0.00")


def _oil_charge(pricing, care_oil_added: bool) -> Decimal:
    """Care-oil charge for one line (only when the store has it enabled)."""
    if care_oil_added and pricing.care_oil_enabled:
        return pricing.care_oil_price
    return _ZERO

router = APIRouter(prefix="/cart", tags=["cart"])


def _require_session(session_id: str) -> str:
    """Validate the session id up front (400 on a malformed id)."""
    try:
        return cart_service.validate_session(session_id)
    except InvalidSessionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("", response_model=CartOut, summary="Fetch the cart (current DB prices)")
async def get_cart(
    session_id: str = Header(..., alias="X-Session-Id"),
    db: AsyncSession = Depends(get_db),
) -> CartOut:
    _require_session(session_id)
    lines = await cart_service.get_lines(session_id)
    if not lines:
        return CartOut(items=[], count=0, subtotal=Decimal("0.00"))

    result = await db.execute(
        select(Product).where(Product.id.in_([line.product_id for line in lines]))
    )
    products = {p.id: p for p in result.scalars().all()}
    pricing = (await get_store_settings_data(db)).pricing()

    items: list[CartLineOut] = []
    unavailable: list[int] = []
    for line in lines:
        product = products.get(line.product_id)
        if product is None or not product.is_active:
            unavailable.append(line.product_id)
            continue
        line_subtotal = q2(
            product.base_price * line.quantity
            + _oil_charge(pricing, line.care_oil_added)
        )
        items.append(
            CartLineOut(
                product_id=product.id,
                title=product.title,
                unit_price=product.base_price,
                quantity=line.quantity,
                care_oil_added=line.care_oil_added,
                wood_type=line.wood_type,
                color=line.color,
                line_subtotal=line_subtotal,
            )
        )

    return CartOut(
        items=items,
        count=sum(i.quantity for i in items),
        subtotal=q2(sum((i.line_subtotal for i in items), Decimal("0.00"))),
        unavailable=sorted(unavailable),
    )


@router.post(
    "/add",
    response_model=CartLineOut,
    summary="Add a product to the cart (merges with an existing line)",
)
async def add_to_cart(
    payload: CartAddIn,
    session_id: str = Header(..., alias="X-Session-Id"),
    db: AsyncSession = Depends(get_db),
) -> CartLineOut:
    _require_session(session_id)
    result = await db.execute(
        select(Product).where(Product.id == payload.product_id)
    )
    product = result.scalar_one_or_none()
    if product is None or not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {payload.product_id} does not exist or is unavailable.",
        )

    try:
        line = await cart_service.add_item(
            session_id,
            payload.product_id,
            payload.quantity,
            payload.care_oil_added,
            wood_type=payload.wood_type,
            color=payload.color,
        )
    except CartError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    pricing = (await get_store_settings_data(db)).pricing()
    line_subtotal = q2(
        product.base_price * line.quantity
        + _oil_charge(pricing, line.care_oil_added)
    )
    return CartLineOut(
        product_id=product.id,
        title=product.title,
        unit_price=product.base_price,
        quantity=line.quantity,
        care_oil_added=line.care_oil_added,
        wood_type=line.wood_type,
        color=line.color,
        line_subtotal=line_subtotal,
    )


@router.patch(
    "/line",
    response_model=CartLineOut,
    summary="Set a line's absolute quantity / oil toggle (storefront steppers)",
)
async def update_cart_line(
    payload: CartLineUpdateIn,
    session_id: str = Header(..., alias="X-Session-Id"),
    db: AsyncSession = Depends(get_db),
) -> CartLineOut:
    _require_session(session_id)
    result = await db.execute(
        select(Product).where(Product.id == payload.product_id)
    )
    product = result.scalar_one_or_none()
    if product is None or not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {payload.product_id} does not exist or is unavailable.",
        )

    try:
        line = await cart_service.set_line(
            session_id,
            payload.product_id,
            payload.quantity,
            payload.care_oil_added,
            wood_type=payload.wood_type,
            color=payload.color,
        )
    except CartError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    pricing = (await get_store_settings_data(db)).pricing()
    line_subtotal = q2(
        product.base_price * line.quantity
        + _oil_charge(pricing, line.care_oil_added)
    )
    return CartLineOut(
        product_id=product.id,
        title=product.title,
        unit_price=product.base_price,
        quantity=line.quantity,
        care_oil_added=line.care_oil_added,
        wood_type=line.wood_type,
        color=line.color,
        line_subtotal=line_subtotal,
    )


@router.delete(
    "/remove",
    response_model=CartRemoveOut,
    summary="Remove one product line from the cart",
)
async def remove_from_cart(
    product_id: int = Query(ge=1),
    session_id: str = Header(..., alias="X-Session-Id"),
) -> CartRemoveOut:
    _require_session(session_id)
    try:
        removed = await cart_service.remove_item(session_id, product_id)
    except CartError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    return CartRemoveOut(removed=removed)


@router.delete(
    "/clear",
    response_model=CartClearOut,
    summary="Empty the cart",
)
async def clear_cart(session_id: str = Header(..., alias="X-Session-Id")) -> CartClearOut:
    _require_session(session_id)
    await cart_service.clear(session_id)
    return CartClearOut(cleared=True)