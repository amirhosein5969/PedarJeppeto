import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, PackageOpen, ShoppingCart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCatalog } from "@/hooks/queries";
import { finalPrice, formatPrice, toFa } from "@/lib/shop-data";
import { useCart } from "./CartContext";

/**
 * Mini-cart hover panel for the header cart button (feature: quick glance).
 *
 * Revealed by `group-hover/mini` on the wrapping element in `Header.tsx`
 * (a `group/mini relative` container around the cart button). The `pt-3`
 * gap is part of the hover bridge, so the pointer can travel from button to
 * panel without the panel collapsing. Tablet & up only — mobile taps go to
 * the full /cart page.
 */
export function MiniCart() {
  const { items, count, subtotal } = useCart();
  const { data: catalog } = useCatalog(true);
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const byId = new Map((catalog?.products ?? []).map((p) => [p.id, p]));
  const shown = items.slice(0, 4);
  const hidden = items.length - shown.length;

  // Same smart guard as the /cart page: guests route through OTP login with
  // a return intent instead of landing on a checkout they can't finish.
  const quickCheckout = () => {
    if (isLoading) return;
    if (!user) navigate({ to: "/auth", search: { returnTo: "/checkout" } });
    else navigate({ to: "/checkout" });
  };

  return (
    <div
      className={
        "invisible absolute left-0 top-full z-[200] hidden w-80 pt-3 opacity-0 " +
        "transition-opacity duration-200 group-hover/mini:visible group-hover/mini:opacity-100 sm:block"
      }
    >
      <div className="overflow-hidden rounded-2xl border border-primary/15 bg-[#1a1714]/95 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-primary/10 bg-primary/5 px-4 py-3">
          <span className="flex items-center gap-1.5 text-sm font-extrabold text-foreground">
            <ShoppingCart size={15} className="text-primary-soft" />
            سبد خرید شما
          </span>
          <span className="text-[11px] text-muted-foreground">
            {toFa(count)} {count > 1 ? "قلم کالا" : "قلم"}
          </span>
        </div>

        {shown.length === 0 ? (
          <div className="grid gap-2.5 px-4 py-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full border border-dashed border-primary/30 text-primary/50">
              <PackageOpen size={22} />
            </span>
            <p className="text-xs text-muted-foreground">سبد خرید شما خالی است.</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/shop" })}
              className="text-xs font-bold text-primary-soft transition-colors hover:text-foreground"
            >
              مشاهده‌ی محصولات
            </button>
          </div>
        ) : (
          <>
            <ul className="max-h-72 divide-y divide-primary/10 overflow-y-auto">
              {shown.map((it) => {
                const p = byId.get(it.id);
                const lineTotal = p ? finalPrice(p) * it.qty : 0;
                return (
                  <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                    {p?.images[0] ? (
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        loading="lazy"
                        className="size-12 shrink-0 rounded-xl border border-primary/10 object-cover"
                      />
                    ) : (
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary/50">
                        <ShoppingCart size={16} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-foreground">
                        {p?.name ?? "محصول"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        تعداد: {toFa(it.qty)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-primary-soft">
                      {formatPrice(lineTotal)}
                    </span>
                  </li>
                );
              })}
            </ul>

            {hidden > 0 && (
              <p className="border-t border-primary/10 px-4 py-2 text-center text-[10px] text-muted-foreground">
                و {toFa(hidden)} قلم دیگر در سبد خرید شما…
              </p>
            )}

            <div className="flex items-center justify-between border-t border-primary/10 bg-primary/5 px-4 py-3">
              <span className="text-xs text-muted-foreground">جمع کالاها</span>
              <span className="text-sm font-extrabold text-primary-soft">
                {formatPrice(subtotal)}
              </span>
            </div>

            <button
              type="button"
              onClick={quickCheckout}
              className="group/go flex w-full items-center justify-center gap-2 border-t border-primary/10 px-4 py-3 text-xs font-extrabold text-primary-soft transition-colors duration-300 hover:bg-primary/10 hover:text-foreground"
            >
              تسویه‌ی سریع
              <ArrowLeft
                size={14}
                strokeWidth={2.4}
                className="transition-transform duration-300 group-hover/go:-translate-x-1"
              />
            </button>
          </>
        )}
      </div>
    </div>
  );
}