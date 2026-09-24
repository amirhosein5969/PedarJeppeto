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
          <span className="deal-badge absolute top-2 right-2 flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold md:top-3 md:right-3 md:px-3 md:py-1 md:text-[11px]">
            <Flame className="size-3 md:size-[13px]" strokeWidth={2.5} />
            حراج کارگاه
          </span>
        )}
      </div>

      <div className="pointer-events-none relative flex flex-1 flex-col gap-1 p-2.5 md:gap-2 md:p-4">
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-primary-soft md:text-xs">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-soft" />
          <span className="truncate">{species}</span>
        </div>
        <h3 className="line-clamp-1 text-[13px] leading-6 font-bold text-foreground md:text-base">
          {product.name}
        </h3>
        <p className="line-clamp-1 text-[11px] leading-5 text-muted-foreground md:line-clamp-2 md:text-xs md:leading-6">
          {product.summary}
        </p>

        <div className="mt-auto flex items-end justify-between gap-1.5 pt-2 md:gap-2 md:pt-3">
          <div className="min-w-0">
            {/* Top-selling rail hides the discount logic entirely: the final
                price stands alone, no crossed-out original, no badge. */}
            {!hideDiscount && (
              <div className="text-[10px] text-muted-foreground line-through md:text-xs">
                {formatPrice(product.price)}
              </div>
            )}
            <div className="truncate text-[13px] font-bold text-primary-soft md:text-base">
              {formatPrice(finalPrice(product))}
            </div>
          </div>
          <AddToCartButton product={product} compact className="pointer-events-auto z-10" />
        </div>
      </div>
    </div>
  );
}
