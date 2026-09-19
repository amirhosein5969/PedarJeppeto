import { Flame } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AddToCartButton } from "./AddToCartButton";
import { finalPrice, formatPrice, type Product } from "@/lib/shop-data";
import { cn } from "@/lib/utils";

export function ProductCard({
  product,
  highlightDiscount,
  hideDiscount,
}: {
  product: Product;
  /** Accent border + "حراج کارگاه" corner badge used by the "most discounted" rail. */
  highlightDiscount?: boolean;
  /** Top-selling rail: show only the final price (no strikethrough, no badge). */
  hideDiscount?: boolean;
}) {
  const species = product.specs.find((s) => s.label.startsWith("جنس"))?.value ?? "چوب طبیعی";

  return (
    <div
      className={cn(
        "group relative flex h-full w-full flex-col rounded-xl border border-border bg-card shadow-soft transition-all duration-300 hover:z-20 hover:-translate-y-1 hover:border-primary/60 focus-within:z-20",
        highlightDiscount && "border-primary/40",
      )}
    >
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="absolute inset-0 z-0"
        aria-label={product.name}
      />

      {/* Card image: main (images[0]) with a hover crossfade to the second
          image (images[1]) — no carousel on cards; the full gallery lives on
          the product page. */}
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-t-xl bg-muted">
        {product.images[0] && (
          <img
            src={product.images[0]}
            alt={product.name}
            draggable={false}
            className="absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out"
          />
        )}
        {product.images[1] && (
          <img
            src={product.images[1]}
            alt=""
            aria-hidden
            loading="lazy"
            draggable={false}
            className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
          />
        )}
        {highlightDiscount && (
          /* Workshop sale badge — same deal-badge design as the section-title
             badge (amber gradient pill + flame), anchored to the image corner. */
          <span className="deal-badge absolute top-3 right-3 flex w-fit items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold">
            <Flame size={13} strokeWidth={2.5} />
            حراج کارگاه
          </span>
        )}
      </div>

      <div className="pointer-events-none relative flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary-soft">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-soft" />
          {species}
        </div>
        <h3 className="line-clamp-1 font-bold text-foreground">{product.name}</h3>
        <p className="line-clamp-2 text-xs leading-6 text-muted-foreground">{product.summary}</p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="min-w-0">
            {/* Top-selling rail hides the discount logic entirely: the final
                price stands alone, no crossed-out original, no badge. */}
            {!hideDiscount && (
              <div className="text-xs text-muted-foreground line-through">
                {formatPrice(product.price)}
              </div>
            )}
            <div className="truncate font-bold text-primary-soft">
              {formatPrice(finalPrice(product))}
            </div>
          </div>
          <AddToCartButton product={product} compact className="pointer-events-auto z-10" />
        </div>
      </div>
    </div>
  );
}
