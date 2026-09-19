"""Store settings schemas (singleton) — read model + partial update.

JSON field names are snake_case (consistent with the rest of the API). The
frontend's ``StoreSettings`` type maps 1:1, except ``phone`` ->
``support_phone`` and ``giftBox*`` -> ``signature_packaging_*`` (see AGENT.md).
Money fields serialize as exact decimal strings, like the rest of the API.
"""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class ShippingMethodOut(BaseModel):
    id: str
    title: str
    note: str
    fee: Decimal


class ShippingMethodIn(ShippingMethodOut):
    fee: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class StoreSettingsOut(BaseModel):
    """The full singleton settings row (GET /settings)."""

    store_name: str
    support_phone: str
    email: str
    address: str
    zip_code: str
    vat_percentage: Decimal
    care_oil_price: Decimal
    care_oil_enabled: bool
    signature_packaging_price: Decimal
    signature_packaging_enabled: bool
    shipping_methods: list[ShippingMethodOut]


class StoreSettingsUpdate(BaseModel):
    """Partial update (PATCH /settings) — only provided fields are changed."""

    store_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    support_phone: Optional[str] = Field(default=None, min_length=1, max_length=20)
    email: Optional[str] = Field(default=None, max_length=120)
    address: Optional[str] = Field(default=None, max_length=300)
    zip_code: Optional[str] = Field(default=None, max_length=20)
    vat_percentage: Optional[Decimal] = Field(
        default=None, ge=0, le=100, max_digits=5, decimal_places=2
    )
    care_oil_price: Optional[Decimal] = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )
    care_oil_enabled: Optional[bool] = None
    signature_packaging_price: Optional[Decimal] = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )
    signature_packaging_enabled: Optional[bool] = None
    shipping_methods: Optional[list[ShippingMethodIn]] = None