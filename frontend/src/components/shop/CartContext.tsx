import { createContext, useContext, useMemo, type ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import { toast } from "sonner";
import {
  useAddToCart,
  useCartSummary,
  useClearCart,
  useRemoveFromCart,
  useUpdateCartLine,
  useCatalog,
} from "@/hooks/queries";
import { toFa } from "@/lib/shop-data";

/**
 * Cart state (Phase 5: live API-backed).
 *
 * Backed by TanStack Query (`useCartSummary`) instead of in-memory
 * useState — the cart now survives refreshes (Redis, 14-day TTL) and every
 * mutation is optimistic, so the UI still reacts instantly. The public
 * interface is unchanged, so `AddToCartButton`, `Header`, the cart page and
 * checkout keep working as-is.
 */

export type CartItem = {
  id: string;
  qty: number;
  oil: boolean;
  /** Phase 7 variant selections ("" when the customer picked none). */
  woodType: string;
  color: string;
};

export const MAX_QTY = 20;

export type AddOptions = {
  oil?: boolean;
  woodType?: string | null;
  color?: string | null;
};

type CartValue = {
  items: CartItem[];
  count: number;
  /** Goods subtotal incl. per-line oil-finish add-ons (toman). */
  subtotal: number;
  savings: number;
  /** روغن جلا با قابلیت پرداخت — global config from live store settings. */
  oilEnabled: boolean;
  oilPrice: number;
  add: (id: string, qty?: number, opts?: AddOptions) => void;
  setQty: (id: string, qty: number) => void;
  setOil: (id: string, oil: boolean) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);

const clampQty = (qty: number) => Math.min(MAX_QTY, Math.max(1, Math.round(qty)));

export function CartProvider({ children }: { children: ReactNode }) {
  const { items: lines, count, subtotal, savings, oilEnabled, oilPrice } = useCartSummary();
  const { data: catalog } = useCatalog(true);
  const addMut = useAddToCart();
  const removeMut = useRemoveFromCart();
  const updateMut = useUpdateCartLine();
  const clearMut = useClearCart();

  const items: CartItem[] = useMemo(
    () =>
      lines.map((l) => ({
        id: String(l.product_id),
        qty: l.quantity,
        oil: l.care_oil_added,
        woodType: l.wood_type ?? "",
        color: l.color ?? "",
      })),
    [lines],
  );

  const value = useMemo<CartValue>(() => {
    return {
      items,
      count,
      subtotal,
      savings,
      oilEnabled,
      oilPrice,
      add: (id, qty = 1, opts) => {
        const amount = clampQty(qty);
        const oil = opts?.oil ?? false;
        const product = catalog?.products.find((p) => p.id === id);
        // Optimistic feedback: the cache already updated in onMutate.
        toast.success(`${product?.name ?? "محصول"} به سبد خرید اضافه شد`, {
          description: `${toFa(amount)} عدد${oil ? " — با روغن جلا" : ""}`,
          duration: 1600,
          icon: <CircleCheck size={18} className="text-primary-soft" />,
        });
        addMut.mutate({
          productId: Number(id),
          quantity: amount,
          oil,
          woodType: opts?.woodType ?? null,
          color: opts?.color ?? null,
        });
      },
      setQty: (id, qty) => {
        const line = lines.find((l) => l.product_id === Number(id));
        if (!line) return;
        updateMut.mutate({
          productId: Number(id),
          quantity: clampQty(qty),
          oil: line.care_oil_added,
          woodType: line.wood_type,
          color: line.color,
        });
      },
      setOil: (id, oil) => {
        const line = lines.find((l) => l.product_id === Number(id));
        if (!line) return;
        updateMut.mutate({
          productId: Number(id),
          quantity: line.quantity,
          oil,
          woodType: line.wood_type,
          color: line.color,
        });
      },
      remove: (id) => {
        removeMut.mutate(Number(id));
      },
      clear: () => {
        clearMut.mutate();
      },
    };
  }, [items, count, subtotal, savings, oilEnabled, oilPrice, catalog, lines, addMut, removeMut, updateMut, clearMut]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}