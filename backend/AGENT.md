# AGENT.md — Handcrafted Hearthwood · Backend

> **Central memory file for this codebase.** Any agent or developer working
> on this project MUST read this file first and keep it up to date whenever
> an architectural decision changes.

---

## 1. Project

**Handcrafted Hearthwood** is a high-end e-commerce platform for luxury
artisan woodcraft (handcrafted furniture, carving, and wood-care products).

The repository is split into two sibling projects:

| Path | Role | Stack | Port |
|---|---|---|---|
| `../handcrafted-hearthwood/` | Headless frontend | React, Vite, TanStack Start | **8080** (dev) |
| `./` (this directory) | Backend API | FastAPI (async) | **8000** |

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| API framework | **FastAPI** (async) + Uvicorn | ASGI, end-to-end async |
| Database | **PostgreSQL 16** | Source of truth for all durable data |
| ORM / migrations | **SQLAlchemy 2.0** (async) + **Alembic** | `asyncpg` driver; schema changes via migrations only |
| Cache / ephemeral state | **Redis 7** | Hot-read caching + temporary shopping carts |
| Object storage | **MinIO** (S3-compatible) | Product / wood-grain imagery via **aioboto3** |
| Configuration | **pydantic-settings** | 12-factor: all config from environment / `.env` |
| Auth | **PyJWT** + **httpx** (sms.ir Verify OTP; Call mocked) + passlib | Secure OTP login; Redis rate/brute-force limits |
| Runtime | **Docker Compose** (5 services) | Fully containerized monorepo — root `docker-compose.yml` |

### Service ports (local development)

| Service | Port |
|---|---|
| Frontend (TanStack Start, container `hh_frontend`) | 8080 |
| FastAPI backend (container `hh_backend`) | 8010 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO S3 API | 9000 |
| MinIO web console | 9001 |

---

## 3. Headless E-commerce Architecture

- **Fully decoupled.** The frontend never talks to the database or to
  storage. It consumes a stateless JSON REST API under `/api/v1` and
  references imagery by MinIO object URL.
- **API-first & versioned.** Every capability is exposed as an endpoint
  before UI work begins; breaking changes go to a new major version.
- **Stateless backend.** No server-side sessions. Anonymous / temporary
  carts live in **Redis** (keyed by a cart token); when an order is placed
  everything is durably persisted to **PostgreSQL**.
- **Storage separation.** The API never serves media files. Uploads are
  written to MinIO by the backend and served as plain object URLs, so the
  frontend can hotlink images directly.
- **Security boundary.** CORS is an explicit allow-list (configured in
  `main.py`, driven by `core/config.py`): `http://localhost:8080`
  (TanStack Start dev) plus `localhost`/`127.0.0.1` on `5173` and `3000`.
  All secrets come from `.env` (git-ignored); `docker-compose.yml` fails
  fast if a required variable is missing.

> **Infra note (2026-09):** MinIO removed `minio/minio` from Docker Hub.
> The compose file pins `quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z`
> (official public mirror). Keep the MinIO image pinned to an explicit
> RELEASE tag.

---

## 4. Phased Roadmap

### Phase 1 — Infra & Setup ✅
- `docker-compose.yml` for PostgreSQL, Redis, MinIO: secure `.env`-driven
  secrets, health checks, persistent volumes.
- FastAPI skeleton: `core/config.py` (pydantic-settings),
  `db/database.py` (async engine + session factory + `get_db`),
  `main.py` (app + CORS for `http://localhost:8080`).
- `requirements.txt` for the full stack. **No business logic yet.**

### Phase 2 — DB Models & Alembic ✅
- Alembic initialized with the **async** template; `alembic/env.py`
  injects `sqlalchemy.url` from `core.config` (single source of truth).
- SQLAlchemy 2.0 typed models in `db/models.py`: `User` (OTP-ready, no
  password fields), `Category`, `Product`, `PromoCode`, `Order`,
  `OrderItem` — with enums as VARCHAR+CHECK, JSONB shipping details,
  deliberate FK delete rules (RESTRICT on catalog/user, CASCADE on
  order line items) and `Numeric(10,2)` money columns.
- First migration `750443df651d "Init tables"` generated, reviewed, and
  applied (`alembic upgrade head`); verified with an ORM round-trip.
- Schema-refinement migration `e4de7a96d53b "Refactor schemas"` (current
  head) aligned the DB with five structural decisions made together with
  the storefront mock (see §8): category `image_url`, per-order
  `shipping_method`, product `images` JSONB + `profit_margin` (replacing
  `main_image_url` / `hover_image_url`), promo `min_purchase_amount`, and
  the user profile address block (`province` / `city` / `zip_code` /
  `address`).
- Remaining for this phase later: catalog seed script.

### Phase 3 — Core CRUD APIs & MinIO Uploads ✅
- **`services/storage.py`** — `MediaStorage` (aioboto3, fully async):
  content-type allowlist (JPEG/PNG/WebP/GIF/AVIF), 5 MB cap, UUID4 keys
  under `products/`, `ensure_bucket()` creates `hearthwood-media` and
  applies a **public-read** bucket policy on creation (the storefront
  hotlinks object URLs directly). `InvalidMediaError` → 400,
  `StorageError` → 502.
- **`schemas/`** — `category.py` + `product.py` (+ `common.ImageHttpUrl`):
  strictly typed Create/Update/Response models mapping 1:1 to the ORM
  (`images: list[str]`, `profit_margin`, `image_url`); all Response
  schemas use `ConfigDict(from_attributes=True)`.
- **`api/v1/endpoints/`** — `upload.py` (`POST /upload`),
  `categories.py` (`GET/POST /categories`), `products.py`
  (`GET /products`, `POST /products`, `GET /products/{id}`). Async
  `select()` queries, `get_db()` injection, 404/400/422 handling,
  duplicate-name/slug guard.
- **Wiring** — master router in `api/v1/api.py`, included in `main.py`
  under `settings.api_v1_prefix` (`/api/v1`).
- **Tested end-to-end** (live uvicorn + real MinIO + real Postgres):
  upload 201 + anonymous GET 200, non-image 400, category create/list
  201/200 (Persian names round-trip as UTF-8), product create/read with
  JSONB images + `profit_margin`, 404 for missing product / dangling
  category, 400 duplicate category, 422 on negative price. Test rows
  and objects were cleaned up afterwards.

  > **Env notes (this machine):** port **8000 is occupied by an unrelated
  > local service** — for live testing use another port, e.g.
  > `uvicorn main:app --port 8010`. Also: `S3_SECRET_ACCESS_KEY` in
  > `.env` **must equal `MINIO_ROOT_PASSWORD`** (MinIO only reads the
  > password on first volume init) — a mismatch was a real 502 bug found
  > during Phase 3 testing.
  >
  > **API money contract:** `base_price` / `profit_margin` serialize as
  > **decimal strings** (pydantic v2 JSON mode for `Decimal`), e.g.
  > `"382500.00"` — exact money, no float drift. Frontend (Phase 5)
  > parses them to numbers for arithmetic.
- Remaining for a later pass: Redis read-caching for hot catalog
  endpoints (TTL invalidation).

### Phase 4 — Complex Domain Logic (Cart, Promos, Orders) ✅
- **`core/pricing.py`** — single source of truth for store pricing
  constants, mirroring the frontend `DEFAULT_STORE_SETTINGS`: VAT 10%,
  care oil 120 000 (charged **once per cart line**, not per unit),
  signature packaging 185 000 (order-level), free shipping from
  5 000 000, method fees `standard=69 000` / `express=145 000`. Exact
  `Decimal` helpers (`q2`, `round_money`). When a DB-backed store
  settings service lands (Phase 5), these constants move there.
- **`core/cache.py`** — lazy async Redis singleton (`get_redis()` /
  `close_redis()`); `main.py` lifespan closes it on shutdown.
- **`services/cart.py`** — Redis carts keyed `cart:{session_id}`; the
  client-provided session id is validated against
  `[A-Za-z0-9_-]{8,64}` before touching Redis (it is interpolated into
  the key) → 400 otherwise. Stores **only** `{product_id, quantity,
  care_oil_added}` — prices are re-resolved from PostgreSQL on every
  read, so a stale cart can never lock in a stale price. add/remove run
  in a `WATCH`/`MULTI` optimistic transaction (3 retries); 14-day TTL
  refreshed on every write; qty capped at 20 (frontend `MAX_QTY`).
- **`services/promotion.py`** — `assert_redeemable` (is_active,
  `usage_limit` > `times_used` [NULL/0 = unlimited], subtotal ≥
  `min_purchase_amount`) + `calc_discount` (percent of the cart total,
  rounded to whole toman like the storefront, capped at
  `max_discount_amount` [NULL/0 = uncapped]). Shared by
  `POST /promotions/validate` and checkout so they cannot drift.
- **`services/order.py`** — `place_order`: Redis cart → product
  resolution (one query; missing/inactive → 400) → stock pre-check →
  exact Decimal money math → **user upsert by canonical phone** →
  **STRICT single atomic transaction** (`async with tx.begin()` on a
  dedicated session): conditional
  `UPDATE products SET stock_count = stock_count - q
   WHERE id = ? AND stock_count >= q` (rowcount 0 → rollback + 400, so
  concurrent checkouts cannot oversell), user create/update,
  `Order` + snapshot `OrderItem`s (unit price + care-oil price captured
  at purchase), `promo.times_used += 1` — all or nothing. The Redis
  cart is cleared **after** the commit. Errors are
  `CheckoutError` subclasses (shared base in `services/errors.py`)
  carrying the 4xx status; endpoints translate them to HTTP.
- **Money formula (storefront parity, verified live):**
  `goods_total = Σ(price×qty) + care-oil (per line)` ·
  `discount = min(goods_total×pct, cap)` whole toman ·
  `taxable = max(0, goods_total + packaging − discount)` ·
  `vat = 10% × taxable` (whole toman) ·
  `shipping = 0 if goods_total ≥ 5M else method fee` (shipping is NOT
  VAT-able) · `total = taxable + vat + shipping`. Every money field
  serializes as a 2-place decimal string, e.g. `"1171850.00"`.
- **`schemas/`** — `cart.py`, `promotion.py` (codes canonicalized to
  uppercase alphanumeric; `0` → `NULL` for "unlimited" cap/limit,
  matching frontend 0=unlimited), `order.py` (`CustomerIn` canonicalizes
  Iranian phones `+989xxxxxxxxx` / `0098…` / `9xxxxxxxxx` →
  `09xxxxxxxxx`; 10-digit zip optional for express; `to_order_out`
  projects the ORM order into the API shape — the endpoint **must**
  return `to_order_out(order)`, never the raw ORM object, because
  `OrderOut` fields do not 1:1 match ORM attributes).
- **`api/v1/endpoints/`** — `cart.py` (GET `/cart` with current DB
  prices + `unavailable` id list, POST `/cart/add`,
  DELETE `/cart/remove?product_id=`, DELETE `/cart/clear` — all take
  the cart's `session_id` via the **`X-Session-Id` header**, kept out
  of URLs/logs), `promotions.py` (GET/POST `/promotions`,
  PATCH/DELETE `/promotions/{id}`, POST `/promotions/validate`),
  `orders.py` (POST `/orders` checkout 201, GET `/orders` admin list
  with items+customer, PATCH `/orders/{id}/status` from the
  `pending/processing/shipped/delivered/cancelled` set).
  Order numbers are `ORD-{id:04d}` (assigned after the initial flush).
- **Tested end-to-end** (uvicorn :8010 + real Postgres + real Redis):
  **31/31 checks** — cart add/merge/read (DB prices)/remove/clear;
  promo CRUD + case-insensitive validate (cap applied: 10% of 798 500
  capped at 50 000; 400 below minimum); checkout 1 (express +
  packaging + capped promo): total `1171850.00`
  (taxable 933 500 + VAT 93 350 + fee 145 000), phone
  `+989123456789` → `09123456789`, stock 5→4 / 3→1, `times_used` 1,
  cart cleared; checkout 2 (standard, no promo, no zip):
  `489750.00` (382 500 + 38 250 + 69 000); edge cases: insufficient
  stock → 400 with **full rollback** (stock unchanged, no order row),
  unknown promo 400, unknown shipping method 400, empty cart 400,
  malformed session id 400, invalid status 422, duplicate promo 400,
  patch missing promo 404, delete 204. Test rows and Redis keys were
  cleaned up afterwards.
- **Resolved in Phase 4.5:** the former "no idempotency key" and
  "prices are server constants" limitations are both fixed (see below).

### Phase 4.5 — Data Safeguarding & Hardening ✅
Seeding the real catalog + making pricing dynamic + closing the
double-submit hole, ahead of frontend wiring.

- **Migration `478ce279880c "Settings and Indexes"`** (new head):
  adds the `store_settings` table and two indexes
  (`ix_products_is_active`, `ix_orders_status`). `Product.category_id`,
  `Order.user_id`, and `PromoCode.code` were **already** indexed, so
  autogenerate only added the two missing ones.
- **Dynamic store settings (DB + API).** New `StoreSettings` model — a
  **singleton row (`id = 1`)** mirroring the frontend `StoreSettings`:
  seller block (`store_name`, `support_phone`, `email`, `address`,
  `zip_code`) + pricing rules (`vat_percentage`, `care_oil_price` +
  `care_oil_enabled`, `signature_packaging_price` +
  `signature_packaging_enabled`, `shipping_methods` JSONB
  `[{id,title,note,fee}]`) + `updated_at`.
  - `services/settings.py` — `StoreSettingsData` (immutable snapshot) +
    `PricingRules`; `get_store_settings_data(db)` is **Redis-cached**
    (`settings:store`, TTL 300s) and self-bootstraps the row with column
    defaults on first read; `update_store_settings(db, updates)` writes
    and refreshes the cache; `pricing()` falls back to
    `DEFAULT_SHIPPING_METHODS` if the stored method list is empty so
    checkout can never break.
  - `core/pricing.py` **no longer holds pricing values** — only the
    `q2`/`round_money`/`money` helpers, the non-configurable
    `FREE_SHIPPING_FROM` (5M), and the `DEFAULT_SHIPPING_METHODS`
    fallback. All money *values* now come from the DB.
  - `services/order.py` + `endpoints/cart.py` refactored to fetch
    `PricingRules` from settings: VAT %, care-oil price/**enabled**
    (server-side enforcement — oil is only charged when the store has it
    on; the `OrderItem.care_oil_added` snapshot is the *effective*
    value), signature-packaging price/**enabled**, and the
    shipping-method fee + validation all read from settings.
  - `endpoints/settings.py` — `GET /settings` (cached) and
    `PATCH /settings` (partial; invalidates the cache so the next
    checkout sees new prices immediately). `schemas/settings.py`.
  - **Field-name mapping for Phase 5:** frontend `phone` → API
    `support_phone`; frontend `giftBoxPrice`/`giftBoxEnabled` → API
    `signature_packaging_price`/`signature_packaging_enabled`.
- **`scripts/seed.py` — the Great Seed.** Standalone async script that
  migrates the frontend mock catalog into Postgres + MinIO. Run from the
  `backend/` root: `.venv\Scripts\python scripts\seed.py`.
  - Transcribes categories, products, promos, and default settings from
    `handcrafted-hearthwood/src/lib` (product `base_price` = frontend
    `finalPrice` = `round(price×(100−discount)/100)`; `stock_count`
    defaults to 20 since the mock has no stock concept).
  - Uploads each **unique** local asset
    (`src/assets/*.jpg`) to MinIO **once** via `MediaStorage`; the
    returned URLs populate `category.image_url` and `product.images`
    (ordered gallery). Only assets needed for rows that will actually be
    created are uploaded.
  - **Idempotent** (safe to re-run): settings created only if missing;
    categories upserted by `slug`; products created only if the table is
    empty (no natural unique key on `products`); promos created only if
    the `code` is missing. Never overwrites existing rows.
  - Reconfigures stdio to UTF-8 (the Windows console is cp1252 and would
    crash on printing Persian titles).
- **Checkout idempotency (double-submit guard).** `services/lock.py` —
  `CheckoutLock` using Redis `SET key token NX EX 10` (atomic
  set-if-not-exists + 10s TTL) keyed on the `Idempotency-Key` header
  (falling back to `X-Session-Id`). `POST /orders` acquires it before any
  work; a concurrent checkout of the same cart/key gets **409 Conflict**
  immediately. The token-guarded Lua compare-and-delete release runs in a
  `finally` (so a failed checkout lets the client retry), and the TTL is
  the crash safety net.
- **Tested live** (uvicorn :8010 + real Postgres/Redis/MinIO): **22/22**
  checks — settings GET defaults; PATCH care-oil 120 000→100 000 with
  cache invalidation; checkout total `341800.00` proving the *dynamic*
  oil price (would be 363 800 if the old hardcoded value were used);
  signature-packaging+express total `511300.00`; **pre-held lock → 409**;
  **concurrent double-submit → `[201, 409]` with exactly one order
  created**; cart line reflects the restored oil price. Seeded catalog
  verified **byte-for-byte** against `shop-data.ts` (all 10 Persian
  titles match, ZWNJ half-spaces intact). Test orders/users/Redis keys
  cleaned up; the seeded catalog (10 products, 4 categories, 3 promos,
  settings) is **intentionally kept**.

### Phase 5 — Frontend Integration ✅
Wired `handcrafted-hearthwood` (TanStack Start) to the live API —
storefront, cart, checkout, and the entire admin back-office now read and
write real data. Verified: `tsc --noEmit` clean, production build passes,
API E2E **33/33**, all 22 frontend routes SSR 200 in both dev and a
production node build.

- **Phase 5.1 additions (live-tested, 23/23 checks):**
  - **`endpoints/analytics.py`** (+`schemas/analytics.py`, registered in
    `api/v1/api.py`) — two read-only dashboard aggregates, no caching
    (tiny datasets, low traffic):
    - `GET /analytics/sales` → the last **7 server-local days** as
      `[{date, total}]` (total = sum of **non-cancelled** order totals,
      zero-filled, money string; `q2()`-quantized).
    - `GET /analytics/activities` → `{orders[≤3], users[≤2], low_stock}` —
      the 3 newest orders (with customer name via `selectinload`), the 2
      newest registered customers, and every **active** product with
      `stock_count < 3` (worst first, capped at 5; current state so no
      timestamp).
    The admin dashboard now renders the **sales chart** and the
    **فعالیت‌های اخیر** timeline from these endpoints. The *Website
    Traffic* chart was still mock here; it went live in **Phase 6**
    (`GET /analytics/traffic` + Redis page-view middleware).
- **Backend additions (all live-tested):**
  - **Migration `422319028cde "Product list price"`** (new head):
    `products.list_price` NUMERIC(10,2) — the *displayed* price
    (frontend `price`), while `base_price` stays the *final* charged
    price (`round(price×(100−discount)/100)`). Seed backfilled it for the
    seeded catalog.
  - `GET /orders/{order_id}` (admin single order, invoice routes),
    `GET /users` (admin list with `order_count` + `total_spent`),
    `PATCH /products/{id}` (admin edit — partial, `images`/`profit_margin`
    included), `GET /products?active=` (admin sees inactive too),
    `PATCH /cart/line` (change qty in place, X-Session-Id).
  - **26 endpoints** total under `/api/v1` (see §5). CORS allow-list now
    covers the frontend dev origins: `http://localhost:8080`,
    `localhost/127.0.0.1:5173` and `:3000`.
  - **DB caveat:** seeded category ids are **not** 1..4 — resolve
    `category_id` by slug (`kitchen/office/digital/gift`) via
    `GET /categories`; tests hardcoding ids will break.
- **Frontend data layer** (`handcrafted-hearthwood/src`):
  - `lib/api.ts` — axios client, `API_BASE_URL` =
    `http://localhost:8010/api/v1`, `newUuidv4()`, session id in
    `localStorage["hc-session-id"]` attached as `X-Session-Id` on every
    request (SSR-guarded), `ApiError`, `withIdempotencyKey()` for
    checkout, `uploadImage(dataUrl)` (data URL → Blob → `POST /upload` →
    object URL).
  - `lib/api-map.ts` — **the only place** API↔UI shapes convert. Money
    contract: API = 2-place decimal strings; UI = numbers. `toToman()` /
    `fromToman()` are the only converters. Mappers: `toShopProduct`,
    `toAdminProduct`, `toAdminOrder` (keeps `dbId` + `totalAmount`),
    `toAdminUser`, `toStoreSettings`/`toSettingsUpdate` (field renames:
    `support_phone`↔`phone`, `signature_packaging_*`↔`giftBox*`),
    `toPromo`/`fromPromoCreate`/`fromPromoUpdate` (`0`⇄`NULL`
    unlimited), `toCategory`, `buildProductDescription` /
    `parseDescription` (summary + `مشخصات:` spec block round-trip).
  - `lib/api-types.ts` — typed API DTOs.
  - `hooks/queries.ts` — single TanStack Query layer: `useCatalog` /
    `useShopProduct`, `useCart` + add/remove/line/clear,
    `useCheckout` (idempotency), `usePromos`/`useSavePromo`/
    `useDeletePromo`, `useAdminOrders`/`useAdminOrder`/
    `useUpdateOrderStatus`, `useUsers`, `useAdminCatalog` (all products
    incl. inactive + categories, queryKey `[queryKeys.products,"admin"]`),
    `useSaveProduct` (POST/PATCH; uploads new `data:` images first,
    slug→category_id, computes `final`/`margin`/`list_price`),
    `useSettings`/`useSaveSettings`.
  - `lib/admin-*.ts` slimmed to **types + pure helpers** (no
    localStorage seeds): `adminFinalPrice`/`adminUnitProfit`,
    `promoBelowMinimum`/`promoIsExhausted`/`promoDiscount`, etc.
- **Pages now live:** shop / product / category / cart / checkout
  (storefront); admin orders (status changes, invoice links), users
  (read-only + stats sheet), promotions (full CRUD), products (full CRUD;
  delete = soft delete `is_active=false`), settings (save/reset),
  dashboard (KPIs live from orders+catalog — revenue uses order
  `totalAmount`, COGS from `profit_margin`, top sellers; **sales chart,
  traffic chart, and activity feed all live** from `/analytics/*`, badge
  says "آمار زنده" — see Phase 6); invoices
  (`invoice.$orderId` + `invoice-batch`) render real orders by **dbId**
  with invoice number `203 + dbId`, gift-box price and shipping title
  resolved from live settings at render time.
- **Still intentionally mock (localStorage):** admin hero slides
  (`admin-hero.ts` + `storefront.tsx`), wood types
  (`admin-wood-types.ts` + `product-details.tsx`), the admin category
  list itself (`admin-categories.ts` + `categories.tsx` — but its
  per-category product counts come from the live catalog), and the admin
  gate (`admin-auth.ts`). The customer account (`useAuth.tsx`) is now
  **real for identity**: the mock-OTP login's phone is shipped as the
  `X-User-Phone` header and the `/profile` portal (Phase 6) reads/writes
  the real `User` row. The dashboard **Website Traffic** chart is live
  (Phase 6 Redis counters).
- **Production build / SSR gotchas (this machine):**
  - The lovable vite config builds **nitro for `cloudflare-module` by
    default**; `vite preview` / standalone `nitro preview` then 500
    (wrong runtime / missing `dist/server/server.js`). For a local
    production SSR check build with
    `NITRO_PRESET=node-server bun run build` (env var is honored outside
    the Lovable sandbox) and run `node .output/server/index.mjs`
    (`NITRO_PORT=…`). All 22 routes then SSR 200 with clean logs. The
    Lovable sandbox build still pins Cloudflare on its side — local
    `.output` never affects deployment.
  - Vite dev binds `:::8080`, but **Adobe Connect owns
    `127.0.0.1:8080`** and returns NUL-byte bodies — smoke-test the dev
    SSR via `http://[::1]:8080`, not `http://localhost:8080`.
  - Product data in storefront SSR HTML is client-fetched (pages SSR the
    pending shell; queries resolve on hydrate) — same in dev and prod,
    by design for now.
  - **Windows uvicorn quirk (harmless):** the backend terminal may print
    `ConnectionResetError: [WinError 10054] An existing connection was
    forcibly closed by the remote host`. This is a Windows socket-stack
    behavior — the browser/tab drops the TCP connection before the
    response flushes (e.g. navigating away from an in-flight request), and
    Windows reports the reset as an exception. It is **not** a DB drop and
    nothing to fix: `main.py` defines **no catch-all exception handlers**,
    so genuine failures (including real DB connection drops) still surface
    as ordinary 500s — nothing is masked. If similar errors ever persist
    under load, check Postgres (`pg_stat_activity`) before blaming uvicorn.
- **E2E:** `C:\Users\USER\AppData\Local\Temp\opencode\phase5-final-e2e.py`
  (run with the backend venv python, CWD `backend/`, live uvicorn on
  :8010) — **33/33 PASS**: catalog + upload + products CRUD +
  cart→checkout money math (qty2 + care oil + gift box →
  `total 730100.00`) + users + promos + CORS; self-cleans its test
  order/user/product, MinIO object, and Redis cart key.
- **Remaining hardening (later pass):** rate limiting, OpenAPI polish,
  load testing, dockerized production deployment, real token/JWT auth to
  replace the `X-User-Phone` mock-auth bridge.

### Phase 6 — Real Traffic Analytics + Luxury Customer Portal ✅
Two features: live website-traffic counters and the customer self-service
portal (`/profile`). Verified: backend E2E **31/31** (`phase6-test.py`),
`tsc --noEmit` clean, prod node build SSR 200 on all portal + dashboard
routes.

- **Real website traffic via Redis:**
  - **`core/middleware.py`** — `TrafficMiddleware(BaseHTTPMiddleware)`,
    registered in `main.py` *inside* CORS. On every **GET** it runs a
    best-effort, non-blocking `INCR page_views:YYYY-MM-DD` (async Redis +
    0.5 s `asyncio.wait_for` guard + `EXPIRE … NX` 14-day TTL on first
    hit). **All** Redis failures are swallowed — analytics can never break
    or delay a request. **Excluded from counting:** any path with a
    media/asset extension (`.js/.css/.png/.jpg/.svg/.woff2/…`), and the
    `/api/v1/analytics/*` prefix (the dashboard must not count its own
    polling).
  - **Honest counting semantics:** the backend sees the storefront's data
    fetches (a page load fires the GETs that render it), so "page views" =
    counted backend GETs — a deliberate lightweight proxy until a
    per-navigation frontend beacon exists. Admin-panel API calls also
    count (documented limitation).
  - **`GET /analytics/traffic`** (analytics.py + `TrafficDayOut`): the
    last 7 server-local days `[{date, views}]` via one `MGET`; absent keys
    → 0; a Redis outage degrades to an all-zero series, not an error.
  - **Dashboard:** the Website Traffic chart now uses `useTraffic7d()`
    (single `pageViews` series; the mock `TRAFFIC_7D` + "visitors" series
    are deleted); badge is now just **"آمار زنده"**.
- **Luxury customer portal (`/profile`):**
  - **Migration `7c1b4e9d2a53 "User important date"`** (new head):
    `users.important_date` VARCHAR(120) NULL — free-form important dates
    (birthday/anniversary) for future gifting reminders.
  - **`endpoints/users.py`** — the `/users/me` family. **Identity bridge
    (Phase 6, documented):** real token auth doesn't exist yet; the mock
    OTP login (`useAuth.tsx`, `localStorage["choobkar-auth-user"]`) stores
    the customer's phone and the axios interceptor ships it as the
    **`X-User-Phone`** header (added in `lib/api.ts`, SSR-guarded). The
    `user_phone` dependency canonicalizes it (reuses
    `schemas.order.canonical_phone`); absent/invalid → **401**.
    - `GET /users/me` → `UserMeOut` (incl. `important_date`); 404 when the
      phone has no DB row yet (client renders an empty first-run form).
    - `PATCH /users/me` → **upsert by phone** (creates the row with
      `role=customer` on first save), partial updates via
      `exclude_unset` (explicit `null` clears a field), `UserMeUpdate`
      validation (name ≥3, zip `^\d{10}$`, strip validators).
    - `GET /users/me/orders` → `MyOrderOut[]` newest-first
      (`selectinload` items → product), each item carries `image =
      product.images[0]` (or null). Unknown phone → `[]` (a fresh account
      has no history — not a 404).
  - **`schemas/user.py`** — `UserMeOut`, `UserMeUpdate`, `MyOrderOut`,
    `MyOrderItemOut` (admin `UserResponse` unchanged).
  - **Frontend** (`handcrafted-hearthwood/src`): `routes/profile.tsx`
    (layout: SSR-safe client-side auth gate → `/auth?returnTo=`, elegant
    sidebar tabs, logout), `routes/profile/account.tsx` (پروفایل من —
    name/province/city/zip/address + **تاریخ‌های مهم** field, read-only
    phone, 404 = first-run empty form, fatal-error state),
    `routes/profile/orders.tsx` (تاریخچه سفارشات — card layout:
    number + Jalali date + status badge, horizontal `images[0]`
    thumbnails with qty badges, minimalist 4-step timeline
    pending→processing→shipped→delivered with cancelled note, grand total,
    "دانلود فاکتور" → `/invoice/{dbId}` in a new tab, "نیاز به راهنمایی
    دارید؟" → `/contact`). `Header` dropdown + mobile menu now link to
    the portal (the old "به‌زودی" toasts are gone). `queries.ts` adds
    `useTraffic7d`, `useMyProfile` (no retry on 404), `useSaveProfile`,
    `useMyOrders`.
  - **30 endpoints** total under `/api/v1`.
- **E2E:** `C:\Users\USER\AppData\Local\Temp\opencode\phase6-test.py`
  (backend venv python; live uvicorn :8010) — **31/31 PASS**: traffic
  shape/ordering, +2 counter for two GETs, no self-count, asset path
  ignored, 401/404/200 matrix, upsert create → partial clear → validation
  422s, orders list (images, money strings, ordering), self-cleans its
  test user.

### Phase 7 — Address Book + Order Variants ✅
Customer multi-address book (replaces the flat `users.province/city/
zip_code/address` columns) + product variants (wood/color) flowing through
the Redis cart into `OrderItem`. Verified: E2E 31/31, `tsc --noEmit` clean,
dev + prod SSR 200 on all routes.

- **Migration `b3f7c2a91d45 "Address book + order item variants"`** (new
  head): creates `user_addresses` (user_id FK CASCADE, title, province,
  city, zip_code, address, is_default, created/updated); data-migrates each
  flat address to a default `UserAddress` row; drops the 4 flat `users`
  columns; adds `order_items.wood_type/color` (VARCHAR(120) NULL).
- **`db/models.py`** — `UserAddress` model; `User` slimmed + `addresses`
  relationship (`all, delete-orphan`); `OrderItem` + variants.
- **`endpoints/users.py`** — address-book CRUD at `/users/me/addresses`
  (GET default-first, POST create — first becomes default, PUT update,
  DELETE with default-promotion); admin `GET /users` populates the flat
  address from each user's **default** `UserAddress` (one query).
- **`schemas/user.py`** — `UserAddressOut/In/Update`; `UserMeOut/
  UserMeUpdate` slimmed (no flat address).
- **Variants:** `CartLine` dataclass + `CartAddIn/CartLineOut/
  CartLineUpdateIn` carry `wood_type`/`color`; merge keeps incoming
  non-None, `set_line` preserves existing when None (old carts stay
  readable). `OrderItemOut` exposes them; checkout writes them from the
  cart line. `schemas/order.py` adds `CustomerIn.address_id`.
- **Checkout address flow** (`services/order.py`): with `address_id` the
  saved address's fields are authoritative + it is promoted to default;
  without it the `customer.*` fields are auto-saved, deduped by
  (province, city, zip, address), first = default. `_clear_default`
  enforces single-default in the app layer.
- **My Orders identity fix:** checkout binds `Order.user_id` to the
  logged-in account (auth bridge — see Phase 8), **not** the receiver's
  phone; `CustomerOut.phone` = owner phone; receiver phone rides in
  `shipping_details`.
- **Frontend:** `useMyAddresses/useSaveAddress/useDeleteAddress` hooks
  (`useMyAddresses` gated on the stored auth record for SSR);
  `/profile/account` = profile form + **دفترچه آدرس‌ها** (address cards,
  default badge, inline add/edit, set-default, delete); checkout
  address-card picker (card vs. new-address mode); variant label
  ("چوب … | … | همراه با روغن محافظ") on product/cart/checkout;
  `AddToCartButton`/`CartContext` carry variants.
- **34 endpoints** total under `/api/v1`.

### Phase 8 — Secure OTP Authentication (api.ir + JWT) ✅
Real OTP login replacing the mock `X-User-Phone` bridge. **Security and
cost control (anti SMS-bombing) are the top priorities.** Verified:
E2E **32/32** (`phase6-otp-test.py`), `tsc --noEmit` clean, Docker
frontend SSR 200 on `/ /auth /shop /cart /profile/account`.

- **Gateway** — `services/sms.py`: `send_otp_sms` + `send_otp_call` via
  `httpx.AsyncClient`. *(Migrated in Phase 10: originally the api.ir
  SmsOTP/CallOTP endpoints with a Bearer token; now the **sms.ir Verify
  API** with `X-API-KEY` — see Phase 10.)*
  **Empty gateway key → 503 without ever calling the provider (zero
  cost)**; provider non-2xx/network → 502 and the pending code is
  deleted. `requirements.txt` += `httpx`, `PyJWT`, `passlib`.
- **`api/v1/endpoints/auth.py`:**
  - `POST /auth/request-otp {phone, method: "sms"|"call"}` —
    **SECURITY 1 (rate limit):** `INCR otp:reqs:{phone}` (TTL 900 s on
    first touch); count > 3 → **429** (15-min block, provider never
    called). Then 5-digit code via `secrets.randbelow(100_000)` →
    `SETEX otp:code:{phone} 120 {code}`; dispatch per `method`.
  - `POST /auth/verify-otp {phone, code}` — no pending code → 400;
    wrong code → `INCR otp:fails:{phone}` (TTL 900 s); **SECURITY 2
    (brute-force):** fails > 5 → `otp:code:{phone}` deleted + 400
    (locked, even the right code now fails). On match: clears
    `otp:code/otp:fails/otp:reqs`, find-or-creates the `User` by phone
    (new → `role=customer`, name "مشتری پدر ژپتو"), mints a **JWT**
    (HS256, `JWT_SECRET`, 24 h, `sub=user.id` + phone + role) →
    `TokenOut {access_token, phone, role, expires_in}`.
- **`api/deps.py` (new)** — `get_current_user` (OAuth2PasswordBearer →
  decode → load `User`; 401 invalid/missing, 403 inactive) and
  `get_current_user_or_none` (optional, guest-safe). **All `/users/me`
  routes are JWT-protected**; the `X-User-Phone` bridge is fully removed
  from `users.py`. `orders.py` checkout uses `get_current_user_or_none`:
  token → order binds to the account phone; no token → receiver (guests
  still check out).
- **Frontend** — `routes/auth.tsx` refactored (design kept): real
  TanStack mutations against both endpoints; **strict 120 s countdown**;
  resend hidden until the timer hits 0, then **two side-by-side buttons**
  ("ارسال مجدد پیامک" + "دریافت کد از طریق تماس" → `method: "call"`);
  subtle "اصلاح شماره" back button; local attempt counter — 429 **or**
  attempts ≥ 3 → resend permanently disabled + toast "تعداد درخواست‌ها
  بیش از حد مجاز است. لطفاً ۱۵ دقیقه صبر کنید.". On success the JWT is
  saved into `choobkar-auth-user` (with phone/role) → the Customer
  Portal (`/profile`) hydrates with **real** data. `lib/api.ts`:
  interceptor injects `Authorization: Bearer <jwt>` (replaces
  `X-User-Phone`); a 401 on `/users/me` clears the session and fires
  `hc:auth-expired`; `useAuth.tsx` drops legacy token-less records and
  listens for the expiry event. `api-types.ts` += `ApiOtpRequest/
  ApiOtpSent/ApiOtpVerify/ApiAuthToken`.
- **Env:** gateway key (empty = 503, zero cost — `SMS_IR_API_KEY` since
  Phase 10) + `JWT_SECRET` (root `.env` / `.env.example` / compose, `:-`
  defaults so a missing key never blocks startup).
- **36 endpoints** total under `/api/v1`.

### Phase 9 — Media Public URL + Static Assets ✅
Fixes the two media breakages from the Docker networking transition:
(1) product/category images stored as `http://minio:9000/...` (an
internal Docker DNS name browsers can't resolve → `ERR_NAME_NOT_RESOLVED`)
and (2) storefront imagery not loading.

- **`MEDIA_PUBLIC_URL`** (`core/config.py`, default
  `http://localhost:9000`; root `.env`/`.env.example`/compose): the host
  the **browser** uses for media. `services/storage.py::_public_base_url`
  now builds client URLs from `MEDIA_PUBLIC_URL/{bucket}/...` instead of
  `S3_ENDPOINT_URL` — uploads return `http://localhost:9000/...` (on a
  VPS, point it at the CDN/proxy origin). The backend still talks to
  MinIO internally via `S3_ENDPOINT_URL` (`http://minio:9000`).
- **`scripts/fix_urls.py`** — one-shot, idempotent repair: rewrites the
  leading internal-endpoint prefix to the public host in
  `categories.image_url` (VARCHAR) and `products.images` (JSONB list).
  First run rewrote 4 categories + 10 products.
  Run: `docker compose exec -T backend python scripts/fix_urls.py`.
- **Static assets → `frontend/public/`**: the 7 storefront JPGs
  (hero-workshop, about-1/2, cat-kitchen/office/digital/gift) moved from
  `src/assets/` (hashed Vite imports) to `public/` (served at the site
  root, identical in dev/SSR/prod). The 6 referencing modules
  (`shop-data.ts`, `index.tsx`, `about.tsx`, `guide.tsx`,
  `admin-categories.ts`, `admin/storefront.tsx`) now use plain root
  paths (`/hero-workshop.jpg`, …). `scripts/seed.py`'s `FRONTEND_ASSETS`
  points at `frontend/public/` accordingly.
- Verified: host fetch of a MinIO object via `localhost:9000` = 200
  (image/jpeg); fresh `POST /upload` returns a `localhost:9000` URL;
  `GET /categories` + `/products` serve public URLs; `/hero-workshop.jpg`
  = 200 from the frontend container; SSR 200 on `/ /shop /about`;
  `tsc --noEmit` clean.

### Phase 10 — SMS Provider Migration: api.ir → sms.ir ✅ (current)
The OTP SMS provider moved from api.ir to **sms.ir**. The auth contract
(`/auth/request-otp` `method: "sms"|"call"`, Redis rate limits, 120 s
code TTL, JWT) and the entire frontend UX (120 s countdown, two resend
buttons, 429/brute-force lock, toasts) are **unchanged**.

- **`core/config.py`** — `api_ir_token`/`api_ir_base_url` removed;
  added `sms_ir_api_key: str = ""` (env `SMS_IR_API_KEY`) and
  `sms_ir_template_id: int = 100000` (env `SMS_IR_TEMPLATE_ID`).
- **`services/sms.py`** — `send_otp_sms` now POSTs
  `https://api.sms.ir/v1/send/verify` with headers
  `{"X-API-KEY": sms_ir_api_key, "Accept": "application/json"}` and body
  `{"mobile", "templateId": sms_ir_template_id, "parameters":
  [{"name": "CODE", "value": code}]}`. Empty key →
  `SmsNotConfiguredError` → **503 before any provider call** (unchanged);
  non-2xx/network → `SmsError` → 502 + code deleted (unchanged).
  `send_otp_call` keeps its signature but is **mocked**: logs the request
  via `logging` and returns success (sms.ir's voice flow is a separate
  product and is pending integration) — the "دریافت کد از طریق تماس"
  button still works end-to-end against the Redis/JWT flow.
- **Env** — root `.env` / `.env.example` / `docker-compose.yml`:
  `API_IR_TOKEN` → `SMS_IR_API_KEY` (+ `SMS_IR_TEMPLATE_ID`, default
  100000). `JWT_SECRET` untouched.
- Verified: `py_compile` clean; backend rebuilt + recreated;
  `request-otp` with empty key → **503**; `request-otp` `method:"call"`
  → 200 (mock logged) + code verifiable → JWT (full mock-call flow);
  bogus key against the real endpoint → provider 401 → **502** + code
  deleted (error path confirmed against `api.sms.ir`).

---

## 5. Repository Layout (monorepo)

The repo root is the monorepo: `backend/` + `frontend/` (formerly
`handcrafted-hearthwood/`) + one Docker Compose stack. Git history is
4 phased commits (see `setup_git.sh`); remote `origin/main`.

```text
.
├── docker-compose.yml    # postgres + redis + minio + backend + frontend (health-gated)
├── .env / .env.example   # unified env (root .env is git-ignored; NEVER commit)
├── .gitignore            # monorepo-level ignores
├── README.md             # stack docs + `docker compose up -d --build` runbook
├── setup_git.sh          # phased 4-commit history initializer
├── backend/
│   ├── AGENT.md          # this file — central memory
│   ├── Dockerfile        # python:3.13-slim + Uvicorn :8010
│   ├── docker-entrypoint.sh  # wait-for-pg → alembic upgrade head → uvicorn
│   ├── .dockerignore
│   ├── .env.example      # copy to .env (NEVER commit .env)
│   ├── .gitignore
│   ├── requirements.txt  # incl. httpx + PyJWT + passlib (Phase 8 auth)
│   ├── alembic.ini       # migration config (URL injected by env.py)
│   ├── alembic/
│   │   ├── env.py        # async env — reads core.config, imports db.models
│   │   └── versions/     # head: b3f7c2a91d45 "Address book + order item variants"
│   ├── main.py           # FastAPI app + CORS + TrafficMiddleware + api_router + redis close
│   ├── api/
│   │   ├── deps.py       # get_current_user / get_current_user_or_none (JWT, Phase 8)
│   │   └── v1/
│   │       ├── api.py    # master APIRouter (single aggregation point)
│   │       └── endpoints/
│   │           ├── auth.py         # POST /auth/request-otp, /auth/verify-otp (Redis rate limits + JWT)
│   │           ├── upload.py       # POST /upload (multipart → MinIO)
│   │           ├── categories.py   # GET/POST /categories
│   │           ├── products.py     # GET /products (?active=), POST /products, GET+PATCH /products/{id}
│   │           ├── cart.py         # GET /cart, POST /cart/add, PATCH /cart/line, DELETE /cart/remove, /cart/clear (X-Session-Id)
│   │           ├── promotions.py   # GET/POST /promotions, PATCH/DELETE /{id}, POST /validate
│   │           ├── orders.py       # POST /orders (checkout + idempotency lock + JWT account binding), GET /orders, GET /orders/{id}, PATCH /{id}/status
│   │           ├── settings.py     # GET /settings, PATCH /settings (singleton, cache-invalidated)
│   │           ├── users.py        # GET /users (admin) + /users/me family (JWT) + /users/me/addresses (Phase 7)
│   │           └── analytics.py    # GET /analytics/sales, /activities, /traffic
│   ├── core/
│   │   ├── config.py         # pydantic-settings (env-driven config; + sms_ir_*, jwt_*, media_public_url)
│   │   ├── cache.py          # async Redis client (lazy singleton) — carts + cache + counters + OTP state
│   │   ├── middleware.py     # TrafficMiddleware — best-effort Redis page-view INCR on GETs (Phase 6)
│   │   └── pricing.py        # Decimal helpers + FREE_SHIPPING_FROM + DEFAULT_SHIPPING_METHODS
│   ├── db/
│   │   ├── database.py       # async engine, session factory, Base, get_db()
│   │   └── models.py         # User, UserAddress, Category, Product, PromoCode, Order, OrderItem, StoreSettings
│   ├── schemas/
│   │   ├── common.py         # shared constraints (ImageHttpUrl)
│   │   ├── auth.py           # OtpRequestIn/Out, OtpVerifyIn, TokenOut (Phase 8)
│   │   ├── category.py       # CategoryCreate/Update/Response
│   │   ├── product.py        # ProductCreate/Update/Response
│   │   ├── cart.py           # CartAddIn, CartLineOut, CartOut (+ wood_type/color, Phase 7)
│   │   ├── promotion.py      # PromoCreate/Update/Response, PromoValidateIn/Out
│   │   ├── order.py          # CustomerIn (+ address_id), OrderCreateIn, OrderOut, to_order_out()
│   │   ├── settings.py       # StoreSettingsOut, StoreSettingsUpdate, ShippingMethodIn/Out
│   │   ├── user.py           # UserResponse (admin) + UserMe* + MyOrder* + UserAddress* (Phase 7)
│   │   └── analytics.py      # SalesDayOut, TrafficDayOut, ActivityFeedOut (FeedOrder/User/Stock)
│   ├── scripts/
│   │   ├── seed.py           # Great Seed — mock catalog → Postgres + MinIO (idempotent; assets from frontend/public)
│   │   └── fix_urls.py       # one-shot: internal minio:9000 URLs → public host (Phase 9)
│   └── services/
│       ├── sms.py            # sms.ir Verify OTP via httpx; Call mocked (Phase 8/10)
│       ├── storage.py        # MediaStorage — async MinIO uploads; public URLs via MEDIA_PUBLIC_URL
│       ├── errors.py         # CheckoutError base (shared, avoids import cycles)
│       ├── cart.py           # Redis cart (WATCH/MULTI, TTL 14d, qty cap 20, variants)
│       ├── promotion.py      # assert_redeemable + calc_discount (single source)
│       ├── settings.py       # StoreSettingsData/PricingRules — Redis-cached singleton
│       ├── lock.py           # CheckoutLock — Redis SETNX 10s TTL double-submit guard
│       └── order.py          # place_order — atomic checkout (address resolve + variants)
└── frontend/
    ├── Dockerfile        # bun build (NITRO_PRESET=node-server) → node:22-alpine :8080
    ├── .dockerignore
    ├── public/           # static storefront imagery (site-root paths, Phase 9) + favicon/robots
    └── src/              # TanStack Start storefront + admin (see Phase 5–9 notes)
```

Planned for later phases: Redis read-caching for hot catalog endpoints,
payment gateway integration, `workers/`.

---

## 6. Conventions (binding)

1. **Async only** — never use blocking drivers or calls in request paths.
2. **All configuration** through `core.config.get_settings()`; never
   hardcode hosts, ports, or credentials in code.
3. **DB access** via the `get_db()` dependency from `db/database.py`;
   commits/rollbacks are explicit in the handler/service layer.
4. **Secrets** live only in `.env` (git-ignored); compose fails fast when
   a required variable is missing.
5. **Migrations only** for schema changes
   (`alembic revision --autogenerate`); never
   `Base.metadata.create_all` outside throwaway scripts. Always review the
   generated migration before `alembic upgrade head`.
6. **Never set `case_sensitive=True`** in `Settings` — it breaks the
   lowercase-field → `UPPERCASE` env-var mapping and settings silently
   fall back to defaults (real bug found in Phase 2).
7. New models must be importable from `alembic/env.py` (it imports
   `db.models`) for autogenerate to see them.
8. **Auth is JWT-only (Phase 8)** — protected routes take
   `user: User = Depends(get_current_user)` (or `..._or_none` for
   guest-tolerant flows); never trust client-sent identity (the old
   `X-User-Phone` header bridge is removed). OTP state lives in Redis
   only (`otp:code/otp:fails/otp:reqs:{phone}`) with the limits in
   `endpoints/auth.py` — do not weaken them (cost/security).
9. Keep this file current whenever any of the above changes.

---

## 7. How to Run

### Docker (primary — local or VPS, from the repo root)

```powershell
cd C:\Users\USER\Desktop\site
Copy-Item .env.example .env      # then set strong secrets (+ SMS_IR_API_KEY, JWT_SECRET)
docker compose up -d --build     # 5 containers, health-gated; backend auto-runs alembic
docker compose exec backend python scripts/seed.py   # first run only (idempotent)
```

- Storefront `http://localhost:8080` · API `http://localhost:8010/api/v1` ·
  Swagger `http://localhost:8010/docs` · MinIO console `:9001`.
- Backend container entrypoint: wait-for-pg → `alembic upgrade head` →
  Uvicorn. The backend container mounts `./frontend/public`
  (`/frontend/public:ro`) so `scripts/seed.py` can read the catalog
  images. Recreate after compose changes: `docker compose up -d --build backend`.
- **Trap (this machine):** a stray host process can still own
  `127.0.0.1:8010`/`:8080` (e.g. an old dev uvicorn / Adobe Connect) and
  silently answer loopback traffic instead of the container — verify with
  `Get-NetTCPConnection -LocalPort 8010` if "stale code" appears.
- **Env note:** `scripts\seed.py` reconfigures stdio to UTF-8 (Persian
  logs on the cp1252 console) and is idempotent.

### Backend-only dev (Windows, pre-Docker legacy)

```powershell
cd backend
Copy-Item .env.example .env      # then set strong secrets
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head             # apply migrations (head: b3f7c2a91d45)
scripts\seed.py                  # optional: seed the catalog (idempotent)
uvicorn main:app --reload --port 8010
```

---

## 8. Frontend Contract Alignment (migration `e4de7a96d53b`)

Five structural decisions were made against the mock frontend
(`handcrafted-hearthwood`) and baked into the DB. They remain the
contract the (now live-wired) frontend follows — keep these shapes:

1. **Category image** — `categories.image_url` (nullable VARCHAR(512)).
   The admin category manager already persists an `image` per category;
   the API must accept/return it (MinIO object URL in production).
2. **Configurable shipping** — `orders.shipping_method` (nullable
   VARCHAR(60)) stores the *id* of the chosen method; the method catalog
   (id / title / note / fee) is store configuration, not code. The mock
   keeps it in admin store settings (`shippingMethods`); the API should
   expose it as a settings resource. The order also persists the fee
   actually charged in `shipping_cost`.
3. **Product image architecture** — `products.images` is a **JSONB list**
   (index 0 = primary card image, index 1 = card hover image, the rest
   feed the product-page gallery). `profit_margin` (NUMERIC(10,2))
   records the per-unit margin for the dashboard. The old
   `main_image_url` / `hover_image_url` columns are **gone**.
4. **Promo minimum purchase** — `promo_codes.min_purchase_amount`
   (NUMERIC(10,2), 0 = no minimum). Checkout must reject redemption below
   the threshold (the mock rejects on apply and auto-drops the code if
   the cart shrinks under it).
5. **Comprehensive user profile** — `users.province / city / zip_code /
   address` (nullable VARCHARs). *(Phase 7 superseded: these flat columns
   were dropped in favor of the `user_addresses` book — see Phase 7; the
   admin board still surfaces each user's default address.)*

Frontend state (end of Phase 5): wired to this API (see the Phase 5
section above); `bun x tsc --noEmit` clean and `bun run build` passes
(nitro production bundle). Note the working tree uses CRLF line endings
(Windows checkout) while the repo commits LF — repo-wide
`prettier/prettier` "Delete ␍" lint noise is pre-existing, not a
regression.