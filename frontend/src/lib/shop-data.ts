/**
 * Storefront catalog domain (Phase 5: live API-backed).
 *
 * The product/category DATA no longer lives here — it comes from
 * `GET /api/v1/products` + `/categories` (see `src/hooks/queries.ts`). This
 * module keeps the **domain type** (`Product`) and the pure formatting
 * helpers every page renders with.
 */
// Static storefront imagery lives in `public/` and is served from the site
// root — identical in dev, SSR, and the Docker production build (no hashing
// or alias resolution involved).
const kitchenImg = "/cat-kitchen.jpg";
const giftImg = "/cat-gift.jpg";
const heroWorkshopImg = "/hero-workshop.jpg";

export type Category = {
  slug: string;
  title: string;
  short: string;
  image: string;
};

/**
 * Built-in homepage hero banners. This is the single source of truth: the
 * storefront renders it when the admin hasn't saved a custom array, and the
 * admin panel seeds its editor list from it.
 */
export type DefaultHeroSlide = {
  image: string;
  /** Tag/badge shown above the title (e.g. "کارگاه پدر ژپتو"). */
  tag: string;
  title: string;
  /** Supporting line under the title. */
  text: string;
};

export const defaultHeroSlides: DefaultHeroSlide[] = [
  {
    image: heroWorkshopImg,
    tag: "کارگاه پدر ژپتو",
    title: "چوب، دست، و کمی صبر",
    text: "هر قطعه در کارگاه ما دست‌ساز می‌شود — با چوب طبیعی گردو، بلوط و راش و پرداخت روغن خوراکی.",
  },
  {
    image: kitchenImg,
    tag: "آشپزخانه‌ی چوبی",
    title: "آشپزخانه‌ای گرم و طبیعی",
    text: "تخته سرو و ظروف چوب بلوط و گردو — با چوب طبیعی گردو، بلوط و راش و پرداخت روغن خوراکی.",
  },
  {
    image: giftImg,
    tag: "هدیه‌ی ماندگار",
    title: "هدیه‌ای که ماندگار است",
    text: "جعبه‌های کادویی و آینه‌های قاب‌چوبی — با چوب طبیعی گردو، بلوط و راش و پرداخت روغن خوراکی.",
  },
];

export type Product = {
  /** Stringified DB id (the `/product/$id` route param). */
  id: string;
  name: string;
  /** Category slug, resolved from the categories list. */
  category: string;
  /** Pre-discount shelf price in toman (from the API `list_price`). */
  price: number;
  /** Discount percentage 0–100 (derived; 0 when no list price). */
  discount: number;
  summary: string;
  specs: { label: string; value: string }[];
  /** Gallery source of truth — first entry is the primary image. */
  images: string[];
  image: string;
  /** Optional lifestyle shot cross-faded in on hover. */
  imageAlt?: string;
};

/** Final (discounted) price — exact integer mirror of the DB `base_price`. */
export const finalPrice = (p: Product) => Math.round((p.price * (100 - p.discount)) / 100);

export const bulkOrderSearch = (p: Product) => ({
  subject: "bulk",
  product: p.id,
  message: `سلام، برای سفارش عمده‌ی «${p.name}» درخواست دارم. لطفاً قیمت همکاری، حداقل تعداد و زمان تحویل را اعلام کنید.`,
});

const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export const toFa = (value: number | string) =>
  String(value).replace(/\d/g, (d) => faDigits[Number(d)] ?? d);

export const formatPrice = (value: number) => toFa(value.toLocaleString("en-US")) + " تومان";

/**
 * Human-readable variant summary for a cart/order line (Phase 7). Joins the
 * chosen wood, the product color, and the care-oil flag, pipe-separated, e.g.
 * "چوب گردو | تیره | همراه با روغن محافظ". Returns "" when nothing is set.
 */
export function variantLabel(opts: {
  wood?: string | null;
  color?: string | null;
  oil?: boolean;
}): string {
  const wood = opts.wood?.trim();
  // A free-text note may already read "چوب …"; only prefix the short type name.
  const woodPart = wood ? (/^چوب\s/.test(wood) ? wood : `چوب ${wood}`) : "";
  const color = opts.color?.trim() ?? "";
  const oilPart = opts.oil ? "همراه با روغن محافظ" : "";
  return [woodPart, color, oilPart].filter(Boolean).join(" | ");
}