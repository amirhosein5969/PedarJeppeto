"""Product catalog endpoints (Phase 3: list + create + read by id;
Phase 5: partial update + active filter for the storefront/admin split)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_admin_user
from db.database import get_db
from db.models import Category, Product, User
from schemas.product import ProductCreate, ProductResponse, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.get(
    "",
    response_model=list[ProductResponse],
    summary="List products",
)
async def list_products(
    db: AsyncSession = Depends(get_db),
    active: Optional[bool] = Query(
        default=None,
        description="True = only active (storefront), False = only inactive, "
        "omitted = everything (admin).",
    ),
) -> list[Product]:
    stmt = select(Product).order_by(Product.id)
    if active is not None:
        stmt = stmt.where(Product.is_active.is_(active))
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a product (admin)",
)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Product:
    # FK is RESTRICT, so a dangling category_id would 500 — fail fast with 404.
    exists = await db.execute(
        select(Category.id).where(Category.id == payload.category_id)
    )
    if exists.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category {payload.category_id} does not exist.",
        )

    product = Product(**payload.model_dump())
    db.add(product)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create the product (reference conflict).",
        ) from exc
    await db.refresh(product)
    return product


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get a product by id",
)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)) -> Product:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} does not exist.",
        )
    return product


@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update a product (partial, admin)",
)
async def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Product:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} does not exist.",
        )

    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data and data["category_id"] != product.category_id:
        exists = await db.execute(
            select(Category.id).where(Category.id == data["category_id"])
        )
        if exists.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category {data['category_id']} does not exist.",
            )
    for field, value in data.items():
        setattr(product, field, value)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not update the product (reference conflict).",
        ) from exc
    await db.refresh(product)
    return product