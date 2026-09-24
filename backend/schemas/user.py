"""User (customer) models — admin user board (Phase 5) + customer portal
(Phase 6: the ``/users/me`` family) + secure phone-change OTP (Phase 13)."""

import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from db.models import OrderStatus, UserRole
from schemas.order import canonical_phone, to_ascii_digits

_CANONICAL_PHONE_RE = re.compile(r"^09[0-9]{9}$")
_PHONE_CHANGE_CODE_RE = re.compile(r"^[0-9]{6}$")


class UserResponse(BaseModel):
    """ORM-safe read model (``from_attributes`` serializes ``User``).

    ``order_count`` / ``total_spent`` are correlated subqueries attached by
    the endpoint (excluded here so ``from_attributes`` never needs them).
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str
    role: UserRole
    full_name: str
    is_active: bool
    province: str | None
    city: str | None
    zip_code: str | None
    address: str | None
    created_at: datetime
    order_count: int
    #: Sum of ``orders.total_amount`` over non-cancelled orders (toman).
    total_spent: Decimal


# =============================================================================
# Customer portal (Phase 6) — the /users/me family
# =============================================================================


class UserMeOut(BaseModel):
    """The logged-in customer's own profile (``GET/PATCH /users/me``).

    Unlike :class:`UserResponse`, this exposes ``important_date`` (the
    gifting-reminder field) and omits the admin-only aggregates. Shipping
    addresses live in the address book (``GET /users/me/addresses``), so this
    no longer carries the flat province/city/zip/address fields (Phase 7).
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str
    role: UserRole
    full_name: str
    important_date: str | None
    created_at: datetime


class UserMeUpdate(BaseModel):
    """Body for ``PATCH /users/me`` — a partial profile update.

    Every field is optional (PATCH semantics: only the keys present are
    written). ``None`` clears a nullable field; an omitted key is left
    untouched. (Addresses are managed separately via the address-book
    endpoints — Phase 7.)
    """

    full_name: str | None = Field(default=None, min_length=3, max_length=120)
    # Free-form important dates (birthdays / anniversaries) for reminders.
    important_date: str | None = Field(default=None, max_length=120)

    @field_validator("full_name", "important_date")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else v


# =============================================================================
# Secure phone change — /users/me/change-phone-request|verify
# =============================================================================


class PhoneChangeRequestIn(BaseModel):
    """Body for ``POST /users/me/change-phone-request``.

    ``new_phone`` is normalized to canonical ``09xxxxxxxxx`` (same rules
    as login); a 6-digit OTP is then dispatched to THAT number, so the
    request proves possession of the new phone before anything changes.
    """

    new_phone: str

    @field_validator("new_phone")
    @classmethod
    def _canonicalize(cls, value: str) -> str:
        phone = canonical_phone(value.strip())
        if not _CANONICAL_PHONE_RE.match(phone):
            raise ValueError(
                "شماره موبایل معتبر نیست؛ باید ۱۱ رقم و با 09 شروع شود."
            )
        return phone


class PhoneChangeSentOut(BaseModel):
    sent: bool
    #: How long the confirmation code stays valid (seconds).
    ttl_seconds: int


class PhoneChangeVerifyIn(BaseModel):
    """Body for ``POST /users/me/change-phone-verify`` — the 6-digit code."""

    code: str

    @field_validator("code")
    @classmethod
    def _digits_only(cls, value: str) -> str:
        code = re.sub(r"\D", "", to_ascii_digits(value).strip())
        if not _PHONE_CHANGE_CODE_RE.match(code):
            raise ValueError("کد تأیید باید ۶ رقم باشد.")
        return code


# =============================================================================
# Customer address book (Phase 7) — /users/me/addresses
# =============================================================================


class UserAddressOut(BaseModel):
    """One saved shipping address for the logged-in customer."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    province: str | None
    city: str | None
    zip_code: str | None
    address: str | None
    is_default: bool


class UserAddressIn(BaseModel):
    """Body for ``POST /users/me/addresses`` — create a new saved address."""

    title: str = Field(default="آدرس", max_length=80)
    province: str = Field(min_length=2, max_length=100)
    city: str = Field(min_length=2, max_length=100)
    zip_code: str | None = Field(default=None, pattern=r"^\d{10}$")
    address: str = Field(min_length=10, max_length=300)
    is_default: bool = False

    @field_validator("title", "province", "city", "address")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("zip_code")
    @classmethod
    def _strip_zip(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else v


class UserAddressUpdate(BaseModel):
    """Body for ``PUT /users/me/addresses/{id}`` — partial update.

    Omitted keys are left untouched; ``None`` clears a nullable field.
    Setting ``is_default`` true promotes it (clearing the other default).
    """

    title: str | None = Field(default=None, max_length=80)
    province: str | None = Field(default=None, min_length=2, max_length=100)
    city: str | None = Field(default=None, min_length=2, max_length=100)
    zip_code: str | None = Field(default=None, pattern=r"^\d{10}$")
    address: str | None = Field(default=None, min_length=10, max_length=300)
    is_default: bool | None = None

    @field_validator("title", "province", "city", "address")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else v


class MyOrderItemOut(BaseModel):
    """An order line for the customer's own history (with a product image)."""

    product_id: int
    title: str
    quantity: int
    unit_price: Decimal
    #: The product's primary image (``images[0]``); null if none is set.
    image: str | None


class MyOrderOut(BaseModel):
    """A customer's order, light on detail (the card UI's needs)."""

    id: int
    order_number: str
    status: OrderStatus
    total_amount: Decimal
    created_at: datetime
    items: list[MyOrderItemOut]