"""One-shot repair: rewrite internal MinIO URLs to the public host.

After the Docker networking transition the database contains media URLs
built from the *internal* S3 endpoint (``http://minio:9000/...``) — a DNS
name only the Docker network can resolve. Browsers get
``ERR_NAME_NOT_RESOLVED`` on every such image.

This script rewrites every occurrence of the internal endpoint to the
public host (``settings.media_public_url``, default
``http://localhost:9000``) in:

* ``categories.image_url``   (VARCHAR)
* ``products.images``        (JSONB list of URLs)

It is **idempotent** — rows that do not contain the old prefix are left
untouched, so re-running is harmless.

Run (Docker, from the repo root):
    docker compose exec -T backend python scripts/fix_urls.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Make the backend root importable regardless of the caller's CWD.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import select  # noqa: E402

from core.config import get_settings  # noqa: E402
from db.database import AsyncSessionLocal, engine  # noqa: E402
from db.models import Category, Product  # noqa: E402


def _rewrite(value: str, old: str, new: str) -> str:
    """Replace a leading internal-endpoint prefix with the public one."""
    if value.startswith(f"{old}/"):
        return new + value[len(old) :]
    return value


async def main() -> None:
    settings = get_settings()
    old = settings.s3_endpoint_url.rstrip("/")  # e.g. http://minio:9000
    new = (settings.media_public_url.strip() or old).rstrip("/")  # http://localhost:9000

    if old == new:
        print("Nothing to do: internal and public hosts are identical.")
        return

    async with AsyncSessionLocal() as db:
        # --- categories.image_url ------------------------------------------------
        cats = (await db.execute(select(Category))).scalars().all()
        cat_rows = 0
        for cat in cats:
            if cat.image_url:
                fixed = _rewrite(cat.image_url, old, new)
                if fixed != cat.image_url:
                    cat.image_url = fixed
                    cat_rows += 1

        # --- products.images (JSONB list) ------------------------------------------
        prods = (await db.execute(select(Product))).scalars().all()
        prod_rows = 0
        for prod in prods:
            if not prod.images:
                continue
            fixed_images = [
                _rewrite(url, old, new) if isinstance(url, str) else url
                for url in prod.images
            ]
            if fixed_images != list(prod.images):
                prod.images = fixed_images
                prod_rows += 1

        await db.commit()

    await engine.dispose()
    print(f"Rewrote media URLs {old!r} -> {new!r}:")
    print(f"  categories : {cat_rows} row(s) updated")
    print(f"  products   : {prod_rows} row(s) updated")


if __name__ == "__main__":
    asyncio.run(main())