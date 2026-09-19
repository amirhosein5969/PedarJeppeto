/**
 * Admin-side promotion helpers (Phase 5: live API-backed).
 *
 * The promo list itself now lives in the backend — fetched via `usePromos`
 * (TanStack Query) from `GET /api/v1/promotions`, created/updated/deleted
 * through `useSavePromo` / `useDeletePromo`. The `PromoCode` type moved to
 * `api-map.ts` alongside the wire mappers; this module keeps only the pure
 * discount math used for the admin's live preview chip.
 */

import type { PromoCode } from "@/lib/api-map";

/** Below the code's minimum purchase? (minPurchaseAmount of 0 = no minimum.) */
export const promoBelowMinimum = (p: PromoCode, subtotal: number): boolean =>
  p.minPurchaseAmount > 0 && subtotal < p.minPurchaseAmount;

/** Usage ceiling reached? (usageLimit of 0 means unlimited.) */
export const promoIsExhausted = (p: PromoCode): boolean =>
  p.usageLimit > 0 && p.timesUsed >= p.usageLimit;

/** Discount for a subtotal, capped at maxDiscountAmount (0 = uncapped). */
export const promoDiscount = (p: PromoCode, subtotal: number): number => {
  const raw = Math.round((subtotal * p.discountPercentage) / 100);
  return p.maxDiscountAmount > 0 ? Math.min(raw, p.maxDiscountAmount) : raw;
};