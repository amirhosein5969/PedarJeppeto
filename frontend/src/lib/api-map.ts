/**
 * Wire → domain mappers (Phase 5).
 *
 * The only place where the backend's 2-place decimal money STRINGS become
 * JS numbers (`toToman`), and where snake_case API fields become the
 * camelCase shapes the UI already speaks (`StoreSettings`, `AdminOrder`, …).
 * Every component renders from these mapped types — no raw wire data leaks
 * into JSX.
 */
import type {
  ApiCategory,
  ApiOrder,
  ApiPromo,
  ApiProduct,
  ApiStoreSettings,
  ApiStoreSettingsUpdate,
  ApiUser,
} from "@/lib/api-types";
import { toJalaliString, type AdminOrder, type OrderStatus } from "@/lib/admin-orders";
import type { AdminProduct } from "@/lib/admin-products";
import type { AdminUser } from "@/lib/admin-users";
import type { ShippingMethodConfig, StoreSettings } from "@/lib/admin-settings";
import type { Product } from "@/lib/shop-data";

// =============================================================================
// Money (exact 2-place decimal string ⇄ JS number, toman is integer-safe)
// =============================================================================

/** `"382500.00"` → `382500`. Safe for any finite decimal string. */
export const toToman = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/** `382500` → `"382500.00"` — the shape the backend Decimal fields accept. */
export const fromToman = (value: number): string =>
  Math.round(Number.isFinite(value) ? value : 0).toFixed(2);

// =============================================================================
// Product catalog
// =============================================================================

const SPEC_HEADER = "مشخصات:";

/**
 * Split the seeded description (summary + "مشخصات:" spec lines) back into its
 * storefront parts. The seed writes exactly:
 *   "{summary}\nمشخصات:\n- {label}: {value}\n…"
 */
export function parseDescription(description: string): {
  summary: string;
  specs: { label: string; value: string }[];
} {
  const idx = description.indexOf(`\n${SPEC_HEADER}`);
  if (idx === -1) return { summary: description.trim(), specs: [] };
  const summary = description.slice(0, idx).trim();
  const specs = description
    .slice(idx + 1)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => {
      const body = line.slice(2);
      const sep = body.indexOf(": ");
      if (sep === -1) return { label: body, value: "" };
      return { label: body.slice(0, sep), value: body.slice(sep + 2) };
    });
  return { summary, specs };
}

/**
 * API product → storefront `Product`. `price` is the pre-discount shelf price
 * (from `list_price`) and `discount` is derived, so `finalPrice(product)`
 * reproduces the DB `base_price` exactly.
 */
export function toShopProduct(p: ApiProduct, categorySlug: string): Product {
  const { summary, specs } = parseDescription(p.description);
  const base = toToman(p.base_price);
  const list = p.list_price !== null ? toToman(p.list_price) : base;
  const discount = list > base ? Math.round(((list - base) / list) * 100) : 0;
  return {
    id: String(p.id),
    name: p.title,
    category: categorySlug,
    price: list,
    discount,
    summary,
    specs,
    images: p.images,
    image: p.images[0] ?? "",
    imageAlt: p.images[1] ?? "",
  };
}

/**
 * API product → admin `AdminProduct`. `price` is the list price
 * (`list_price`, or `base_price` when there is no discount) and `costPrice`
 * is reconstructed from the API's `profit_margin` (stored as
 * final price − cost at save time), so the edit sheet round-trips exactly.
 */
export function toAdminProduct(p: ApiProduct, categorySlug: string): AdminProduct {
  const { summary, specs } = parseDescription(p.description);
  const base = toToman(p.base_price);
  const list = p.list_price !== null ? toToman(p.list_price) : base;
  const discount = list > base ? Math.round(((list - base) / list) * 100) : 0;
  const final = Math.round((list * (100 - discount)) / 100); // equals `base`
  const margin = toToman(p.profit_margin);
  const specValue = (label: string) => specs.find((s) => s.label === label)?.value ?? "";
  return {
    id: String(p.id),
    title: p.title,
    description: summary,
    category: categorySlug,
    price: list,
    discount,
    costPrice: Math.max(0, final - margin),
    dimensions:
      specValue("ابعاد") || specValue("ابعاد باز") || specValue("طول") || specValue("قطر"),
    material: specs.find((s) => s.label.startsWith("جنس"))?.value ?? "",
    color: specValue("رنگ"),
    images: p.images,
    inStock: p.is_active,
    stockCount: p.stock_count,
  };
}

/**
 * Rebuild the canonical description the storefront parser expects:
 * `{summary}\nمشخصات:\n- ابعاد: …\n- جنس: …\n- رنگ: …` (empty specs skipped).
 */
export function buildProductDescription(
  summary: string,
  dimensions: string,
  material: string,
  color: string,
): string {
  const specs = [
    dimensions ? `- ابعاد: ${dimensions}` : "",
    material ? `- جنس: ${material}` : "",
    color ? `- رنگ: ${color}` : "",
  ].filter(Boolean);
  return specs.length > 0 ? `${summary}\nمشخصات:\n${specs.join("\n")}` : summary;
}

// =============================================================================
// Store settings — the exact snake_case ⇄ camelCase contract
// (support_phone ⇄ phone, signature_packaging_* ⇄ giftBox*)
// =============================================================================

export function toStoreSettings(s: ApiStoreSettings): StoreSettings {
  return {
    storeName: s.store_name,
    phone: s.support_phone,
    email: s.email,
    address: s.address,
    zipCode: s.zip_code,
    vatPercentage: toToman(s.vat_percentage),
    giftBoxPrice: toToman(s.signature_packaging_price),
    giftBoxEnabled: s.signature_packaging_enabled,
    careOilPrice: toToman(s.care_oil_price),
    careOilEnabled: s.care_oil_enabled,
    shippingMethods: s.shipping_methods.map((m) => ({
      id: m.id,
      title: m.title,
      note: m.note,
      fee: toToman(m.fee),
    })),
    announcementText: s.announcement_text,
  };
}

export function toSettingsUpdate(s: StoreSettings): ApiStoreSettingsUpdate {
  return {
    store_name: s.storeName,
    support_phone: s.phone,
    email: s.email,
    address: s.address,
    zip_code: s.zipCode,
    vat_percentage: fromToman(s.vatPercentage),
    care_oil_price: fromToman(s.careOilPrice),
    care_oil_enabled: s.careOilEnabled,
    signature_packaging_price: fromToman(s.giftBoxPrice),
    signature_packaging_enabled: s.giftBoxEnabled,
    shipping_methods: s.shippingMethods.map((m) => ({
      id: m.id,
      title: m.title,
      note: m.note,
      fee: fromToman(m.fee),
    })),
    announcement_text: s.announcementText,
  };
}

// =============================================================================
// Admin: orders
// =============================================================================

/**
 * API order → admin `AdminOrder`. `dbId` carries the numeric id (status
 * updates + invoice links); the display id stays the `#ORD-…` string.
 *
 * The API stores the shipping-method *id* and the packaging *flag* only, so
 * the method title / packaging price are resolved from live store settings
 * at render time (see `useSettings` consumers).
 */
export function toAdminOrder(o: ApiOrder): AdminOrder {
  const d = o.shipping_details;
  return {
    dbId: o.id,
    id: `#${o.order_number}`,
    customer: o.customer.full_name,
    date: toJalaliString(new Date(o.created_at)),
    createdAt: o.created_at,
    totalAmount: toToman(o.total_amount),
    items: o.items.map((it) => ({
      productId: String(it.product_id),
      title: it.title,
      qty: it.quantity,
      unitPrice: toToman(it.unit_price),
      careOilAdded: it.care_oil_added,
      careOilPrice: toToman(it.care_oil_price),
    })),
    status: o.status as OrderStatus,
    shippingDetails: {
      name: d?.name ?? o.customer.full_name,
      phone: d?.phone ?? o.customer.phone,
      province: d?.province ?? "",
      city: d?.city ?? "",
      address: d?.address ?? "",
      postalCode: d?.postal_code ?? "",
    },
    shippingCost: toToman(o.shipping_cost),
    shippingMethod: o.shipping_method ?? "",
    shippingMethodTitle: o.shipping_method ?? "",
    discountAmount: toToman(o.discount_amount),
    vatAmount: toToman(o.vat_amount),
    giftBox: o.signature_packaging,
    giftBoxPrice: 0, // resolved from live settings at render time
  };
}

// =============================================================================
// Admin: users
// =============================================================================

export function toAdminUser(u: ApiUser): AdminUser {
  return {
    id: String(u.id),
    // New OTP sign-ups start with an empty name (until they fill the
    // profile / place an order) — render a quiet placeholder, not a blank.
    name: u.full_name.trim() || "بدون نام",
    phone: u.phone,
    role: u.role,
    joinDate: toJalaliString(new Date(u.created_at)),
    active: u.is_active,
    address: {
      province: u.province ?? "",
      city: u.city ?? "",
      zipCode: u.zip_code ?? "",
      address: u.address ?? "",
    },
    orderCount: u.order_count,
    totalSpent: toToman(u.total_spent),
  };
}

// =============================================================================
// Admin: promos (0 ⇄ null conventions: 0 = unlimited on the frontend)
// =============================================================================

export type PromoCode = {
  id: string;
  code: string;
  discountPercentage: number;
  /** Cap in toman; 0 = uncapped. */
  maxDiscountAmount: number;
  /** Minimum purchase in toman; 0 = none. */
  minPurchaseAmount: number;
  /** 0 = unlimited. */
  usageLimit: number;
  timesUsed: number;
  isActive: boolean;
};

export function toPromo(p: ApiPromo): PromoCode {
  return {
    id: String(p.id),
    code: p.code,
    discountPercentage: toToman(p.discount_percentage),
    maxDiscountAmount: toToman(p.max_discount_amount),
    minPurchaseAmount: toToman(p.min_purchase_amount),
    usageLimit: p.usage_limit ?? 0,
    timesUsed: p.times_used,
    isActive: p.is_active,
  };
}

export type PromoCreateInput = Omit<PromoCode, "id" | "timesUsed">;

export function fromPromoCreate(p: PromoCreateInput) {
  return {
    code: p.code,
    discount_percentage: fromToman(p.discountPercentage),
    max_discount_amount: p.maxDiscountAmount > 0 ? fromToman(p.maxDiscountAmount) : null,
    min_purchase_amount: fromToman(p.minPurchaseAmount),
    usage_limit: p.usageLimit > 0 ? p.usageLimit : null,
    is_active: p.isActive,
  };
}

export function fromPromoUpdate(p: Partial<PromoCode>) {
  return {
    ...(p.code !== undefined ? { code: p.code } : {}),
    ...(p.discountPercentage !== undefined
      ? { discount_percentage: fromToman(p.discountPercentage) }
      : {}),
    ...(p.maxDiscountAmount !== undefined
      ? {
          max_discount_amount: p.maxDiscountAmount > 0 ? fromToman(p.maxDiscountAmount) : null,
        }
      : {}),
    ...(p.minPurchaseAmount !== undefined
      ? { min_purchase_amount: fromToman(p.minPurchaseAmount) }
      : {}),
    ...(p.usageLimit !== undefined ? { usage_limit: p.usageLimit > 0 ? p.usageLimit : null } : {}),
    ...(p.isActive !== undefined ? { is_active: p.isActive } : {}),
  };
}

// =============================================================================
// Categories (passthrough with a display alias)
// =============================================================================

export type Category = {
  id: number;
  slug: string;
  title: string;
  /** Short label for chips/tabs — the API has no `short`, so use the title. */
  short: string;
  image: string;
};

export function toCategory(c: ApiCategory): Category {
  return {
    id: c.id,
    slug: c.slug,
    title: c.name,
    short: c.name,
    image: c.image_url ?? "",
  };
}
