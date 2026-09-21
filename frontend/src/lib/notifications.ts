/**
 * Notification feed for the header bell (UI-first phase).
 *
 * The backend push/notifications endpoint isn't wired up yet, so the bell
 * renders a realistic dummy feed. When the API lands, only this module
 * changes — the popover already consumes `AppNotification[]` and manages
 * read/unread state locally.
 */

export type NotificationKind = "order" | "promo" | "stock" | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Persian relative/absolute time, e.g. "۲ ساعت پیش". */
  time: string;
  read: boolean;
  /** Optional in-app destination the row navigates to when opened. */
  to?: string;
}

export const DUMMY_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n-order-1042",
    kind: "order",
    title: "سفارش شما با موفقیت ثبت شد",
    body: "سفارش #ORD-1042 در حال پردازش است و به‌زودی آماده ارسال خواهد شد.",
    time: "۲ ساعت پیش",
    read: false,
    to: "/profile/orders",
  },
  {
    id: "n-stock-1",
    kind: "stock",
    title: "محصول مورد علاقه‌ی شما موجود شد",
    body: "تخته سرو گرد بلوط (۴۵ سانتی‌متر) دوباره در انبار کارگاه است.",
    time: "دیروز، ۲۱:۱۵",
    read: false,
    to: "/shop",
  },
  {
    id: "n-promo-1",
    kind: "promo",
    title: "تخفیف ویژه‌ی پایان فصل",
    body: "تا ۲۵٪ تخفیف روی کل محصولات دست‌ساز — فقط تا پایان هفته.",
    time: "۲ روز پیش",
    read: true,
    to: "/shop",
  },
];