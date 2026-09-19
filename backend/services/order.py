"""Order processing / checkout service (Phase 4).

``place_order`` orchestrates the full checkout:

    Redis cart -> product/stock verification -> exact Decimal money math
    -> STRICT single atomic DB transaction (Order + OrderItems + stock
       decrement + promo ``times_used`` increment + user upsert)
    -> Redis cart cleared only after a successful commit.

Money invariants
----------------
* Every amount is a :class:`~decimal.Decimal`; rounding is half-up to whole
  toman for the promo discount and VAT (storefront parity). No floats.
* Totals are snapshots on the ``Order`` row — they are never recomputed later.

Atomicity
---------
All writes happen in ONE transaction on a dedicated session
(``async with tx.begin()``). Stock is decremented with a *conditional*
``UPDATE ... WHERE stock_count >= qty`` so two concurrent checkouts can never
oversell: the loser sees ``rowcount == 0`` and the whole transaction rolls
back (no order, no promo increment, no user write). The endpoint maps the
raised :class:`CheckoutError` to a 400.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.pricing import FREE_SHIPPING_FROM, q2, round_money
from db.database import AsyncSessionLocal
from db.models import (
    Order,
    OrderItem,
    OrderStatus,
    Product,
    PromoCode,
    User,
    UserAddress,
    UserRole,
)
from schemas.order import OrderCreateIn
from services.cart import cart_service
from services.errors import CheckoutError
from services.promotion import PromoError, assert_redeemable, calc_discount
from services.settings import PricingRules, get_store_settings_data

_ZERO = Decimal("0.00")


class EmptyCartError(CheckoutError):
    pass


class ProductUnavailableError(CheckoutError):
    pass


class InsufficientStockError(CheckoutError):
    pass


class UnknownShippingMethodError(CheckoutError):
    pass


# =============================================================================
# Checkout
# =============================================================================


async def place_order(
    db: AsyncSession,
    session_id: str,
    payload: OrderCreateIn,
    account_phone: str | None = None,
) -> Order:
    """Run the full checkout flow and return the persisted :class:`Order`.

    ``account_phone`` is the canonical phone of the logged-in customer
    (``X-User-Phone`` bridge). When present it is the authoritative owner of
    the order — decoupling *who owns the account* from *who receives the
    package* (``payload.customer``). Guests fall back to the receiver's phone.
    """
    # 1) Read the cart (Redis).
    lines = await cart_service.get_lines(session_id)
    if not lines:
        raise EmptyCartError("The cart is empty.")

    # 2) Fetch the dynamic pricing rules (Redis-cached singleton settings) and
    #    confirm the shipping method is one the store currently offers.
    settings_data = await get_store_settings_data(db)
    pricing = settings_data.pricing()
    if payload.shipping_method not in pricing.shipping_fees:
        raise UnknownShippingMethodError(
            f"Unknown shipping method '{payload.shipping_method}'. "
            f"Valid methods: {', '.join(pricing.shipping_fees)}."
        )

    # 3) Resolve products in a single query (request session, read-only).
    product_ids = [line.product_id for line in lines]
    result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products = {p.id: p for p in result.scalars().all()}
    unavailable = sorted(
        pid
        for pid in product_ids
        if pid not in products or not products[pid].is_active
    )
    if unavailable:
        raise ProductUnavailableError(
            "Cart contains unavailable product(s): "
            + ", ".join(str(pid) for pid in unavailable)
            + ". Remove them and retry."
        )

    # 4) Friendly pre-check of stock (the atomic block re-guards it).
    for line in lines:
        product = products[line.product_id]
        if product.stock_count < line.quantity:
            raise InsufficientStockError(
                f"Insufficient stock for '{product.title}': requested "
                f"{line.quantity}, available {product.stock_count}."
            )

    # 5) Money math — exact Decimal, storefront formula.
    goods = q2(
        sum(
            (products[line.product_id].base_price * line.quantity for line in lines),
            _ZERO,
        )
    )
    # Care oil is charged once per opted-in line, but only while the store has it
    # enabled (server-side enforcement of the storefront toggle).
    oil_lines = sum(
        1 for line in lines if line.care_oil_added and pricing.care_oil_enabled
    )
    care_oil = q2(pricing.care_oil_price * oil_lines)
    goods_total = q2(goods + care_oil)
    packaging = (
        pricing.signature_packaging_price
        if (payload.signature_packaging and pricing.signature_packaging_enabled)
        else _ZERO
    )

    promo: PromoCode | None = None
    discount = _ZERO
    if payload.promo_code:
        promo = (
            await db.execute(
                select(PromoCode).where(
                    PromoCode.code == payload.promo_code.strip().upper()
                )
            )
        ).scalar_one_or_none()
        if promo is None:
            raise PromoError(
                f"Promo code '{payload.promo_code}' does not exist."
            )
        assert_redeemable(promo, goods_total)  # raises PromoError (400)
        discount = calc_discount(promo, goods_total)

    taxable_base = q2(goods_total + packaging - discount)
    if taxable_base < 0:
        taxable_base = _ZERO
    vat = q2(round_money(taxable_base * pricing.vat_percentage / Decimal("100")))

    # Free shipping once the goods total (incl. care oil) reaches the threshold;
    # otherwise the fee is the configured method fee (from settings).
    shipping_cost = (
        _ZERO
        if goods_total >= FREE_SHIPPING_FROM
        else q2(pricing.shipping_fees[payload.shipping_method])
    )
    total = q2(taxable_base + vat + shipping_cost)

    # 6) Account owner (Phase 7): the logged-in phone owns the order; a guest's
    #    order binds to the receiver's phone (legacy behavior preserved).
    customer = payload.customer
    owner_phone = account_phone or customer.phone
    user = (
        await db.execute(select(User).where(User.phone == owner_phone))
    ).scalar_one_or_none()

    # 6b) Validate a selected saved address up front (read-only, request session)
    #     so a bad/foreign id never reaches the atomic write.
    selected_address: UserAddress | None = None
    if customer.address_id is not None:
        if user is None:
            # A brand-new account cannot own a saved address yet.
            raise CheckoutError(
                "Selecting a saved address requires an existing account."
            )
        result = await db.execute(
            select(UserAddress).where(UserAddress.id == customer.address_id)
        )
        selected_address = result.scalar_one_or_none()
        if selected_address is None:
            raise CheckoutError("The selected address does not exist.")
        if selected_address.user_id != user.id:
            raise CheckoutError(
                "The selected address does not belong to your account."
            )

    # 7) STRICT single atomic transaction.
    order_id = await _write_order_atomically(
        lines=lines,
        products=products,
        user=user,
        owner_phone=owner_phone,
        customer=customer,
        selected_address_id=selected_address.id if selected_address else None,
        shipping_method=payload.shipping_method,
        shipping_cost=shipping_cost,
        discount=discount,
        vat=vat,
        total=total,
        signature_packaging=payload.signature_packaging,
        care_oil_price=pricing.care_oil_price,
        care_oil_enabled=pricing.care_oil_enabled,
        promo=promo,
    )

    # 8) Cart is cleared only after the order is durably committed.
    await cart_service.clear(session_id)

    # 9) Return the persisted order (fresh read; the write session is closed).
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.user),
            selectinload(Order.items).selectinload(OrderItem.product),
        )
        .where(Order.id == order_id)
    )
    return result.scalar_one()


async def _clear_default(tx: AsyncSession, user_id: int, except_id: int) -> None:
    """Clear ``is_default`` on every other address for a user (single default)."""
    await tx.execute(
        update(UserAddress)
        .where(UserAddress.user_id == user_id, UserAddress.id != except_id)
        .values(is_default=False)
    )


async def _write_order_atomically(
    *,
    lines: list,
    products: dict[int, Product],
    user: User | None,
    owner_phone: str,
    customer,
    selected_address_id: int | None,
    shipping_method: str,
    shipping_cost: Decimal,
    discount: Decimal,
    vat: Decimal,
    total: Decimal,
    signature_packaging: bool,
    care_oil_price: Decimal,
    care_oil_enabled: bool,
    promo: PromoCode | None,
) -> int:
    """All writes in ONE transaction; any failure rolls everything back."""
    async with AsyncSessionLocal() as tx:
        async with tx.begin():
            # (a) Atomic stock decrement — conditional UPDATE re-guards under
            #     concurrency; rowcount 0 means someone else bought it first.
            for line in lines:
                res = await tx.execute(
                    update(Product)
                    .where(
                        Product.id == line.product_id,
                        Product.stock_count >= line.quantity,
                    )
                    .values(stock_count=Product.stock_count - line.quantity)
                )
                if res.rowcount == 0:
                    raise InsufficientStockError(
                        f"Insufficient stock for "
                        f"'{products[line.product_id].title}'."
                    )

            # (b) User upsert by owner phone (unique). Phase 7: no flat address
            #     on the user — addresses live in the address book (step c).
            if user is None:
                new_user = User(
                    phone=owner_phone,
                    full_name=customer.full_name,
                    role=UserRole.customer,
                )
                tx.add(new_user)
                try:
                    await tx.flush()
                except IntegrityError:
                    raise CheckoutError(
                        "A customer with this phone number was just created; "
                        "please retry the checkout."
                    )
                user_id: int | None = new_user.id
            else:
                db_user = await tx.get(User, user.id)
                db_user.full_name = customer.full_name
                user_id = db_user.id

            # (c) Resolve + persist the shipping address (Phase 7 address book).
            if selected_address_id is not None:
                # The customer chose one of their saved addresses at checkout:
                # reuse its fields and promote it to the default.
                addr = await tx.get(UserAddress, selected_address_id)
                if addr is None:  # pragma: no cover - validated upstream
                    raise CheckoutError("The selected address no longer exists.")
                province, city, zip_code, address = (
                    addr.province,
                    addr.city,
                    addr.zip_code,
                    addr.address,
                )
                if not addr.is_default:
                    await _clear_default(tx, user_id, except_id=addr.id)
                addr.is_default = True
            else:
                # A new address from the receiver block — dedupe against the
                # book, then auto-save it so a logged-in customer builds a book.
                province, city = customer.province, customer.city
                zip_code = customer.zip_code
                address = customer.address
                existing = (
                    await tx.execute(
                        select(UserAddress).where(
                            UserAddress.user_id == user_id,
                            UserAddress.province == province,
                            UserAddress.city == city,
                            UserAddress.zip_code == (zip_code or None),
                            UserAddress.address == address,
                        )
                    )
                ).scalar_one_or_none()
                if existing is not None:
                    if not existing.is_default:
                        await _clear_default(tx, user_id, except_id=existing.id)
                    existing.is_default = True
                else:
                    first_id = await tx.scalar(
                        select(UserAddress.id)
                        .where(UserAddress.user_id == user_id)
                        .limit(1)
                    )
                    addr = UserAddress(
                        user_id=user_id,
                        title=city or "آدرس",
                        province=province,
                        city=city,
                        zip_code=zip_code,
                        address=address,
                        is_default=first_id is None,
                    )
                    tx.add(addr)

            # (d) Order (number assigned after flush, from the PK). The shipping
            #     block snapshots the resolved address + the receiver's phone.
            order = Order(
                user_id=user_id,
                status=OrderStatus.pending,
                shipping_method=shipping_method,
                shipping_cost=shipping_cost,
                discount_amount=discount,
                vat_amount=vat,
                total_amount=total,
                signature_packaging=signature_packaging,
                shipping_details={
                    "name": customer.full_name,
                    "phone": customer.phone,
                    "province": province or "",
                    "city": city or "",
                    "address": address or "",
                    "postal_code": zip_code or "",
                    **({"note": customer.note} if customer.note else {}),
                },
                order_number="ORD-0000",  # placeholder, replaced below
            )
            tx.add(order)
            await tx.flush()
            order.order_number = f"ORD-{order.id:04d}"
            order_id: int = order.id

            # (e) Line items — snapshot prices + variant selections captured at
            #     purchase. The care-oil flag is the *effective* value (selected
            #     AND enabled in store settings), matching the storefront.
            for line in lines:
                product = products[line.product_id]
                oil_added = bool(line.care_oil_added and care_oil_enabled)
                tx.add(
                    OrderItem(
                        order_id=order_id,
                        product_id=product.id,
                        quantity=line.quantity,
                        unit_price=product.base_price,
                        care_oil_added=oil_added,
                        care_oil_price=(care_oil_price if oil_added else _ZERO),
                        wood_type=line.wood_type,
                        color=line.color,
                    )
                )

            # (f) Promo redemption counter (same transaction).
            if promo is not None:
                tx_promo = await tx.get(PromoCode, promo.id)
                if tx_promo is not None:
                    tx_promo.times_used += 1

    return order_id