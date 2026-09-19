"""Category endpoints (Phase 3: list + create; update/delete land later)."""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import Category
from schemas.category import CategoryCreate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])

_NON_SLUG = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    """Derive a kebab-case slug from a display name.

    Non-Latin names (e.g. Persian) have no kebab-case form; for those a short
    unique token is returned. Uniqueness of the *name* is enforced separately,
    so the token only needs to avoid slug collisions.
    """
    slug = _NON_SLUG.sub("-", name.lower()).strip("-")[:140].rstrip("-")
    if not slug:
        slug = f"cat-{uuid.uuid4().hex[:10]}"
    return slug


@router.get(
    "",
    response_model=list[CategoryResponse],
    summary="List all categories",
)
async def list_categories(db: AsyncSession = Depends(get_db)) -> list[Category]:
    result = await db.execute(select(Category).order_by(Category.name))
    return list(result.scalars().all())


@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a category",
)
async def create_category(
    payload: CategoryCreate, db: AsyncSession = Depends(get_db)
) -> Category:
    name = payload.name.strip()
    slug = (payload.slug or "").strip() or slugify(name)

    clash = await db.execute(
        select(Category.id).where(or_(Category.name == name, Category.slug == slug))
    )
    if clash.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A category with name {name!r} or slug {slug!r} already exists.",
        )

    category = Category(name=name, slug=slug, image_url=payload.image_url)
    db.add(category)
    try:
        await db.commit()
    except IntegrityError as exc:  # concurrent insert beat us to the unique index
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A category with this name or slug already exists.",
        ) from exc
    await db.refresh(category)
    return category