/**
 * Wire types — mirror the FastAPI/Pydantic response schemas 1:1
 * (backend: `backend/schemas/*.py`).
 *
 * **Money contract**: every monetary field arrives as an exact 2-place
 * decimal STRING (e.g. `"382500.00"`). These types keep it as `string`;
 * convert to a JS number ONLY at the domain boundary via `toToman()`
 * (see `src/lib/api-map.ts`) and back to a string via `fromToman()` when
 * sending money in request bodies.
 */

/** A 2-place decimal money string, e.g. "382500.00". */
export type Money = string;

export interface ApiCategory {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
}

export interface ApiProduct {
  id: number;
  title: string;
  description: string;
  /** Final unit price in toman (what the cart/checkout charge). */
  base_price: Money;
  /** Pre-discount shelf price; null = no discount. */
  list_price: Money | null;
  stock_count: number;
  /** Ordered MinIO URLs — index 0 primary, index 1 hover, rest gallery. */
  images: string[];
  /** Per-unit profit margin in toman (admin analytics). */
  profit_margin: Money;
  category_id: number;
  is_active: boolean;
}

export interface ApiCartLine {
  product_id: number;
  title: string;
  unit_price: Money;
  quantity: number;
  care_oil_added: boolean;
  /** Phase 7 variant selections (null when the customer picked none). */
  wood_type: string | null;
  color: string | null;
  /** unit_price * quantity (+ oil when opted in) — current DB price. */
  line_subtotal: Money;
}

export interface ApiCart {
  items: ApiCartLine[];
  count: number;
  /** Goods + per-line care oil (free-shipping & promo-minimum base). */
  subtotal: Money;
  /** Cart lines whose product is missing/deactivated. */
  unavailable: number[];
}

export interface ApiShippingMethod {
  id: string;
  title: string;
  note: string;
  fee: Money;
}

export interface ApiStoreSettings {
  store_name: string;
  support_phone: string;
  email: string;
  address: string;
  zip_code: string;
  vat_percentage: Money;
  care_oil_price: Money;
  care_oil_enabled: boolean;
  signature_packaging_price: Money;
  signature_packaging_enabled: boolean;
  shipping_methods: ApiShippingMethod[];
}

export interface ApiStoreSettingsUpdate {
  store_name?: string;
  support_phone?: string;
  email?: string;
  address?: string;
  zip_code?: string;
  vat_percentage?: Money;
  care_oil_price?: Money;
  care_oil_enabled?: boolean;
  signature_packaging_price?: Money;
  signature_packaging_enabled?: boolean;
  shipping_methods?: (ApiShippingMethod & { fee: Money })[];
}

export interface ApiPromo {
  id: number;
  code: string;
  discount_percentage: Money;
  /** null = uncapped. */
  max_discount_amount: Money | null;
  /** 0 = no minimum purchase. */
  min_purchase_amount: Money;
  /** null = unlimited uses; 0 = also unlimited (frontend convention). */
  usage_limit: number | null;
  times_used: number;
  is_active: boolean;
}

/** POST /promotions/validate — the exact discount a checkout would apply. */
export interface ApiPromoValidate {
  code: string;
  valid: boolean;
  discount_percentage: Money;
  max_discount_amount: Money | null;
  min_purchase_amount: Money;
  discount_amount: Money;
}

export interface ApiOrderItem {
  product_id: number;
  title: string;
  quantity: number;
  unit_price: Money;
  care_oil_added: boolean;
  care_oil_price: Money;
  /** Phase 7 variant snapshots captured at purchase (null when not chosen). */
  wood_type: string | null;
  color: string | null;
}

export interface ApiCustomer {
  id: number;
  full_name: string;
  phone: string;
  province: string | null;
  city: string | null;
  zip_code: string | null;
  address: string | null;
}

export interface ApiShippingDetails {
  name: string;
  phone: string;
  province: string;
  city: string;
  address: string;
  postal_code: string;
  note?: string;
}

export type ApiOrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export interface ApiOrder {
  id: number;
  order_number: string;
  status: ApiOrderStatus;
  shipping_method: string | null;
  signature_packaging: boolean;
  shipping_cost: Money;
  discount_amount: Money;
  vat_amount: Money;
  total_amount: Money;
  created_at: string;
  customer: ApiCustomer;
  shipping_details: ApiShippingDetails | null;
  items: ApiOrderItem[];
}

export interface ApiUser {
  id: number;
  phone: string;
  role: "admin" | "customer";
  full_name: string;
  is_active: boolean;
  province: string | null;
  city: string | null;
  zip_code: string | null;
  address: string | null;
  created_at: string;
  order_count: number;
  total_spent: Money;
}

// =============================================================================
// Analytics (admin dashboard)
// =============================================================================

/** GET /analytics/sales — one day of the 7-day revenue series. */
export interface ApiSalesDay {
  /** ISO date, e.g. "2026-09-18" (server-local day). */
  date: string;
  /** Sum of non-cancelled order totals that day. */
  total: Money;
}

/** GET /analytics/activities — a recent order on the timeline. */
export interface ApiFeedOrder {
  order_number: string;
  customer: string;
  status: ApiOrderStatus;
  total: Money;
  created_at: string;
}

/** GET /analytics/activities — a recently registered customer. */
export interface ApiFeedUser {
  full_name: string;
  phone: string;
  created_at: string;
}

/** GET /analytics/activities — a low-stock alert (stock_count < 3). */
export interface ApiFeedStock {
  product_id: number;
  title: string;
  stock_count: number;
}

/** GET /analytics/activities — the combined feed (newest first per list). */
export interface ApiActivityFeed {
  orders: ApiFeedOrder[];
  users: ApiFeedUser[];
  low_stock: ApiFeedStock[];
}

/** GET /analytics/traffic — one day of the 7-day page-view series (Redis). */
export interface ApiTrafficDay {
  /** ISO date, e.g. "2026-09-18" (server-local day). */
  date: string;
  /** Counted page views for that day (0 when the counter key is absent). */
  views: number;
}

// =============================================================================
// Customer portal (Phase 6) — /users/me
// =============================================================================

/** GET /users/me — the logged-in customer's own profile.
 *
 *  Shipping addresses live in the address book (`ApiUserAddress`), so this
 *  no longer carries the flat province/city/zip/address fields (Phase 7).
 */
export interface ApiMe {
  id: number;
  phone: string;
  role: "admin" | "customer";
  full_name: string;
  /** Free-form important dates for gifting reminders (null = unset). */
  important_date: string | null;
  created_at: string;
}

// =============================================================================
// Secure OTP authentication (api.ir gateway + JWT)
// =============================================================================

/** POST /auth/request-otp — dispatch a 5-digit OTP. */
export interface ApiOtpRequest {
  phone: string;
  method: "sms" | "call";
}

/** Response of POST /auth/request-otp. */
export interface ApiOtpSent {
  sent: boolean;
  method: "sms" | "call";
  ttl_seconds: number;
}

/** POST /auth/verify-otp — check the OTP. */
export interface ApiOtpVerify {
  phone: string;
  code: string;
}

/** Response of POST /auth/verify-otp — the JWT access token. */
export interface ApiAuthToken {
  access_token: string;
  token_type: string;
  phone: string;
  role: "admin" | "customer";
  expires_in: number;
}

/** PATCH /users/me — partial profile update (null clears, omit keeps). */
export interface ApiMeUpdate {
  full_name?: string | null;
  important_date?: string | null;
}

/** GET/POST/PUT /users/me/addresses — one saved shipping address. */
export interface ApiUserAddress {
  id: number;
  title: string;
  province: string | null;
  city: string | null;
  zip_code: string | null;
  address: string | null;
  is_default: boolean;
}

/** POST /users/me/addresses body. */
export interface ApiUserAddressInput {
  title?: string;
  province: string;
  city: string;
  zip_code?: string | null;
  address: string;
  is_default?: boolean;
}

/** PUT /users/me/addresses/{id} body (all optional — partial update). */
export interface ApiUserAddressUpdate {
  title?: string | null;
  province?: string | null;
  city?: string | null;
  zip_code?: string | null;
  address?: string | null;
  is_default?: boolean | null;
}

/** GET /users/me/orders — one line of the customer's order history. */
export interface ApiMyOrderItem {
  product_id: number;
  title: string;
  quantity: number;
  unit_price: Money;
  /** The product's primary image (images[0]); null if the product has none. */
  image: string | null;
}

/** GET /users/me/orders — a customer order (card view-model). */
export interface ApiMyOrder {
  id: number;
  order_number: string;
  status: ApiOrderStatus;
  total_amount: Money;
  created_at: string;
  items: ApiMyOrderItem[];
}