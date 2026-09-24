"""Store settings endpoints (singleton) — GET + partial PATCH.

The settings row is the source of truth for the seller block and all checkout
pricing. ``GET`` stays public (the storefront renders the seller block +
pricing). ``PATCH`` accepts any subset of fields and is **admin-only**;
after a successful write the Redis cache is refreshed so the next checkout
sees the new prices immediately.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_admin_user
from db.database import get_db
from db.models import User
from schemas.settings import StoreSettingsOut, StoreSettingsUpdate
from services.settings import update_store_settings, get_store_settings_data

router = APIRouter(prefix="/settings", tags=["settings"])


def _to_out(data) -> StoreSettingsOut:
    return StoreSettingsOut(
        store_name=data.store_name,
        support_phone=data.support_phone,
        email=data.email,
        address=data.address,
        zip_code=data.zip_code,
        announcement_text=data.announcement_text,
        vat_percentage=data.vat_percentage,
        care_oil_price=data.care_oil_price,
        care_oil_enabled=data.care_oil_enabled,
        signature_packaging_price=data.signature_packaging_price,
        signature_packaging_enabled=data.signature_packaging_enabled,
        shipping_methods=[
            {
                "id": m["id"],
                "title": m["title"],
                "note": m["note"],
                "fee": m["fee"],
            }
            for m in data.shipping_methods
        ],
    )


@router.get("", response_model=StoreSettingsOut, summary="Get store settings")
async def get_settings(db: AsyncSession = Depends(get_db)) -> StoreSettingsOut:
    data = await get_store_settings_data(db)
    return _to_out(data)


@router.patch(
    "", response_model=StoreSettingsOut, summary="Update store settings (partial, admin)"
)
async def patch_settings(
    payload: StoreSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> StoreSettingsOut:
    updates = payload.model_dump(exclude_unset=True)
    if "shipping_methods" in updates and updates["shipping_methods"] is not None:
        # Persist as plain JSON: fee as a number (toman).
        updates["shipping_methods"] = [
            {
                "id": m["id"],
                "title": m["title"],
                "note": m["note"],
                "fee": float(m["fee"]),
            }
            for m in updates["shipping_methods"]
        ]
    data = await update_store_settings(db, updates)
    return _to_out(data)