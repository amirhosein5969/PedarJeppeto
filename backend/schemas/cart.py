"""Shopping cart schemas (Phase 4 + Phase 7 variants)."""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class CartAddIn(BaseModel):
    """Body for ``POST /cart/add``. The session rides in X-Session-Id.

    ``wood_type`` / ``color`` are the customer's variant selections for the
    line (Phase 7); they ride with the line and land on the order items.
    """

    product_id: int = Field(ge=1)
    quantity: int = Field(default=1, ge=1, le=20)
    care_oil_added: bool = False
    wood_type: Optional[str] = Field(default=None, max_length=120)
    color: Optional[str] = Field(default=None, max_length=120)

    @field_validator("wood_type", "color", mode="after")
    @classmethod
    def _strip_variants(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return v.strip() or None


class CartLineOut(BaseModel):
    """A cart line enriched with the *current* DB price."""

    product_id: int
    title: str
    unit_price: Decimal
    quantity: int
    care_oil_added: bool
    # Variant selections (Phase 7); null when the customer picked none.
    wood_type: Optional[str] = None
    color: Optional[str] = None
    # unit_price * quantity (+ care-oil price when opted in) — storefront parity.
    line_subtotal: Decimal


class CartOut(BaseModel):
    """Full cart payload.

    ``subtotal`` is goods + per-line care oil (the same base the storefront
    uses for the promo minimum and the free-shipping threshold).
    ``unavailable`` lists product ids present in the cart but missing or
    deactivated in the catalog (they are excluded from ``items``).
    """

    items: list[CartLineOut]
    count: int
    subtotal: Decimal
    unavailable: list[int] = Field(default_factory=list)


class CartLineUpdateIn(BaseModel):
    """Body for ``PATCH /cart/line`` — absolute quantity for an existing/new line.

    The storefront always echoes the line's current variant values back here so
    a quantity/oil tweak never silently clears them.
    """

    product_id: int = Field(ge=1)
    quantity: int = Field(default=1, ge=1, le=20)
    care_oil_added: bool = False
    wood_type: Optional[str] = Field(default=None, max_length=120)
    color: Optional[str] = Field(default=None, max_length=120)

    @field_validator("wood_type", "color", mode="after")
    @classmethod
    def _strip_variants(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return v.strip() or None


class CartRemoveOut(BaseModel):
    removed: bool


class CartClearOut(BaseModel):
    cleared: bool