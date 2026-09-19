/**
 * Admin-side order model (Phase 5: live API-backed).
 *
 * The data comes from `GET /api/v1/orders` (mapped in `api-map.ts`); this
 * module now only owns the **type** and the pure money/date helpers the
 * admin UI renders with. `loadAdminOrders`/`saveAdminOrders` and the seed
 * data were removed with the localStorage mock phase.
 *
 * v4 model: v3 financial breakdown (shippingCost, discountAmount, vatAmount)
 * + real ISO timestamp (createdAt), plus the luxury add-ons captured at
 * checkout — a per-item premium wood care oil (careOilAdded/careOilPrice on
 * each line) and an order-level signature gift box (giftBox/giftBoxPrice).
 */

import { toFa } from "@/lib/shop-data";

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export type OrderItem = {
  productId: string;
  title: string;
  qty: number;
  /** Effective unit price in toman (after any applied product discount). */
  unitPrice: number;
  /** روغن محافظ مخصوص به این ردیف اضافه شد؟ (per-item add-on) */
  careOilAdded: boolean;
  /** Price of the care-oil bottle captured at order time (0 when not added). */
  careOilPrice: number;
};

/** Receiver/shipping block stored per order at checkout time. */
export type ShippingDetails = {
  name: string;
  phone: string;
  province: string;
  city: string;
  address: string;
  /** 10-digit Iranian postal code; "" for express Tehran delivery. */
  postalCode: string;
};

export type AdminOrder = {
  /** Numeric DB id — status updates + invoice links use this. */
  dbId: number;
  /** Display id, e.g. "#ORD-0007". */
  id: string;
  customer: string;
  /** Jalali date string for display, e.g. "۱۴۰۳/۰۶/۱۲". */
  date: string;
  /** ISO timestamp — source of truth for age/SLA calculations. */
  createdAt: string;
  /** Authoritative charged total in toman (API `total_amount`). */
  totalAmount: number;
  items: OrderItem[];
  status: OrderStatus;
  shippingDetails: ShippingDetails;
  /** هزینه ارسال (toman). */
  shippingCost: number;
  /** روش ارسال انتخابی — stable id of the configured method (e.g. "standard"). */
  shippingMethod: string;
  /** عنوان نمایشی روش ارسال در زمان ثبت سفارش (e.g. "پست پیشتاز"). */
  shippingMethodTitle: string;
  /** مبلغ تخفیف (toman) — promo/gift-code discount applied at checkout. */
  discountAmount: number;
  /** مبلغ مالیات بر ارزش افزوده (toman) — captured at order time. */
  vatAmount: number;
  /** بسته‌بندی هدیه و جعبه چوبی درخواست شده؟ */
  giftBox: boolean;
  /** Gift-box price captured at order time (0 when not requested). */
  giftBoxPrice: number;
};

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

/** Badge/dot styles per status — the one place status colors are defined. */
export const ORDER_STATUS_META: Record<OrderStatus, { label: string; badge: string; dot: string }> =
  {
    pending: {
      label: "در انتظار",
      badge: "border-amber-500/25 bg-amber-500/15 text-amber-400",
      dot: "bg-amber-400",
    },
    processing: {
      label: "در حال پردازش",
      badge: "border-sky-500/25 bg-sky-500/15 text-sky-400",
      dot: "bg-sky-400",
    },
    shipped: {
      label: "ارسال شده",
      badge: "border-purple-500/25 bg-purple-500/15 text-purple-400",
      dot: "bg-purple-400",
    },
    delivered: {
      label: "تحویل شده",
      badge: "border-emerald-500/25 bg-emerald-500/15 text-emerald-400",
      dot: "bg-emerald-400",
    },
    cancelled: {
      label: "لغو شده",
      badge: "border-rose-500/25 bg-rose-500/15 text-rose-400",
      dot: "bg-rose-400",
    },
  };

const DAY_MS = 86_400_000;

/** A line's amount: goods + its optional care-oil add-on. */
export const lineTotal = (item: OrderItem): number =>
  item.qty * item.unitPrice + (item.careOilAdded ? item.careOilPrice : 0);

/** Base amount of the goods incl. care-oil add-ons (before discount/gift/shipping/VAT). */
export const orderSubtotal = (o: AdminOrder): number =>
  o.items.reduce((sum, item) => sum + lineTotal(item), 0);

/** Gift-box add-on amount (0 when not requested). */
export const orderGiftBox = (o: AdminOrder): number => (o.giftBox ? o.giftBoxPrice : 0);

/**
 * Final payable amount. Prefers the API's authoritative `total_amount`
 * (what the customer actually paid); the formula fallback keeps the helper
 * usable for in-flight/optimistic records that lack it.
 */
export const orderTotal = (o: AdminOrder): number =>
  o.totalAmount > 0
    ? o.totalAmount
    : orderSubtotal(o) + orderGiftBox(o) - o.discountAmount + o.shippingCost + o.vatAmount;

/** Whole days elapsed since the order was placed (never negative). */
export const orderAgeDays = (o: AdminOrder): number =>
  Math.max(0, Math.floor((Date.now() - new Date(o.createdAt).getTime()) / DAY_MS));

/** "امروز" / "دیروز" / "۳ روز پیش" — for the age column. */
export const orderAgeLabel = (o: AdminOrder): string => {
  const days = orderAgeDays(o);
  if (days === 0) return "امروز";
  if (days === 1) return "دیروز";
  return `${toFa(days)} روز پیش`;
};

/**
 * Which purchase is this for the customer? Counts the customer's orders whose
 * sequential dbId is <= this order's dbId (bigger id = newer order).
 */
export const customerPurchaseNumber = (orders: AdminOrder[], order: AdminOrder): number =>
  orders.filter((o) => o.customer === order.customer && o.dbId <= order.dbId).length;

/** Format a Date as a zero-padded Jalali display string (۱۴۰۴/۰۶/۱۲). */
export function toJalaliString(d: Date): string {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}/${get("month").padStart(2, "۰")}/${get("day").padStart(2, "۰")}`;
}
