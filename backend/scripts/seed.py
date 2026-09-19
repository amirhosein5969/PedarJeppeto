"""Seed the catalog (categories, products, promos) + default store settings.

Migrates the frontend mock data into Postgres + MinIO so the live API carries
the same catalog the storefront mock displays.

Run from the ``backend/`` root (so ``.env`` is found):

    .venv\\Scripts\\python scripts\\seed.py

Idempotency
-----------
* store settings : created only if the singleton row is missing
* categories     : created only if the slug is missing
* products       : created only if the ``products`` table is empty
                   (``list_price`` is backfilled on pre-existing rows)
* promos         : created only if the code is missing
Nothing already present is ever overwritten, so the script is safe to re-run.

Images
------
Each unique local asset (``frontend/public/*.jpg``) is uploaded to MinIO
**once** via :class:`services.storage.MediaStorage`; the returned public
URLs populate ``category.image_url`` and ``product.images``. Only the
assets actually needed for rows that will be created are uploaded.
"""

from __future__ import annotations

import asyncio
import io
import sys
from decimal import Decimal
from pathlib import Path

# Make the backend root importable regardless of the caller's CWD.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import UploadFile  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

from core.cache import close_redis  # noqa: E402
from db.database import AsyncSessionLocal, engine  # noqa: E402
from db.models import Category, Product, PromoCode, StoreSettings  # noqa: E402
from services.settings import invalidate_store_settings_cache  # noqa: E402
from services.storage import media_storage  # noqa: E402

# Frontend lives next to the backend (../frontend); static imagery is served
# from the Vite `public/` directory (site-root absolute paths).
FRONTEND_ASSETS = (
    Path(__file__).resolve().parents[2] / "frontend" / "public"
)

#: Seed stock level for every product (the mock has no stock concept).
DEFAULT_STOCK = 20


# =============================================================================
# Mock catalog (transcribed from handcrafted-hearthwood/src/lib)
# =============================================================================

CATEGORIES: list[dict] = [
    {"slug": "kitchen", "name": "ظروف و ابزار آشپزخانه چوبی", "image": "cat-kitchen.jpg"},
    {"slug": "office", "name": "دکوری و اداری چوبی", "image": "cat-office.jpg"},
    {"slug": "digital", "name": "لوازم جانبی دیجیتال چوبی", "image": "cat-digital.jpg"},
    {"slug": "gift", "name": "کادویی و تزئینی چوبی", "image": "cat-gift.jpg"},
]


def _final_price(price: int, discount: int) -> int:
    """Exact integer mirror of the frontend ``finalPrice`` (round-half-up)."""
    return (price * (100 - discount) + 50) // 100


def _description(summary: str, specs: list[tuple[str, str]]) -> str:
    parts = [summary.strip()]
    if specs:
        parts.append("\nمشخصات:")
        parts.extend(f"- {label}: {value}" for label, value in specs)
    return "\n".join(parts)


# ``images`` reference local asset filenames; they are mapped to MinIO URLs.
PRODUCTS: list[dict] = [
    {
        "title": "قاشق چوبی گردو دست‌تراش",
        "category": "kitchen",
        "price": 185000, "discount": 20,
        "summary": "قاشق دست‌تراش از چوب گردو با رگه‌های طبیعی و پرداخت روغن خوراکی.",
        "specs": [("طول", "۲۸ سانتی‌متر"), ("جنس", "چوب گردو"), ("رنگ", "قهوه‌ای تیره با رگه‌های طبیعی")],
        "images": ["cat-kitchen.jpg", "about-1.jpg", "hero-workshop.jpg"],
    },
    {
        "title": "تخته سرو چندمنظوره چوب بلوط",
        "category": "kitchen",
        "price": 450000, "discount": 15,
        "summary": "تخته سرو مقاوم برای پنیر، نان و میوه با دسته‌ی ارگونومیک.",
        "specs": [("ابعاد", "۴۰×۲۵ سانتی‌متر"), ("جنس", "چوب بلوط"), ("رنگ", "کرم مایل به عسلی")],
        "images": ["cat-kitchen.jpg", "about-2.jpg", "about-1.jpg"],
    },
    {
        "title": "کاسه چوبی نراد دست‌ساز",
        "category": "kitchen",
        "price": 320000, "discount": 30,
        "summary": "کاسه‌ی تراشیده‌شده روی چرخ چوب، مناسب سرو آجیل و سالاد.",
        "specs": [("قطر", "۱۸ سانتی‌متر"), ("جنس", "چوب نراد"), ("رنگ", "قهوه‌ای روشن")],
        "images": ["cat-kitchen.jpg", "hero-workshop.jpg", "about-2.jpg"],
    },
    {
        "title": "تقویم رومیزی چوب بلوط",
        "category": "office",
        "price": 290000, "discount": 25,
        "summary": "تقویم رومیزی مینیمال با پایه‌ی یکپارچه چوب بلوط.",
        "specs": [("ابعاد", "۱۵×۱۰×۵ سانتی‌متر"), ("جنس", "چوب بلوط"), ("رنگ", "قهوه‌ای بلوط روشن")],
        "images": ["cat-office.jpg", "about-1.jpg", "hero-workshop.jpg"],
    },
    {
        "title": "ساعت دیواری چوبی مدل دایره",
        "category": "office",
        "price": 580000, "discount": 10,
        "summary": "ساعت دیواری بی‌صدا با بدنه‌ی یکپارچه چوب راش.",
        "specs": [("قطر", "۳۵ سانتی‌متر"), ("جنس", "چوب راش"), ("رنگ", "قهوه‌ای گرم با عقربه مشکی")],
        "images": ["cat-office.jpg", "hero-workshop.jpg", "about-1.jpg"],
    },
    {
        "title": "جامدادی رومیزی چوبی چندخانه",
        "category": "office",
        "price": 210000, "discount": 40,
        "summary": "جامدادی چندخانه برای نظم میز کار، ساخته‌شده از چوب گردو.",
        "specs": [("ابعاد", "۲۰×۱۰×۸ سانتی‌متر"), ("جنس", "چوب گردو"), ("رنگ", "قهوه‌ای طبیعی")],
        "images": ["cat-office.jpg", "about-2.jpg", "cat-kitchen.jpg"],
    },
    {
        "title": "نگهدارنده گوشی رومیزی چوبی",
        "category": "digital",
        "price": 140000, "discount": 35,
        "summary": "استند گوشی با زاویه‌ی مناسب تماس تصویری و تماشای ویدیو.",
        "specs": [("ابعاد", "۱۲×۸×۶ سانتی‌متر"), ("جنس", "چوب گردو"), ("رنگ", "قهوه‌ای تیره")],
        "images": ["cat-digital.jpg", "about-2.jpg", "cat-office.jpg"],
    },
    {
        "title": "پایه لپ‌تاپ چوبی تاشو",
        "category": "digital",
        "price": 650000, "discount": 12,
        "summary": "پایه‌ی تاشو و سبک با جریان هوای مناسب برای لپ‌تاپ.",
        "specs": [("ابعاد باز", "۳۰×۲۵ سانتی‌متر"), ("جنس", "چوب راش با روکش مقاوم"), ("رنگ", "عسلی روشن")],
        "images": ["cat-digital.jpg", "about-1.jpg", "cat-gift.jpg"],
    },
    {
        "title": "جعبه کادویی چوبی گردویی",
        "category": "gift",
        "price": 380000, "discount": 18,
        "summary": "جعبه‌ی کادویی با درپوش لولایی، مناسب هدیه‌های خاص.",
        "specs": [("ابعاد", "۲۵×۱۸×۱۰ سانتی‌متر"), ("جنس", "چوب گردو"), ("ویژگی", "درپوش لولایی")],
        "images": ["cat-gift.jpg", "about-2.jpg", "about-1.jpg"],
    },
    {
        "title": "آینه دیواری قاب‌چوبی عسلی",
        "category": "gift",
        "price": 720000, "discount": 22,
        "summary": "آینه‌ی گرد با قاب دست‌ساز چوب بلوط و رنگ عسلی روشن.",
        "specs": [("قطر", "۴۰ سانتی‌متر"), ("جنس قاب", "چوب بلوط"), ("رنگ", "عسلی روشن")],
        "images": ["cat-gift.jpg", "hero-workshop.jpg", "about-1.jpg"],
    },
]

PROMOS: list[dict] = [
    {
        "code": "LUXURY20", "discount_percentage": Decimal("20"),
        "max_discount_amount": Decimal("200000"), "min_purchase_amount": Decimal("3000000"),
        "usage_limit": 100, "times_used": 3, "is_active": True,
    },
    {
        "code": "PEDAR10", "discount_percentage": Decimal("10"),
        "max_discount_amount": Decimal("150000"), "min_purchase_amount": Decimal("1000000"),
        "usage_limit": 50, "times_used": 50, "is_active": True,
    },
    {
        "code": "WOODEN5", "discount_percentage": Decimal("5"),
        "max_discount_amount": None, "min_purchase_amount": Decimal("0"),
        "usage_limit": None, "times_used": 12, "is_active": False,
    },
]

# Frontend ``phone`` -> backend ``support_phone``; ``giftBox*`` -> ``signature_packaging_*``.
DEFAULT_SETTINGS: dict = {
    "store_name": "PEDAR JEPETO",
    "support_phone": "02177626411",
    "email": "mr.note.ir@gmail.com",
    "address": "تهران - تهران، میدان بهارستان، کوچه قرائت، پلاک ۴",
    "zip_code": "1147945571",
    "vat_percentage": Decimal("10"),
    "care_oil_price": Decimal("120000"),
    "care_oil_enabled": True,
    "signature_packaging_price": Decimal("185000"),
    "signature_packaging_enabled": True,
    "shipping_methods": [
        {"id": "standard", "title": "پست پیشتاز", "note": "۳ تا ۵ روز کاری", "fee": 69000},
        {"id": "express", "title": "ارسال سریع تهران", "note": "تحویل کمتر از ۲۴ ساعت", "fee": 145000},
    ],
}


# =============================================================================
# Helpers
# =============================================================================

def _content_type(path: Path) -> str:
    return "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else "image/png"


async def _upload_asset(path: Path) -> str:
    """Upload one local image through MediaStorage; return its public URL."""
    data = path.read_bytes()
    upload = UploadFile(
        filename=path.name,
        file=io.BytesIO(data),
        size=len(data),
        headers={"content-type": _content_type(path)},
    )
    return await media_storage.upload_image(upload)


# =============================================================================
# Seed steps
# =============================================================================

async def _seed_settings(session) -> None:
    row = (
        await session.execute(select(StoreSettings).where(StoreSettings.id == 1))
    ).scalar_one_or_none()
    if row is not None:
        print("  settings : exists — leaving untouched")
        return
    session.add(StoreSettings(id=1, **DEFAULT_SETTINGS))
    await session.flush()
    print("  settings : created (id=1)")


async def _seed_categories(session, needed: list[dict], asset_urls: dict) -> dict:
    slug_to_id: dict[str, int] = {}
    for row in (await session.execute(select(Category))).scalars().all():
        slug_to_id[row.slug] = row.id
    for c in needed:
        cat = Category(name=c["name"], slug=c["slug"], image_url=asset_urls[c["image"]])
        session.add(cat)
        await session.flush()
        slug_to_id[c["slug"]] = cat.id
        print(f"  category : {c['slug']}")
    return slug_to_id


async def _seed_products(session, slug_to_id: dict, asset_urls: dict) -> None:
    count = (await session.execute(select(func.count(Product.id)))).scalar_one()
    if count:
        print(f"  products : already present ({count}) — backfilling list_price if needed")
        await _backfill_list_price(session)
        return
    for p in PRODUCTS:
        session.add(
            Product(
                title=p["title"],
                description=_description(p["summary"], p["specs"]),
                base_price=Decimal(_final_price(p["price"], p["discount"])),
                list_price=Decimal(p["price"]),
                stock_count=DEFAULT_STOCK,
                images=[asset_urls[a] for a in p["images"]],
                profit_margin=Decimal("0.00"),
                category_id=slug_to_id[p["category"]],
                is_active=True,
            )
        )
        print(f"  product  : {p['title']}  (base {_final_price(p['price'], p['discount'])})")
    await session.flush()


async def _backfill_list_price(session) -> int:
    """Fill ``list_price`` (pre-discount shelf price) on rows seeded before
    the column existed. Matched by title against the seed catalog."""
    rows = (
        (await session.execute(select(Product))).scalars().all()
    )
    by_title = {p["title"]: Decimal(p["price"]) for p in PRODUCTS}
    filled = 0
    for row in rows:
        if row.list_price is None and row.title in by_title:
            row.list_price = by_title[row.title]
            filled += 1
    if filled:
        print(f"  list_price: backfilled {filled} product(s)")
    return filled


async def _seed_promos(session, needed: list[dict]) -> None:
    for p in needed:
        session.add(PromoCode(**p))
        print(f"  promo    : {p['code']}")


def _force_utf8_stdio() -> None:
    """The Windows console defaults to cp1252; Persian print() would crash.

    Reconfigure stdio to UTF-8 so progress logs (which include Persian
    titles) never raise UnicodeEncodeError. DB writes are UTF-8 regardless.
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            if stream.encoding and stream.encoding.lower() != "utf-8":
                stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError, OSError):
            pass


async def main() -> None:
    _force_utf8_stdio()
    print("Seeding Handcrafted Hearthwood catalog...")
    async with AsyncSessionLocal() as session:
        await _seed_settings(session)

        # Determine what is actually missing before uploading anything.
        existing_slugs = {
            r.slug for r in (await session.execute(select(Category))).scalars().all()
        }
        product_count = (
            await session.execute(select(func.count(Product.id)))
        ).scalar_one()
        existing_codes = {
            r for r in (await session.execute(select(PromoCode.code))).scalars().all()
        }

        need_cats = [c for c in CATEGORIES if c["slug"] not in existing_slugs]
        need_prods = product_count == 0
        need_promos = [p for p in PROMOS if p["code"] not in existing_codes]

        # Collect the unique assets required for the rows we will create.
        assets_needed: set[str] = set()
        for c in need_cats:
            assets_needed.add(c["image"])
        if need_prods:
            for p in PRODUCTS:
                assets_needed.update(p["images"])

        asset_urls: dict[str, str] = {}
        if assets_needed:
            print(f"  uploading {len(assets_needed)} unique image(s) to MinIO...")
            for name in sorted(assets_needed):
                path = FRONTEND_ASSETS / name
                if not path.exists():
                    raise FileNotFoundError(f"Missing frontend asset: {path}")
                asset_urls[name] = await _upload_asset(path)
                print(f"    - {name}")
        else:
            print("  images   : nothing new to upload")

        if need_cats:
            slug_to_id = await _seed_categories(session, need_cats, asset_urls)
        else:
            slug_to_id = {
                r.slug: r.id
                for r in (await session.execute(select(Category))).scalars().all()
            }
        await _seed_products(session, slug_to_id, asset_urls)  # no-ops if non-empty
        if need_promos:
            await _seed_promos(session, need_promos)
        else:
            print("  promos   : all present — skipping")

        await session.commit()

    await invalidate_store_settings_cache()
    await engine.dispose()
    await close_redis()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(main())