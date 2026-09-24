import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Droplet,
  LogIn,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { SectionHeader } from "@/components/shop/SectionHeader";
import { useCart } from "@/components/shop/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useCatalog, useCartSummary } from "@/hooks/queries";
import { FREE_SHIPPING_FROM, useOrderSummary } from "@/lib/checkout";
import { finalPrice, formatPrice, toFa, variantLabel } from "@/lib/shop-data";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "سبد خرید | پدر ژپتو" },
      { name: "description", content: "مرور محصولات چوبی انتخاب‌شده و مبلغ قابل پرداخت." },
      { property: "og:title", content: "سبد خرید | پدر ژپتو" },
      { property: "og:description", content: "محصولات انتخابی شما در فروشگاه پدر ژپتو." },
    ],
  }),
  component: Cart,
});

function Cart() {
  const { items, setQty, setOil, remove, clear, oilEnabled, oilPrice } = useCart();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const summary = useOrderSummary();
  const { isPending: cartPending } = useCartSummary();
  const { data: catalog } = useCatalog(true);
  const rows = items.flatMap((i) => {
    const product = catalog?.products.find((p) => p.id === i.id);
    return product
      ? [{ product, qty: i.qty, oil: i.oil, woodType: i.woodType, color: i.color }]
      : [];
  });
  const lineOil = (oil: boolean) => (oilEnabled && oil ? oilPrice : 0);

  // Smart checkout guard: guests are routed through the OTP login with a
  // return intent so the purchase is never interrupted.
  const proceedToCheckout = () => {
    if (isLoading) return; // wait for the stored session to hydrate
    if (!user) {
      navigate({ to: "/auth", search: { returnTo: "/checkout" } });
      return;
    }
    navigate({ to: "/checkout" });
  };

  if (cartPending) {
    return (
      <div className="grid min-h-72 place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <SectionHeader as="h1" title="سبد خرید" />
        <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-3xl border border-white/5 bg-[#1a1714] p-6 text-center sm:mt-10 sm:min-h-96 sm:p-10">
          <span className="grid size-16 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary-soft sm:size-20">
            <ShoppingBag className="size-[26px] sm:size-8" strokeWidth={1.5} />
          </span>
          <p className="mt-6 text-base font-bold text-foreground sm:text-lg">
            سبد خرید شما در حال حاضر خالی است
          </p>
          <p className="mt-2 max-w-sm text-sm leading-7 text-muted-foreground">
            هنوز چیزی انتخاب نکرده‌اید؛ نگاهی به محصولات دست‌ساز کارگاه بیندازید.
          </p>
          <Link
            to="/shop"
            className="mt-7 inline-flex items-center gap-2 rounded-xl border border-primary/50 px-5 py-2.5 text-sm font-bold text-primary-soft transition-colors duration-300 hover:bg-primary hover:text-primary-foreground sm:px-6 sm:py-3"
          >
            بازگشت به کارگاه <ArrowLeft size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader as="h1" title="سبد خرید" />
        <button
          onClick={clear}
          className="text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
        >
          خالی کردن سبد
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3 md:space-y-4">
          {rows.map(({ product, qty, oil, woodType, color }) => {
            const label = variantLabel({ wood: woodType, color, oil: oil && oilEnabled });
            return (
              <div
                key={product.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 md:flex-nowrap md:gap-4 md:p-4"
              >
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  className="size-16 shrink-0 rounded-lg object-cover md:size-20 md:rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/product/$id"
                    params={{ id: product.id }}
                    className="line-clamp-1 text-sm font-bold transition-colors hover:text-primary-soft md:text-base"
                  >
                    {product.name}
                  </Link>
                  {label && (
                    <p className="mt-0.5 text-[10px] font-medium text-primary-soft/80 md:mt-1 md:text-[11px]">
                      {label}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted-foreground md:mt-1 md:text-xs">
                    {formatPrice(finalPrice(product))} برای هر عدد
                  </p>
                  {oilEnabled && (
                    <button
                      type="button"
                      aria-pressed={oil}
                      onClick={() => {
                        setOil(product.id, !oil);
                      }}
                      className={cn(
                        "mt-1.5 flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors duration-300 md:mt-2 md:gap-1.5 md:px-2.5 md:py-1 md:text-[11px]",
                        oil
                          ? "border-primary/50 bg-primary/10 text-primary-soft"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      <Droplet size={11} strokeWidth={2} />
                      روغن جلا با قابلیت پرداخت (+ {formatPrice(oilPrice)})
                    </button>
                  )}
                </div>

                {/* Controls: a full-width strip under the body on phones
                  (stepper / line price / trash spread edge-to-edge), a plain
                  inline cluster from md up. */}
                <div className="flex w-full shrink-0 items-center justify-between gap-2 border-t border-border/60 pt-2.5 md:w-auto md:justify-start md:gap-4 md:border-t-0 md:pt-0">
                  <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 md:gap-1 md:rounded-xl md:p-1">
                    <button
                      onClick={() => setQty(product.id, qty + 1)}
                      aria-label="افزایش تعداد"
                      className="grid size-7 place-items-center rounded-md text-primary transition-colors hover:bg-primary hover:text-primary-foreground md:size-8 md:rounded-lg"
                    >
                      <Plus size={13} />
                    </button>
                    <span className="w-7 text-center text-xs font-bold md:w-8 md:text-sm">
                      {toFa(qty)}
                    </span>
                    <button
                      onClick={() => (qty === 1 ? remove(product.id) : setQty(product.id, qty - 1))}
                      aria-label="کاهش تعداد"
                      className="grid size-7 place-items-center rounded-md text-primary transition-colors hover:bg-primary hover:text-primary-foreground md:size-8 md:rounded-lg"
                    >
                      <Minus size={13} />
                    </button>
                  </div>

                  <span className="shrink-0 text-sm font-bold text-primary-soft">
                    {formatPrice(finalPrice(product) * qty + lineOil(oil))}
                  </span>

                  <button
                    onClick={() => remove(product.id)}
                    aria-label="حذف از سبد"
                    className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive md:size-9"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-3 rounded-2xl border border-secondary/60 bg-secondary/20 p-4 text-xs leading-6 text-foreground/90">
            <Truck size={18} className="shrink-0 text-primary" />
            {summary.shipping === 0
              ? "ارسال این سفارش رایگان است."
              : `با ${formatPrice(FREE_SHIPPING_FROM - summary.subtotal)} خرید بیشتر، ارسال رایگان می‌شود.`}
          </div>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-primary/40 bg-card p-4 lg:sticky lg:top-28 lg:p-5">
          <h2 className="font-bold">خلاصه سفارش</h2>
          <SummaryRow label="جمع کالاها" value={formatPrice(summary.subtotal)} />
          <SummaryRow label="تخفیف محصولات" value={`− ${formatPrice(summary.savings)}`} accent />
          <SummaryRow
            label="هزینه ارسال"
            value={summary.shipping === 0 ? "رایگان" : formatPrice(summary.shipping)}
          />
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-sm">مبلغ قابل پرداخت</span>
            <span className="text-lg font-extrabold text-primary-soft">
              {formatPrice(summary.total)}
            </span>
          </div>

          {/* High-converting CTA: rich gold gradient + continuous shimmer
              sweep + generous padding; the arrow nudges left on hover to
              pull the shopper forward. */}
          <button
            type="button"
            onClick={proceedToCheckout}
            disabled={isLoading}
            className="group/cta relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-linear-to-l from-[#a87b16] via-[#d4af37] to-[#ecd28a] px-6 py-4 text-base font-extrabold text-[#241b0f] shadow-[0_14px_30px_-10px_rgba(212,175,55,0.45)] transition-all duration-300 hover:shadow-[0_18px_42px_-10px_rgba(212,175,55,0.65)] hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 checkout-shimmer"
            />
            <span className="relative">ادامه فرایند خرید</span>
            <ArrowLeft
              size={20}
              strokeWidth={2.6}
              className="relative transition-transform duration-300 group-hover/cta:-translate-x-1.5"
            />
          </button>

          {!isLoading && !user && (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <LogIn size={13} className="text-primary" />
              برای ادامه، ابتدا با شماره موبایل وارد شوید.
            </p>
          )}

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck size={14} className="text-primary" /> پرداخت امن از طریق درگاه بانکی
          </p>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "font-semibold text-primary-soft" : "font-semibold"}>{value}</span>
    </div>
  );
}
