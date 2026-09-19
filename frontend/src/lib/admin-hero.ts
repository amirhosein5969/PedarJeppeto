/**
 * Admin-side homepage hero slider (mock persistence).
 * The storefront homepage renders this reorderable banner array verbatim;
 * when no saved array exists it falls back to the built-in default slides.
 */

import { defaultHeroSlides } from "@/lib/shop-data";

export type HeroSlide = {
  id: string;
  /** Tag/badge shown above the title (e.g. "کارگاه چوب‌کار"). */
  tag: string;
  title: string;
  /** Supporting line under the title. */
  subtitle: string;
  /** Data URL or absolute URL; "" falls back to the default hero image. */
  image: string;
};

const STORAGE_KEY = "hc-admin-hero-slides";

export function newHeroSlideId(): string {
  return `hs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The built-in homepage banners as editable admin rows. */
export function defaultHeroSlidesAsAdmin(): HeroSlide[] {
  return defaultHeroSlides.map((s, i) => ({
    id: `default-${i}`,
    tag: s.tag,
    title: s.title,
    subtitle: s.text,
    image: s.image,
  }));
}

export function loadAdminHeroSlides(): HeroSlide[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map((s) => ({
        id: typeof s["id"] === "string" ? s["id"] : newHeroSlideId(),
        tag: typeof s["tag"] === "string" ? s["tag"] : "",
        title: typeof s["title"] === "string" ? s["title"] : "",
        subtitle: typeof s["subtitle"] === "string" ? s["subtitle"] : "",
        image: typeof s["image"] === "string" ? s["image"] : "",
      }));
  } catch {
    return [];
  }
}

export function saveAdminHeroSlides(slides: HeroSlide[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slides));
  } catch {
    // Storage failures are acceptable during the mock phase.
  }
}

export function clearAdminHeroSlides(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore private-mode failures.
  }
}
