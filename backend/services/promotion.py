"""Promo code validation & discount math (Phase 4).

Shared by the ``/promotions/validate`` endpoint and the checkout service so
the two can never drift apart. Rules (mirroring the storefront):

- code lookup is case-insensitive (codes are stored uppercased);
- the code must be ``is_active``;
- ``usage_limit`` > 0 with ``times_used >= usage_limit`` means exhausted
  (``usage_limit`` NULL/0 = unlimited);
- ``cart_subtotal`` must be >= ``min_purchase_amount`` (0 = no minimum);
- discount = ``cart_subtotal * discount_percentage / 100``, rounded half-up
  to whole toman (frontend parity), capped at ``max_discount_amount`` when
  that cap is positive (NULL/0 = uncapped).
"""

from __future__ import annotations

from decimal import Decimal

from db.models import PromoCode
from core.pricing import q2, round_money
from services.errors import CheckoutError


class PromoError(CheckoutError):
    """A promo code failed a validation rule (endpoints map to HTTP 400)."""


def calc_discount(promo: PromoCode, cart_subtotal: Decimal) -> Decimal:
    """Exact discount (whole toman, 2-place form) for this promo at a subtotal."""
    raw = Decimal(cart_subtotal) * promo.discount_percentage / Decimal("100")
    discount = q2(round_money(raw))
    cap = promo.max_discount_amount
    if cap is not None and Decimal(cap) > 0:
        discount = min(discount, q2(Decimal(cap)))
    return discount


def assert_redeemable(promo: PromoCode, cart_subtotal: Decimal) -> None:
    """Raise :class:`PromoError` when the code cannot be redeemed right now."""
    if not promo.is_active:
        raise PromoError(f"Promo code '{promo.code}' is not active.")
    if (
        promo.usage_limit is not None
        and promo.usage_limit > 0
        and promo.times_used >= promo.usage_limit
    ):
        raise PromoError(f"Promo code '{promo.code}' usage limit has been reached.")
    minimum = promo.min_purchase_amount or Decimal("0")
    if Decimal(cart_subtotal) < minimum:
        raise PromoError(
            f"Cart subtotal is below the minimum purchase for code "
            f"'{promo.code}' ({minimum} toman)."
        )