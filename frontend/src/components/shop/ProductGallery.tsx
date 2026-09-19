import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { toFa } from "@/lib/shop-data";
import { cn } from "@/lib/utils";

/**
 * Thumbnail gallery / image slider shared by the product card and the product
 * page. Inside the product card the container is pointer-events-none (the
 * whole card is a link) while the controls re-enable pointer events so the
 * customer can browse every image without leaving the card.
 */
export function ProductGallery({
  images,
  alt,
  className,
  badge,
  thumbSize = "md",
  eager,
}: {
  images: string[];
  alt: string;
  className?: string;
  /** Floating content pinned to the top-left of the frame (e.g. discount badge). */
  badge?: ReactNode;
  thumbSize?: "sm" | "md";
  /** Load the first image without lazy loading (product page hero image). */
  eager?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const count = images.length;
  const current = Math.min(index, count - 1);
  const step = (delta: number) => setIndex((current + delta + count) % count);

  if (count === 0) return <div className={cn("bg-muted", className)} />;

  return (
    <div
      className={cn(
        "group/gallery relative isolate pointer-events-none overflow-hidden",
        className,
      )}
    >
      {images.map((src, i) => (
        <img
          key={`${src}-${i}`}
          src={src}
          alt={i === current ? alt : ""}
          aria-hidden={i !== current}
          loading={eager && i === 0 ? "eager" : "lazy"}
          draggable={false}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out",
            i === current ? "opacity-100" : "opacity-0",
          )}
        />
      ))}

      {badge && <span className="pointer-events-none absolute inset-x-0 top-0 z-10">{badge}</span>}

      {count > 1 && (
        <>
          <GalleryArrow side="start" label="تصویر قبلی" onClick={() => step(-1)} />
          <GalleryArrow side="end" label="تصویر بعدی" onClick={() => step(1)} />
          <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center">
            <div className="flex items-center gap-1.5 rounded-full bg-black/55 p-1.5 backdrop-blur-sm">
              {images.map((src, i) => (
                <button
                  key={`${src}-thumb-${i}`}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`تصویر ${toFa(i + 1)} از ${toFa(count)}`}
                  aria-current={i === current}
                  className={cn(
                    "pointer-events-auto overflow-hidden rounded-md border transition-all duration-300",
                    thumbSize === "sm" ? "size-6" : "size-9",
                    i === current
                      ? "border-primary opacity-100"
                      : "border-white/20 opacity-60 hover:opacity-100",
                  )}
                >
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="size-full object-cover"
                  />
                </button>
              ))}
              <span className="px-1.5 text-[10px] font-bold text-white/80" dir="ltr">
                {toFa(current + 1)}/{toFa(count)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GalleryArrow({
  side,
  label,
  onClick,
}: {
  side: "start" | "end";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "pointer-events-auto absolute top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-all duration-300 hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100 group-hover/gallery:opacity-100",
        side === "start" ? "right-2" : "left-2",
      )}
    >
      {side === "start" ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
    </button>
  );
}
