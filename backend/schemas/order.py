"""Order & checkout schemas (Phase 4).

The checkout request carries the receiver's billing/shipping block (which
creates or updates the ``User`` keyed by canonical phone), the shipping
method, an optional promo code, the signature-packaging flag, and — via the
``X-Session-Id`` header — the cart to consume.
"""

import re
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from db.models import Order, OrderItem, OrderStatus

# Frontend parity: irPhoneRegex = /^(?:\+98|0)?9\d{9}$/
_CANONICAL_PHONE_RE = re.compile(r"^09[0-9]{9}$")

#: Persian + Arabic-Indic digits → ASCII. Python's ``\d``/``\D`` are
#: Unicode-aware, so Iranian users can paste Persian digits ANYWHERE
#: (phones, OTP codes); without translation a "۱۲۳۴۵۶" code would pass
#: validation yet never match the ASCII code stored by the generator.
_DIGIT_MAP = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def to_ascii_digits(raw: str) -> str:
    """Translate Persian/Arabic-Indic digits to ASCII (keeps everything else)."""
    return raw.translate(_DIGIT_MAP)


def canonical_phone(raw: str) -> str:
    """Normalize an Iranian mobile number to its canonical ``09xxxxxxxxx``."""
    s = to_ascii_digits(raw.strip())
    if s.startswith("+98"):
        s = "0" + s[3:]
    elif s.startswith("0098"):
        s = "0" + s[4:]
    elif s.startswith("9") and len(s) == 10:
        s = "0" + s
    return s


class CustomerIn(BaseModel):
    """Receiver block — creates or updates the ``User`` at checkout.

    When the customer is logged in, ``address_id`` may reference one of their
    saved :class:`~db.models.UserAddress` rows (selected from the address book
    at checkout). When it is ``None``, the ``province``/``city``/``address``
    fields describe a *new* address, which the backend auto-saves to the book.
    """

    full_name: str = Field(min_length=3, max_length=120)
    phone: str = Field(min_length=9, max_length=15)
    province: str = Field(min_length=2, max_length=100)
    city: str = Field(min_length=2, max_length=100)
    # 10-digit Iranian postal code; optional for express (in-city) delivery.
    zip_code: Optional[str] = Field(default=None, pattern=r"^\d{10}$")
    address: str = Field(min_length=10, max_length=300)
    note: Optional[str] = Field(default=None, max_length=300)
    # Optional saved address (Phase 7): the selected address-book entry.
    address_id: Optional[int] = Field(default=None, ge=1)

    @field_validator("full_name", "province", "city", "address")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("phone")
    @classmethod
    def _canonicalize_phone(cls, v: str) -> str:
        canon = canonical_phone(v)
        if not _CANONICAL_PHONE_RE.match(canon):
            raise ValueError(
                "Phone must be a valid Iranian mobile number (e.g. 09123456789)."
            )
        return canon


class OrderCreateIn(BaseModel):
    """Body for ``POST /orders`` (checkout). Cart rides in X-Session-Id."""

    customer: CustomerIn
    shipping_method: str = Field(min_length=2, max_length=60)
    promo_code: Optional[str] = Field(default=None, max_length=64)
    signature_packaging: bool = False


class OrderItemOut(BaseModel):
    """Order line with the product title (joined from the catalog)."""

    product_id: int
    title: str
    quantity: int
    # Snapshot values captured at purchase time.
    unit_price: Decimal
    care_oil_added: bool
    care_oil_price: Decimal
    # Variant selections captured at purchase (Phase 7); null when not chosen.
    wood_type: Optional[str]
    color: Optional[str]


class CustomerOut(BaseModel):
    id: int
    full_name: str
    phone: str
    province: Optional[str]
    city: Optional[str]
    zip_code: Optional[str]
    address: Optional[str]


class OrderOut(BaseModel):
    """Admin-facing order with full detail (items + customer)."""

    id: int
    order_number: str
    status: OrderStatus
    shipping_method: Optional[str]
    signature_packaging: bool
    shipping_cost: Decimal
    discount_amount: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    created_at: datetime
    customer: CustomerOut
    # {name, phone, province, city, address, postal_code[, note]}
    shipping_details: Optional[dict]
    items: list[OrderItemOut]


class OrderStatusIn(BaseModel):
    """Body for ``PATCH /orders/{id}/status``."""

    status: OrderStatus


def to_order_out(order: Order) -> OrderOut:
    """Project an ORM Order (with user + items+product loaded) to the API shape."""
    details = order.shipping_details or {}
    return OrderOut(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        shipping_method=order.shipping_method,
        signature_packaging=order.signature_packaging,
        shipping_cost=order.shipping_cost,
        discount_amount=order.discount_amount,
        vat_amount=order.vat_amount,
        total_amount=order.total_amount,
        created_at=order.created_at,
        # The customer's address now lives on the order (shipping_details), not
        # on the User row (Phase 7 moved it to the address book).
        customer=CustomerOut(
            id=order.user.id,
            full_name=order.user.full_name,
            phone=order.user.phone,
            province=details.get("province"),
            city=details.get("city"),
            zip_code=details.get("postal_code") or None,
            address=details.get("address"),
        ),
        shipping_details=order.shipping_details,
        items=[
            OrderItemOut(
                product_id=item.product_id,
                title=item.product.title,
                quantity=item.quantity,
                unit_price=item.unit_price,
                care_oil_added=item.care_oil_added,
                care_oil_price=item.care_oil_price,
                wood_type=item.wood_type,
                color=item.color,
            )
            for item in order.items
        ],
    )