"""Pydantic schemas for the Category entity.

Maps 1:1 to ``db.models.Category`` (id / name / slug / image_url).
"""

from pydantic import BaseModel, ConfigDict, Field

from schemas.common import ImageHttpUrl

#: kebab-case URL slug (matches what the storefront already uses).
SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class CategoryBase(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=120,
        examples=["دکوری و اداری چوبی"],
        description="Display name (unique).",
    )
    slug: str | None = Field(
        default=None,
        min_length=2,
        max_length=140,
        pattern=SLUG_PATTERN,
        description=(
            "URL-friendly identifier (unique). Auto-derived from the name when "
            "omitted; for non-Latin names a unique token is generated."
        ),
    )
    image_url: ImageHttpUrl | None = Field(
        default=None,
        description="Category banner image (public MinIO object URL).",
    )


class CategoryCreate(CategoryBase):
    """Payload for POST /categories."""


class CategoryUpdate(BaseModel):
    """Partial update — only explicitly provided fields are applied.

    ``image_url`` semantics: omitted = unchanged; ``null`` = remove the image.
    """

    name: str | None = Field(default=None, min_length=2, max_length=120)
    slug: str | None = Field(
        default=None, min_length=2, max_length=140, pattern=SLUG_PATTERN
    )
    image_url: ImageHttpUrl | None = Field(
        default=None,
        description="Public MinIO object URL; send null to clear the image.",
    )


class CategoryResponse(BaseModel):
    """ORM-safe read model (``from_attributes`` serializes ``Category``)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    image_url: str | None