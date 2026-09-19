import { useRef, useState } from "react";
import { Eye, ImagePlus, Star, Trash2 } from "lucide-react";

import { readImageFiles } from "@/lib/image-upload";
import { toFa } from "@/lib/shop-data";
import { cn } from "@/lib/utils";

/**
 * Arbitrary-length product gallery editor: click or drop one/multiple files,
 * promote any image to primary (first position) or hover (second position),
 * or delete any image. The storefront product card shows the first image and
 * crossfades to the second one on hover, so the first two tiles are flagged
 * "اصلی" and "هاور".
 */
export function MultiImageUploadField({
  images,
  onChange,
  className,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className={cn("space-y-3", className)}>
      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {images.map((src, i) => (
            <li
              key={`${src.slice(-24)}-${i}`}
              className={cn(
                "group/img relative aspect-square overflow-hidden rounded-xl border bg-[#1c1916]",
                i === 0 ? "border-primary/60" : "border-white/10",
              )}
            >
              <img src={src} alt={`تصویر ${toFa(i + 1)}`} className="size-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1.5 right-1.5 rounded-full bg-primary px-2 py-0.5 text-[9px] font-extrabold text-primary-foreground">
                  اصلی
                </span>
              )}
              {i === 1 && (
                <span className="absolute top-1.5 left-1.5 rounded-full bg-sky-500/90 px-2 py-0.5 text-[9px] font-extrabold text-white">
                  هاور
                </span>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-0 transition-opacity duration-300 focus-within:opacity-100 group-hover/img:opacity-100">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange([src, ...images.filter((_, j) => j !== i)]);
                    }}
                    aria-label="انتخاب به عنوان تصویر اصلی"
                    className="grid size-7 place-items-center rounded-lg bg-black/65 text-primary-soft backdrop-blur-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    <Star className="size-3.5" />
                  </button>
                )}
                {i > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const first = images[0] ?? "";
                      onChange([first, src, ...images.filter((_, j) => j !== 0 && j !== i)]);
                    }}
                    aria-label="انتخاب به عنوان تصویر هاور"
                    className="grid size-7 place-items-center rounded-lg bg-black/65 text-sky-300 backdrop-blur-sm transition-colors hover:bg-sky-500 hover:text-white"
                  >
                    <Eye className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onChange(images.filter((_, j) => j !== i));
                  }}
                  aria-label={`حذف تصویر ${toFa(i + 1)}`}
                  className="ms-auto grid size-7 place-items-center rounded-lg bg-black/65 text-rose-400 backdrop-blur-sm transition-colors hover:bg-rose-500 hover:text-white"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => {
          inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => {
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          readImageFiles(e.dataTransfer.files, (urls) => {
            if (urls.length > 0) onChange([...images, ...urls]);
          });
        }}
        className={cn(
          "flex h-24 w-full items-center justify-center gap-2 rounded-xl border border-dashed transition-all duration-300",
          dragOver
            ? "border-primary/70 bg-primary/5"
            : "border-white/15 bg-[#1c1916] hover:border-primary/40 hover:bg-[#201d19]",
        )}
      >
        <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
          <ImagePlus className="size-4" />
        </span>
        <span className="text-start">
          <span className="block text-xs font-bold text-foreground/85">
            افزودن تصویر {images.length > 0 ? "(یک یا چند فایل)" : ""}
          </span>
          <span className="block text-[10px] text-muted-foreground/70">
            کلیک یا رها کردن فایل — JPG یا PNG، حداکثر ۵ مگابایت هر فایل
          </span>
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          readImageFiles(e.target.files, (urls) => {
            if (urls.length > 0) onChange([...images, ...urls]);
          });
          e.target.value = "";
        }}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
