"""SQLAlchemy 2.0 ORM models for the Handcrafted Hearthwood domain.

Conventions
-----------
- Typed 2.0 style only: ``Mapped[...]`` + ``mapped_column(...)``.
- Money is ``Numeric(10, 2)`` (exact decimal, no float).
- Enums are stored as VARCHAR + CHECK (``native_enum=False``) for
  portability and painless value changes.
- FK delete rules are deliberate:
    * users / categories / products are never hard-deleted while
      referenced (RESTRICT) — deactivate via ``is_active`` instead.
    * order_items cascade-delete with their parent order.
"""

import enum
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from db.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    customer = "customer"


class OrderStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


class User(Base):
    """Customer or admin. Auth is OTP-based (Phase 4) — no password fields."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", native_enum=False, length=20),
        default=UserRole.customer,
    )
    full_name: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Free-form important dates for gifting reminders (Phase 6) — birthday,
    # anniversary, … e.g. "تولد: ۱۳۷۵/۰۴/۲۰ — سالگرد: ۱۳۹۸/۰۶/۱۲".
    important_date: Mapped[Optional[str]] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # One user places many orders.
    orders: Mapped[List["Order"]] = relationship(back_populates="user")
    # One user keeps many shipping addresses (Phase 7 address book). Lines are
    # removed with their owner (RESTRICT is deliberately avoided here).
    addresses: Mapped[List["UserAddress"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id} phone={self.phone!r} role={self.role}>"


class UserAddress(Base):
    """A saved shipping address for a customer (Phase 7 address book).

    A user may keep several named addresses; at most one is flagged
    ``is_default`` (enforced in the application layer, not a DB constraint).
    Checkout auto-saves the receiver's block here so a logged-in customer
    builds up a reusable book; the customer portal edits it directly.
    """

    __tablename__ = "user_addresses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Short label shown on the address card, e.g. "خانه" / "محل کار".
    title: Mapped[str] = mapped_column(String(80), default="آدرس")
    province: Mapped[Optional[str]] = mapped_column(String(100))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    zip_code: Mapped[Optional[str]] = mapped_column(String(20))
    address: Mapped[Optional[str]] = mapped_column(String(300))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Many addresses belong to one user.
    user: Mapped["User"] = relationship(back_populates="addresses")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<UserAddress id={self.id} user_id={self.user_id} default={self.is_default}>"


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    slug: Mapped[str] = mapped_column(String(140), unique=True, index=True)
    # Optional banner / thumbnail for the category (MinIO URL, Phase 3).
    image_url: Mapped[Optional[str]] = mapped_column(String(512))

    # One category groups many products.
    products: Mapped[List["Product"]] = relationship(back_populates="category")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Category id={self.id} slug={self.slug!r}>"


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    # Pre-discount shelf price (nullable). When set and higher than
    # ``base_price`` the storefront renders a strikethrough + a derived
    # discount badge (Phase 5 storefront parity).
    list_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    stock_count: Mapped[int] = mapped_column(Integer, default=0)
    # Product gallery — ordered array of MinIO image URLs (Phase 3). Index 0 is
    # the primary image, index 1 the hover cross-fade; the rest are the gallery.
    images: Mapped[Optional[list]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql")
    )
    # Profit margin per unit (toman) — tracks item profitability.
    profit_margin: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), server_default=text("0")
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), index=True
    )
    # Indexed: catalog listings filter on active products.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    # Many products belong to one category.
    category: Mapped["Category"] = relationship(back_populates="products")
    # A product appears in many order lines (price/stock history preserved).
    order_items: Mapped[List["OrderItem"]] = relationship(
        back_populates="product"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Product id={self.id} title={self.title!r}>"


class PromoCode(Base):
    """Coupon engine input (validation/stacking logic lands in Phase 4)."""

    __tablename__ = "promo_codes"
    __table_args__ = (
        CheckConstraint(
            "discount_percentage >= 0 AND discount_percentage <= 100",
            name="ck_promo_codes_discount_percentage_range",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    discount_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    # Optional cap on the absolute discount granted by this code.
    max_discount_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    # Minimum cart subtotal (toman) required to redeem; 0 = no minimum.
    min_purchase_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), server_default=text("0")
    )
    # Optional total-redemption cap.
    usage_limit: Mapped[Optional[int]] = mapped_column(Integer)
    times_used: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    @validates("code")
    def _normalize_code(self, _key: str, value: Optional[str]) -> Optional[str]:
        """Codes are canonicalized to uppercase, trimmed form."""
        if value is None:
            return value
        return value.strip().upper()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<PromoCode code={self.code!r} pct={self.discount_percentage}>"


class Order(Base):
    """A materialized checkout. Totals are snapshots — recompute on checkout."""

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Human-facing reference, e.g. "ORD-1400".
    order_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    # Indexed: the admin order board filters/sorts by status.
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status", native_enum=False, length=20),
        default=OrderStatus.pending,
        index=True,
    )
    shipping_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00")
    )
    # Chosen shipping method id (e.g. "standard"/"express"); the display title
    # is resolved from the configurable store settings.
    shipping_method: Mapped[Optional[str]] = mapped_column(String(60))
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00")
    )
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00")
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    # Receiver's address & zip code (JSONB on PostgreSQL).
    shipping_details: Mapped[Optional[dict]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql")
    )
    # Premium branded gift-wrap option.
    signature_packaging: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Many orders belong to one user.
    user: Mapped["User"] = relationship(back_populates="orders")
    # One order contains many line items (orphan lines are removed).
    items: Mapped[List["OrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Order id={self.id} number={self.order_number!r} status={self.status}>"


class OrderItem(Base):
    """A single line inside an order. Prices are snapshot values at purchase."""

    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), index=True
    )
    quantity: Mapped[int] = mapped_column(Integer)
    # Unit price captured at purchase time (not the live product price).
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    # Add-on care-oil selection (Phase 4 logic decides price/availability).
    care_oil_added: Mapped[bool] = mapped_column(Boolean, default=False)
    care_oil_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00")
    )
    # Product-variant selections captured at purchase (Phase 7): the customer's
    # chosen wood type and the product color, snapshotted like the price.
    wood_type: Mapped[Optional[str]] = mapped_column(String(120))
    color: Mapped[Optional[str]] = mapped_column(String(120))

    # Many items belong to one order.
    order: Mapped["Order"] = relationship(back_populates="items")
    # Many items reference the same product.
    product: Mapped["Product"] = relationship(back_populates="order_items")

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<OrderItem id={self.id} order_id={self.order_id} "
            f"product_id={self.product_id} qty={self.quantity}>"
        )


class StoreSettings(Base):
    """Singleton row (``id = 1``) holding the seller's store configuration.

    Mirrors the storefront's admin store settings
    (``handcrafted-hearthwood/src/lib/admin-settings.ts`` ->
    ``DEFAULT_STORE_SETTINGS``): the seller block printed on invoices plus
    the luxury add-on / shipping pricing rules that checkout consumes.

    Column defaults mirror the frontend defaults so a freshly created row is
    immediately usable; the seed script writes the canonical values explicitly.
    """

    __tablename__ = "store_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    # --- Seller block (printed on the official invoice) -------------------
    store_name: Mapped[str] = mapped_column(
        String(120), default="PEDAR JEPETO"
    )
    support_phone: Mapped[str] = mapped_column(String(20), default="02177626411")
    email: Mapped[str] = mapped_column(String(120), default="mr.note.ir@gmail.com")
    address: Mapped[str] = mapped_column(
        String(300), default="تهران - تهران، میدان بهارستان، کوچه قرائت، پلاک ۴"
    )
    zip_code: Mapped[str] = mapped_column(String(20), default="1147945571")
    # --- Pricing rules (consumed by checkout) ------------------------------
    # Value-added tax percentage (0-100).
    vat_percentage: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("10"), server_default=text("10")
    )
    # Premium wood care oil — charged once per opted-in cart line (toman).
    care_oil_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("120000"), server_default=text("120000")
    )
    care_oil_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # Signature gift-box / wooden-crate packaging (toman, order-level add-on).
    signature_packaging_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("185000"), server_default=text("185000")
    )
    signature_packaging_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # Configurable shipping methods: [{id, title, note, fee}] (fee in toman).
    shipping_methods: Mapped[list] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        default=lambda: [
            {"id": "standard", "title": "پست پیشتاز", "note": "۳ تا ۵ روز کاری", "fee": 69000},
            {"id": "express", "title": "ارسال سریع تهران", "note": "تحویل کمتر از ۲۴ ساعت", "fee": 145000},
        ],
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<StoreSettings id={self.id} store={self.store_name!r}>"