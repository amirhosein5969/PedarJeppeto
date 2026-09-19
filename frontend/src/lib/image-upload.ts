import { toast } from "sonner";

import { toFa } from "@/lib/shop-data";

export const MAX_FILE_MB = 5;

/**
 * Read an image file to a data URL, downscaled through a canvas so the
 * resulting base64 string stays small enough for the mock localStorage
 * persistence layer.
 */
export async function fileToDataUrl(file: File, maxSize = 1200, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result));
    };
    reader.onerror = () => {
      reject(new Error("read-failed"));
    };
    reader.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => {
        resolve(el);
      };
      el.onerror = () => {
        reject(new Error("decode-failed"));
      };
      el.src = dataUrl;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width || maxSize, img.height || maxSize));
    if (scale === 1 && dataUrl.length < 700_000) return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#ffffff"; // flatten transparency before JPEG encoding
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    // If decoding fails, keep the untouched data URL.
    return dataUrl;
  }
}

/** Shared validation + batch read for the upload fields. */
export function readImageFiles(files: FileList | null, onDone: (urls: string[]) => void): void {
  if (!files || files.length === 0) return;
  const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
  const rejected = files.length - list.length;
  if (rejected > 0) toast.error(`${toFa(rejected)} فایل غیرتصویری نادیده گرفته شد.`);
  const valid = list.filter((f) => {
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`«${f.name}» بیشتر از ${MAX_FILE_MB} مگابایت است.`);
      return false;
    }
    return true;
  });
  Promise.all(valid.map((f) => fileToDataUrl(f)))
    .then(onDone)
    .catch(() => {
      toast.error("خواندن تصویر ناموفق بود. دوباره تلاش کنید.");
    });
}
