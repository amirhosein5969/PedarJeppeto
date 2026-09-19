"""Pydantic schemas for the Product entity.

Maps 1:1 to ``db.models.Product``:
``id / title / description / base_price / stock_count / images /
profit_margin / category_id / is_active``.
"""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from schemas.common import ImageHttpUrl


class ProductBase(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=1, max_length=20_000)
    base_price: Decimal = Field(
        gt=0,
        max_digits=10,
        decimal_places=2,
        description="Base unit price in toman.",
    )
    #: Pre-discount shelf price; ``None`` = no discount shown.
    list_price: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=10,
        decimal_places=2,
        description="Original price in toman (strikethrough when > base_price).",
    )
    stock_count: int = Field(default=0, ge=0, le=1_000_000)
    #: Ordered gallery of public MinIO URLs. Index 0 = primary card image,
    #: index 1 = card hover cross-fade, the rest feed the product-page gallery.
    images: list[ImageHttpUrl] = Field(default_factory=list, max_length=24)
    profit_margin: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=10,
        decimal_places=2,
        description="Per-unit profit margin in toman (dashboard analytics).",
    )
    is_active: bool = Field(default=True, description="Soft-delete flag (FKs are RESTRICT).")


class ProductCreate(ProductBase):
    """Payload for POST /products."""

    category_id: int = Field(gt=0, description="Must reference an existing category.")


class ProductUpdate(BaseModel):
    """Partial update — only explicitly provided fields are applied."""

    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=20_000)
    base_price: Decimal | None = Field(
        default=None, gt=0, max_digits=10, decimal_places=2
    )
    #: ``None`` when explicitly provided clears the strikethrough price.
    list_price: Decimal | None = Field(
        default=None, gt=0, max_digits=10, decimal_places=2
    )
    stock_count: int | None = Field(default=None, ge=0, le=1_000_000)
    images: list[ImageHttpUrl] | None = Field(default=None, max_length=24)
    profit_margin: Decimal | None = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )
    is_active: bool | None = None
    category_id: int | None = Field(default=None, gt=0)


class ProductResponse(BaseModel):
    """ORM-safe read model (``from_attributes`` serializes ``Product``)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    base_price: Decimal
    list_price: Decimal | None
    stock_count: int
    images: list[str]
    profit_margin: Decimal
    category_id: int
    is_active: bool