import { useCartSummary, useSettings } from "@/hooks/queries";
import type { ShippingMethodConfig } from "@/lib/admin-settings";

/** Free shipping threshold — mirrors the backend `FREE_SHIPPING_FROM`. */
export const FREE_SHIPPING_FROM = 5000000;

/**
 * Shipping methods are store-configurable (admin → تنظیمات → روش‌های ارسال)
 * and persisted per order. The id is a stable string, not a fixed union.
 */
export type ShippingMethod = string;

export type ShippingMethodOption = ShippingMethodConfig;

/**
 * Fee for a method at a given goods subtotal — same rule as the backend:
 * free at/above the threshold, otherwise the method's configured fee.
 */
export function shippingFee(
  method: ShippingMethod,
  subtotal: number,
  methods: ShippingMethodOption[],
): number {
  if (subtotal >= FREE_SHIPPING_FROM) return 0;
  return methods.find((m) => m.id === method)?.fee ?? methods[0]?.fee ?? 0;
}

/** Order summary for the cart/checkout sidebars (live settings + cart). */
export function useOrderSummary(method: ShippingMethod = "standard") {
  const { subtotal, savings, count } = useCartSummary();
  const { data: settings } = useSettings();
  const shipping = shippingFee(method, subtotal, settings?.shippingMethods ?? []);
  return { subtotal, savings, shipping, count, total: subtotal + shipping };
}