"""Money math helpers + the one non-configurable checkout rule.

The store's *pricing values* (VAT %, care-oil price, signature-packaging
price, shipping-method fees) are **no longer hardcoded here** — they live in
the ``store_settings`` table and are fetched dynamically (see
:mod:`services.settings`). This module now keeps only:

* exact-``Decimal`` rounding helpers (``q2``, ``round_money``, ``money``);
* the free-shipping threshold (a business rule, not seller-configurable in
  the storefront); and
* ``DEFAULT_SHIPPING_METHODS`` — the fallback catalog used when the stored
  ``shipping_methods`` list is empty, so checkout can never break on a
  misconfigured/blank settings row.

All amounts are integer toman expressed as :class:`decimal.Decimal`. Never
use floats for money.

Checkout total contract (mirrors the storefront; prices from settings):
    goods        = sum(unit_price * qty)                 for each line
    care_oil     = sum(care_oil_price)                   once per line w/ oil
    goods_total  = goods + care_oil
    gift_box     = signature_packaging_price if packaging else 0
    discount     = min(goods_total * pct / 100, cap)     if promo else 0
    taxable_base = max(0, goods_total + gift_box - discount)
    vat          = taxable_base * vat_percentage / 100
    shipping     = 0 if goods_total >= FREE_SHIPPING_FROM else method_fee
    total        = taxable_base + vat + shipping
"""

from decimal import ROUND_HALF_UP, Decimal

# --- Free shipping (business rule, not seller-configurable) ----------------
# Orders whose goods total (incl. care oil) reach this ship free.
FREE_SHIPPING_FROM: Decimal = Decimal("5000000")

# Fallback shipping catalog (mirrors the frontend DEFAULT_STORE_SETTINGS).
# Used only when store_settings.shipping_methods is empty.
DEFAULT_SHIPPING_METHODS: list[dict] = [
    {"id": "standard", "title": "پست پیشتاز", "note": "۳ تا ۵ روز کاری", "fee": 69000},
    {"id": "express", "title": "ارسال سریع تهران", "note": "تحویل کمتر از ۲۴ ساعت", "fee": 145000},
]


def q2(value: Decimal) -> Decimal:
    """Quantize a money ``Decimal`` to 2 places, half-up (stable, exact)."""
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def money(value: Decimal | int | str) -> Decimal:
    """Coerce a numeric input to a 2-place ``Decimal`` (exact)."""
    if not isinstance(value, Decimal):
        value = Decimal(value)
    return q2(value)


def round_money(value: Decimal) -> Decimal:
    """Half-up rounding to whole toman, matching the frontend ``Math.round``.

    The storefront rounds VAT and discounts to integer toman. We mirror that
    with exact ``Decimal`` arithmetic (no float drift).
    """
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)