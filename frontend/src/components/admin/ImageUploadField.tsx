import {
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type DragEvent,
} from "react";
import { ImageIcon, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { MAX_FILE_MB, fileToDataUrl } from "@/lib/image-upload";
import { cn } from "@/lib/utils";

/**
 * Dark, premium upload dropzone: click or drag-and-drop a file, instantly
 * preview it, and store the resulting data URL (or pasted URL) via onChange.
 */
export function ImageUploadField({
  value,
  onChange,
  emptyLabel = "بدون تصویر",
  className,
  ...rest
}: {
  value: string;
  onChange: (url: string) => void;
  emptyLabel?: string;
} & Omit<ComponentPropsWithoutRef<"div">, "onChange">) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("فقط فایل تصویری (JPG یا PNG) انتخاب کنید.");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`حجم تصویر باید کمتر از ${MAX_FILE_MB} مگابایت باشد.`);
      return;
    }
    fileToDataUrl(file)
      .then(onChange)
      .catch(() => {
        toast.error("خواندن تصویر ناموفق بود. دوباره تلاش کنید.");
      });
  };

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = ""; // allow re-picking the same file
  };

  return (
    <div className={cn("space-y-2", className)} {...rest}>
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
        onDrop={onDrop}
        className={cn(
          "relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed transition-all duration-300",
          dragOver
            ? "border-primary/70 bg-primary/5"
            : "border-white/15 bg-[#1c1916] hover:border-primary/40 hover:bg-[#201d19]",
        )}
      >
        {value ? (
          <>
            <img src={value} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 hover:opacity-100">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-foreground">
                تغییر تصویر
              </span>
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="grid size-8 cursor-pointer place-items-center rounded-full bg-rose-500/20 text-rose-400 transition-colors hover:bg-rose-500/35"
              >
                <Trash2 className="size-4" />
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
              <UploadCloud className="size-5" />
            </span>
            <p className="text-xs font-bold text-foreground/85">
              فایل را اینجا رها کنید یا کلیک کنید
            </p>
            <p className="text-[10px] leading-relaxed text-muted-foreground/70">
              JPG یا PNG — حداکثر {MAX_FILE_MB} مگابایت
            </p>
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
              <ImageIcon className="size-3" />
              {emptyLabel}
            </p>
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
        tabIndex={-1}
        aria-hidden
      />

      <Input
        dir="ltr"
        value={value.startsWith("data:") ? "" : value}
        placeholder={value.startsWith("data:") ? "فایل آپلود شده (داده محلی)" : "یا آدرس تصویر…"}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="h-9 border-white/10 bg-[#1c1916] text-start text-xs placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
      />
    </div>
  );
}
