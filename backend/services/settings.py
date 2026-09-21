"""Dynamic store settings (singleton) with a Redis-cached read model.

The ``store_settings`` table (single row, ``id = 1``) is the source of truth
for the seller block and all checkout pricing rules (VAT %, care-oil price,
signature-packaging price, shipping-method fees). Reading it on every
checkout would add a Postgres round-trip to a hot path, so reads are cached
in Redis (TTL :data:`CACHE_TTL_SECONDS`) and the cache is invalidated on
every write (see :func:`invalidate_store_settings_cache`).

A transient, read-only :class:`StoreSettingsData` value object is returned
(never a live ORM instance), so callers can use it safely after the request
session closes and after the cache is parsed.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.cache import get_redis
from core.pricing import DEFAULT_SHIPPING_METHODS, q2
from db.models import StoreSettings

CACHE_KEY = "settings:store"
CACHE_TTL_SECONDS = 300  # 5 minutes
_SETTINGS_ID = 1


@dataclass(frozen=True)
class PricingRules:
    """The pricing subset of settings that the checkout math consumes."""

    vat_percentage: Decimal
    care_oil_price: Decimal
    care_oil_enabled: bool
    signature_packaging_price: Decimal
    signature_packaging_enabled: bool
    #: method id -> fee in toman (2-place Decimal)
    shipping_fees: dict[str, Decimal]

    def shipping_fee(self, method_id: str) -> Decimal | None:
        return self.shipping_fees.get(method_id)


@dataclass(frozen=True)
class StoreSettingsData:
    """Immutable snapshot of the singleton settings row."""

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
    shipping_methods: tuple[dict, ...]
    announcement_text: str

    # -- (de)serialization --------------------------------------------------
    @classmethod
    def from_orm(cls, row: StoreSettings) -> "StoreSettingsData":
        methods = _normalize_methods(row.shipping_methods)
        return cls(
            store_name=row.store_name,
            support_phone=row.support_phone,
            email=row.email,
            address=row.address,
            zip_code=row.zip_code,
            vat_percentage=Decimal(row.vat_percentage),
            care_oil_price=Decimal(row.care_oil_price),
            care_oil_enabled=bool(row.care_oil_enabled),
            signature_packaging_price=Decimal(row.signature_packaging_price),
            signature_packaging_enabled=bool(row.signature_packaging_enabled),
            shipping_methods=tuple(methods),
            announcement_text=row.announcement_text or "",
        )

    def to_json(self) -> str:
        return json.dumps(
            {
                "store_name": self.store_name,
                "support_phone": self.support_phone,
                "email": self.email,
                "address": self.address,
                "zip_code": self.zip_code,
                "vat_percentage": str(self.vat_percentage),
                "care_oil_price": str(self.care_oil_price),
                "care_oil_enabled": self.care_oil_enabled,
                "signature_packaging_price": str(self.signature_packaging_price),
                "signature_packaging_enabled": self.signature_packaging_enabled,
                "shipping_methods": [
                    {**m, "fee": str(m["fee"])} for m in self.shipping_methods
                ],
                "announcement_text": self.announcement_text,
            }
        )

    @classmethod
    def from_json(cls, raw: str) -> "StoreSettingsData":
        d = json.loads(raw)
        methods = _normalize_methods(d.get("shipping_methods") or [])
        return cls(
            store_name=d.get("store_name", ""),
            support_phone=d.get("support_phone", ""),
            email=d.get("email", ""),
            address=d.get("address", ""),
            zip_code=d.get("zip_code", ""),
            vat_percentage=Decimal(d.get("vat_percentage", "0")),
            care_oil_price=Decimal(d.get("care_oil_price", "0")),
            care_oil_enabled=bool(d.get("care_oil_enabled", False)),
            signature_packaging_price=Decimal(
                d.get("signature_packaging_price", "0")
            ),
            signature_packaging_enabled=bool(
                d.get("signature_packaging_enabled", False)
            ),
            shipping_methods=tuple(methods),
            announcement_text=d.get("announcement_text", ""),
        )

    def pricing(self) -> PricingRules:
        """Derive the checkout :class:`PricingRules` (with a safe fallback)."""
        fees = {m["id"]: q2(m["fee"]) for m in self.shipping_methods if m.get("id")}
        if not fees:
            # Blank/misconfigured catalog -> fall back so checkout never breaks.
            fees = {
                m["id"]: q2(Decimal(str(m["fee"]))) for m in DEFAULT_SHIPPING_METHODS
            }
        return PricingRules(
            vat_percentage=self.vat_percentage,
            care_oil_price=self.care_oil_price,
            care_oil_enabled=self.care_oil_enabled,
            signature_packaging_price=self.signature_packaging_price,
            signature_packaging_enabled=self.signature_packaging_enabled,
            shipping_fees=fees,
        )


def _normalize_methods(raw) -> list[dict]:
    """Coerce the stored JSONB list into a clean ``[{id,title,note,fee}]``."""
    out: list[dict] = []
    if not isinstance(raw, list):
        return out
    for m in raw:
        if not isinstance(m, dict) or not m.get("id"):
            continue
        try:
            fee = Decimal(str(m.get("fee", 0)))
        except (ValueError, ArithmeticError):
            fee = Decimal("0")
        out.append(
            {
                "id": str(m["id"]),
                "title": str(m.get("title", "")),
                "note": str(m.get("note", "")),
                "fee": q2(fee),
            }
        )
    return out


async def get_store_settings_data(db: AsyncSession) -> StoreSettingsData:
    """Return the singleton settings, Redis-cached (TTL :data:`CACHE_TTL_SECONDS`).

    On a cache miss the row is read (or created with column defaults) from
    Postgres and the result is cached. A Redis/parse failure degrades
    gracefully to a direct DB read.
    """
    redis = get_redis()
    try:
        raw = await redis.get(CACHE_KEY)
    except Exception:
        raw = None
    if raw:
        try:
            return StoreSettingsData.from_json(raw)
        except Exception:
            raw = None  # corrupt cache entry -> re-read from DB below

    row = (
        await db.execute(select(StoreSettings).where(StoreSettings.id == _SETTINGS_ID))
    ).scalar_one_or_none()
    if row is None:
        row = StoreSettings(id=_SETTINGS_ID)  # column defaults apply
        db.add(row)
        await db.commit()
        await db.refresh(row)

    data = StoreSettingsData.from_orm(row)
    try:
        await redis.set(CACHE_KEY, data.to_json(), ex=CACHE_TTL_SECONDS)
    except Exception:
        pass
    return data


async def invalidate_store_settings_cache() -> None:
    """Drop the cached settings (call after every settings write)."""
    try:
        await get_redis().delete(CACHE_KEY)
    except Exception:
        pass


async def update_store_settings(
    db: AsyncSession, updates: dict
) -> StoreSettingsData:
    """Apply a partial update to the singleton row, refresh the cache.

    ``updates`` is a mapping of ORM column name -> new value (already
    validated). Creates the row on first use. Returns the fresh data.
    """
    row = (
        await db.execute(select(StoreSettings).where(StoreSettings.id == _SETTINGS_ID))
    ).scalar_one_or_none()
    if row is None:
        row = StoreSettings(id=_SETTINGS_ID)  # column defaults apply
        db.add(row)
        await db.flush()

    for field, value in updates.items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)

    data = StoreSettingsData.from_orm(row)
    try:
        await get_redis().set(CACHE_KEY, data.to_json(), ex=CACHE_TTL_SECONDS)
    except Exception:
        pass
    return data