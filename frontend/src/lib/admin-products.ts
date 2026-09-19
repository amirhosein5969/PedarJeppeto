/**
 * Admin-side product model (Phase 5: live API-backed).
 *
 * Data comes from `GET /api/v1/products` (mapped in `api-map.ts` via
 * `toAdminProduct`); this module now only owns the **type** and the pure
 * price helpers the admin UI renders with. The localStorage seed +
 * load/save were removed with the mock phase.
 *
 * Field mapping (API ⇄ admin):
 * - `price`   ⇄ `list_price` (original/strikethrough price; falls back to
 *   `base_price` when the product has no discount)
 * - `costPrice` (قیمت تمام‌شده) ⇄ `profit_margin` (stored as
 *   final price − cost; reconstructed on read)
 * - `inStock` ⇄ `is_active` (soft delete = "ناموجود/حذف‌شده")
 * - `stockCount` ⇄ `stock_count`
 * - `category` (slug) ⇄ `category_id` (resolved via the categories list)
 */

export type StockValue = "in" | "out";

export type AdminProduct = {
  /** Stringified DB id. */
  id: string;
  title: string;
  /** Short summary (the description with the "مشخصات:" block stripped). */
  description: string;
  /** Category slug, e.g. "kitchen". */
  category: string;
  /** قیمت اصلی (toman) — the original/strikethrough shelf price. */
  price: number;
  /** Discount percentage 0-100; 0 means no discount. Drives badge + final. */
  discount: number;
  /** قیمت تمام‌شده — workshop cost per unit in toman. */
  costPrice: number;
  dimensions: string;
  material: string;
  color: string;
  /** Product gallery (MinIO URLs); the first entry is the primary image. */
  images: string[];
  inStock: boolean;
  /** Units available. */
  stockCount: number;
};

/** Final sale price: original price minus the discount, rounded. */
export const adminFinalPrice = (p: AdminProduct): number =>
  Math.round((p.price * (100 - p.discount)) / 100);

/** Per-unit profit at the current discount: final sale price − cost. */
export const adminUnitProfit = (p: AdminProduct): number => adminFinalPrice(p) - p.costPrice;