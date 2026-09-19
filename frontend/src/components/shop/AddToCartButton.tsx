import { useNavigate } from "@tanstack/react-router";
import { Boxes, Minus, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MAX_QTY, useCart } from "./CartContext";
import { bulkOrderSearch, toFa, type Product } from "@/lib/shop-data";
import { cn } from "@/lib/utils";

type Props = {
  product: Product;
  /** Icon-only trigger for compact product cards, full-width button elsewhere. */
  compact?: boolean;
  className?: string;
  /** Include the روغن جلا finish add-on on the cart line. */
  oil?: boolean;
  /** Phase 7 variant selections carried onto the cart line. */
  woodType?: string | null;
  color?: string | null;
};

export function AddToCartButton({ product, compact, className, oil, woodType, color }: Props) {
  const { add } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => clearTimeout(closeTimer.current ?? undefined), []);

  const show = () => {
    clearTimeout(closeTimer.current ?? undefined);
    setOpen(true);
  };

  const hide = () => {
    clearTimeout(closeTimer.current ?? undefined);
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  const step = (delta: number) => setQty((v) => Math.min(MAX_QTY, Math.max(1, v + delta)));

  const submit = () => {
    add(product.id, qty, {
      oil: Boolean(oil),
      woodType: woodType?.trim() || null,
      color: color?.trim() || null,
    });
    setQty(1);
    setOpen(false);
    // Actionable toast: jump straight to the cart page.
    toast.success("محصول به سبد خرید اضافه شد", {
      action: {
        label: "مشاهده سبد خرید",
        onClick: () => navigate({ to: "/cart" }),
      },
    });
  };

  return (
    <div
      className={cn("relative", compact ? "shrink-0" : "w-full sm:w-auto", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) hide();
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Touch devices never fire hover: the first tap reveals the panel.
          if (!open) {
            show();
            return;
          }
          submit();
        }}
        aria-label="افزودن به سبد خرید"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground transition-all duration-300 hover:shadow-glow",
          compact
            ? "size-10 rounded-lg bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
            : "w-full px-6 py-3 text-sm hover:-translate-y-0.5 sm:w-auto",
        )}
      >
        <ShoppingBag size={18} />
        {!compact && "افزودن به سبد خرید"}
      </button>

      <div
        className={cn(
          "absolute bottom-full left-0 z-40 mb-2 w-56 origin-bottom-left rounded-xl border border-primary/40 bg-popover p-3 shadow-soft transition-all duration-200",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible pointer-events-none translate-y-1 opacity-0",
        )}
        onClick={(e) => e.preventDefault()}
      >
        <p className="mb-2 text-[11px] font-semibold text-muted-foreground">تعداد سفارش</p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              step(-1);
            }}
            aria-label="کاهش تعداد"
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <Minus size={14} />
          </button>
          <input
            value={toFa(qty)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[۰-۹]/g, (d) =>
                String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
              );
              const parsed = Number(digits.replace(/\D/g, ""));
              setQty(parsed ? Math.min(MAX_QTY, parsed) : 1);
            }}
            inputMode="numeric"
            aria-label="تعداد"
            className="h-8 w-full min-w-0 rounded-lg border border-border bg-background text-center text-sm font-bold outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              step(1);
            }}
            aria-label="افزایش تعداد"
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <Plus size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mt-2 w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          افزودن به سبد
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setOpen(false);
            navigate({ to: "/contact", search: bulkOrderSearch(product) });
          }}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-secondary/70 bg-secondary/25 py-2 text-xs font-bold text-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
        >
          <Boxes size={14} /> سفارش عمده
        </button>
      </div>
    </div>
  );
}
