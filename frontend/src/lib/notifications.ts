/**
 * Notification feed types for the header bell.
 *
 * The dummy feed is GONE — the popover now fetches the real (currently
 * empty) feed from `GET /notifications` (see `useNotifications` in
 * `hooks/queries.ts`) and renders "هیچ اعلانی ندارید" when there is
 * nothing. This module only owns the shared view-model types.
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
