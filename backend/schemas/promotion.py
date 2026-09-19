"""Promo code schemas (Phase 4) — admin CRUD + checkout validation."""

import re
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

_CODE_RE = re.compile(r"^[A-Z0-9]+$")


def _canonical_code(value: str) -> str:
    code = value.strip().upper()
    if not _CODE_RE.match(code):
        raise ValueError("Code must be alphanumeric (A-Z, 0-9 only).")
    return code


def _zero_is_unlimited(value: Optional[Decimal]) -> Optional[Decimal]:
    """Frontend uses 0 for 'no cap'; the DB model uses NULL. Normalize."""
    if value is not None and Decimal(value) == 0:
        return None
    return value


class PromoCreate(BaseModel):
    """Body for ``POST /promotions``."""

    code: str = Field(min_length=3, max_length=32)
    discount_percentage: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)
    max_discount_amount: Optional[Decimal] = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )
    min_purchase_amount: Decimal = Field(
        default=Decimal("0"), ge=0, max_digits=10, decimal_places=2
    )
    usage_limit: Optional[int] = Field(default=None, ge=0)
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def _canonicalize_code(cls, v: str) -> str:
        return _canonical_code(v)

    @field_validator("max_discount_amount")
    @classmethod
    def _cap(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return _zero_is_unlimited(v)


class PromoUpdate(BaseModel):
    """Body for ``PATCH /promotions/{id}`` — partial updates only."""

    code: Optional[str] = Field(default=None, min_length=3, max_length=32)
    discount_percentage: Optional[Decimal] = Field(
        default=None, ge=0, le=100, max_digits=5, decimal_places=2
    )
    max_discount_amount: Optional[Decimal] = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )
    min_purchase_amount: Optional[Decimal] = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )
    usage_limit: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None

    @field_validator("code")
    @classmethod
    def _canonicalize_code(cls, v: Optional[str]) -> Optional[str]:
        return _canonical_code(v) if v is not None else v

    @field_validator("max_discount_amount")
    @classmethod
    def _cap(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return _zero_is_unlimited(v)


class PromoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    discount_percentage: Decimal
    max_discount_amount: Optional[Decimal]
    min_purchase_amount: Decimal
    usage_limit: Optional[int]
    times_used: int
    is_active: bool


class PromoValidateIn(BaseModel):
    """Body for ``POST /promotions/validate`` (checkout preview)."""

    code: str = Field(min_length=1, max_length=64)
    # Goods total incl. per-line care oil — the same base the storefront shows.
    cart_subtotal: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class PromoValidateOut(BaseModel):
    """Exact discount the checkout would apply (whole toman)."""

    code: str
    valid: bool = True
    discount_percentage: Decimal
    max_discount_amount: Optional[Decimal]
    min_purchase_amount: Decimal
    discount_amount: Decimal