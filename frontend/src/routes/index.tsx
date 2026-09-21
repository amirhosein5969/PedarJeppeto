import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/shop/ProductCard";
import { SectionHeader } from "@/components/shop/SectionHeader";
import { TrustBar } from "@/components/shop/TrustBar";
import { useCatalog } from "@/hooks/queries";
import { loadAdminHeroSlides, type HeroSlide } from "@/lib/admin-hero";
import { defaultHeroSlides, type Product } from "@/lib/shop-data";
// Static imagery is served from `public/` at the site root.
const heroImg = "/hero-workshop.jpg";
const about1 = "/about-1.jpg";
const about2 = "/about-2.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "پدر ژپتو | فروشگاه محصولات چوبی دست‌ساز" },
      {
        name: "description",
        content:
          "خرید محصولات چوبی دست‌ساز؛ ظروف آشپزخانه، دکوری و اداری، لوازم جانبی دیجیتال و کادویی چوبی با چوب طبیعی گردو، بلوط و راش.",
      },
      { property: "og:title", content: "پدر ژپتو | فروشگاه محصولات چوبی دست‌ساز" },
      {
        property: "og:description",
        content: "محصولات چوبی دست‌ساز با چوب طبیعی، ساخته‌شده در کارگاه ما.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const [active, setActive] = useState(0);
  // Live catalog (10-minute cache — the home page never spams the backend).
  const { data: catalog, isPending } = useCatalog(true);
  const categories = catalog?.categories ?? [];
  const bestSellers = catalog?.products ?? [];
  const mostDiscounted = [...(catalog?.products ?? [])].sort(
    (a, b) => b.discount - a.discount,
  );
  // Admin-managed hero slider (mock, localStorage): when a custom array is
  // saved it fully replaces the built-in slides, in the exact admin order.
  const [adminSlides, setAdminSlides] = useState<HeroSlide[] | null>(null);

  useEffect(() => {
    setAdminSlides(loadAdminHeroSlides());
  }, []);

  const heroSlides = useMemo(() => {
    if (adminSlides && adminSlides.length > 0) {
      return adminSlides.map((s) => ({
        id: s.id,
        image: s.image || heroImg,
        tag: s.tag.trim(),
        title: s.title.trim(),
        text: s.subtitle.trim(),
      }));
    }
    return defaultHeroSlides.map((s) => ({
      id: s.image,
      image: s.image,
      tag: s.tag,
      title: s.title,
      text: s.text,
    }));
  }, [adminSlides]);

  useEffect(() => {
    const t = setInterval(() => setActive((v) => (v + 1) % heroSlides.length), 5000);
    return () => clearInterval(t);
  }, [heroSlides.length]);

  return (
    <div>
      {/* Hero — mirrors the admin-managed banner array (or the built-in
          defaults when the admin hasn't saved a custom one). */}
      <section className="relative h-[62vh] min-h-96 w-full overflow-hidden">
        {heroSlides.map((s, i) => (
          <img
            key={s.id}
            src={s.image}
            alt={s.title}
            width={1600}
            height={900}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              i === active % heroSlides.length ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-linear-to-l from-background via-background/70 to-background/30" />
        <div className="relative mx-auto flex h-full w-full max-w-7xl flex-col justify-center gap-5 px-4">
          {heroSlides[active % heroSlides.length]?.tag && (
            <span className="w-fit rounded-full border border-primary/50 bg-background/50 px-4 py-1.5 text-xs text-primary-soft">
              {heroSlides[active % heroSlides.length]?.tag}
            </span>
          )}
          <h1 className="max-w-xl text-4xl leading-tight font-extrabold text-foreground sm:text-5xl">
            {heroSlides[active % heroSlides.length]?.title}
          </h1>
          <p className="max-w-md text-sm leading-8 text-muted-foreground sm:text-base">
            {heroSlides[active % heroSlides.length]?.text}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform duration-300 hover:-translate-y-0.5"
            >
              مشاهده محصولات <ArrowLeft size={17} />
            </Link>
            <Link
              to="/about"
              className="rounded-xl border border-primary/50 px-6 py-3 text-sm font-bold text-primary-soft transition-colors duration-300 hover:bg-primary hover:text-primary-foreground"
            >
              داستان کارگاه
            </Link>
          </div>
          <div className="flex gap-2">
            {heroSlides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                aria-label={`اسلاید ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === active % heroSlides.length ? "w-8 bg-primary" : "w-3 bg-border"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16">
        <SectionHeader title="دسته‌بندی محصولات" subtitle="از آشپزخانه تا میز کار" />
        {isPending ? (
          <div className="mt-8 grid min-h-48 animate-pulse place-items-center rounded-2xl border border-border text-xs text-muted-foreground">
            در حال بارگذاری دسته‌بندی‌ها…
          </div>
        ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.slug}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="group relative h-72 overflow-hidden rounded-2xl border border-border shadow-soft transition-colors duration-300 hover:border-primary/70"
            >
              <img
                src={c.image}
                alt={c.title}
                loading="lazy"
                width={900}
                height={1100}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 space-y-3 p-5">
                <h3 className="text-base leading-7 font-bold">{c.title}</h3>
                <span className="inline-block rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
                  مشاهده محصولات
                </span>
              </div>
            </Link>
          ))}
        </div>
        )}
      </section>

      {/* Best sellers carousel — no discount display, final price only */}
      {isPending ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-16">
          <div className="min-h-72 animate-pulse rounded-2xl border border-border" />
        </div>
      ) : (
      <ProductRail
        title="پرفروش‌ترین محصولات"
        subtitle="انتخاب مشتریان پدر ژپتو"
        items={bestSellers}
        hideDiscount
      />
      )}

      {/* Most discounted carousel — same layout as best sellers */}
      {isPending ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-16">
          <div className="min-h-72 animate-pulse rounded-2xl border border-border" />
        </div>
      ) : (
      <ProductRail
        title="پرتخفیف‌ترین محصولات"
        subtitle="بیشترین تخفیف‌های این هفته"
        items={mostDiscounted}
        highlightDiscount
        badge="حراج کارگاه"
      />
      )}

      {/* About */}
      <section className="grain-panel border-y border-border">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pt-16 pb-10 lg:grid-cols-2">
          <div className="relative h-96 sm:h-[28rem]">
            <img
              src={about1}
              alt="کارگاه چوب‌کاری"
              loading="lazy"
              width={1000}
              height={1200}
              className="absolute top-0 right-0 h-full w-4/5 rounded-2xl object-cover shadow-soft"
            />
            <img
              src={about2}
              alt="محصولات چوبی آماده"
              loading="lazy"
              width={800}
              height={800}
              className="absolute bottom-0 left-0 h-48 w-1/2 rounded-2xl border-4 border-background object-cover shadow-soft sm:h-56"
            />
          </div>
          <div className="space-y-5">
            <SectionHeader title="درباره‌ی پدر ژپتو" subtitle="ساخته‌شده با دست، نه با ماشین" />
            <div className="space-y-4 text-sm leading-8 text-muted-foreground">
              <p>
                ما یک کارگاه کوچک خانوادگی هستیم که از سال ۱۳۹۲، با یک اره‌ی دستی و چند تخته‌ی چوب
                گردو آغاز شد. آن روزها هیچ نقشه‌ی بزرگی نبود؛ فقط یک باور ساده که وسایلی با دست
                ساخته می‌شوند، روح دارند. هنوز هم همین باور، هر تصمیم کارگاه را هدایت می‌کند.
              </p>
              <p>
                الواری که وارد کارگاه می‌شود، ابتدا هفته‌ها در سایه آرام خشک می‌شود تا تابش و رطوبتش
                از بین برود؛ بعد یکی‌یکی زیر چشم ما می‌گذرد: رگه‌اش، رنگش، بوی چوبش. وقتی الوار درست
                پیدا شد، تازه قصه‌ی هر قطعه شروع می‌شود؛ تراش و فرم‌دهی، سنباده‌ی مویی و در نهایت
                روغن خوراکی که چوب را از داخل تغذیه می‌کند.
              </p>
              <p>
                به همین دلیل هیچ دو قطعه‌ای از کارگاه ما شبیه هم نیستند و هر خط و نشان روی چوب،
                امضای دستی ماست. ما وسایلی می‌سازیم که سال‌ها کنارتان بمانند و با گذر زمان، زیباتر و
                گرمتراز روز اول شوند.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                to="/contact"
                className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform duration-300 hover:-translate-y-0.5"
              >
                تماس با ما
              </Link>
              <Link
                to="/shop"
                className="rounded-xl border border-primary/50 px-6 py-3 text-sm font-bold text-primary-soft transition-colors duration-300 hover:bg-primary hover:text-primary-foreground"
              >
                مشاهده محصولات
              </Link>
            </div>
          </div>
        </div>

        {/* Trust & value props — integrated into the About section */}
        <TrustBar />
      </section>
    </div>
  );
}

function ProductRail({
  title,
  subtitle,
  items,
  highlightDiscount,
  hideDiscount,
  badge,
}: {
  title: string;
  subtitle: string;
  items: Product[];
  highlightDiscount?: boolean;
  hideDiscount?: boolean;
  badge?: string;
}) {
  const marqueeItems = [...items, ...items];
  const firstItemRef = useRef<HTMLDivElement | null>(null);
  // Manual arrow offset (in item units); the slow marquee keeps drifting
  // underneath. One full set width is a seamless loop, so any offset is safe.
  const [offset, setOffset] = useState(0);
  const [stepPx, setStepPx] = useState(0);

  useEffect(() => {
    const measure = () => setStepPx(firstItemRef.current?.offsetWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const stepBy = (delta: number) => {
    if (items.length === 0) return;
    setOffset((o) => o + delta);
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeader title={title} subtitle={subtitle} {...(badge ? { badge } : {})} />
        <Link
          to="/shop"
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/50 px-4 py-2 text-xs font-bold text-primary-soft transition-colors duration-300 hover:bg-primary hover:text-primary-foreground"
        >
          مشاهده همه محصولات <ArrowLeft size={15} />
        </Link>
      </div>

      {/* Infinite RTL marquee: two identical sets drift rightward; the 50%
          loop point is pixel-exact because every item box has equal width.
          w-max + flex-nowrap + shrink-0 keep the track from collapsing.
          The transition wrapper is the manual arrow offset (snaps per item). */}
      <div className="relative mt-8">
        <div className="edge-fade overflow-hidden">
          <div
            className="will-change-transform transition-transform duration-700 ease-out motion-reduce:transition-none"
            style={
              offset !== 0 && stepPx > 0
                ? { transform: `translateX(${offset * stepPx}px)` }
                : undefined
            }
          >
            <div className="flex w-max flex-nowrap animate-marquee-rtl hover:[animation-play-state:paused] motion-reduce:animate-none">
              {marqueeItems.map((p, i) => (
                <div
                  key={`${p.id}-${i}`}
                  ref={i === 0 ? firstItemRef : undefined}
                  className="w-72 shrink-0 ps-6 sm:w-80"
                  {...(i >= items.length ? { "aria-hidden": true, inert: true } : {})}
                >
                  <ProductCard
                    product={p}
                    {...(highlightDiscount ? { highlightDiscount } : {})}
                    {...(hideDiscount ? { hideDiscount } : {})}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Glassmorphism arrows — vertically centered on the rail edges.
            In RTL the strip drifts rightward, so the left arrow advances
            to the next items and the right arrow goes back. */}
        <button
          type="button"
          onClick={() => stepBy(1)}
          aria-label="محصولات بعدی"
          className="absolute left-2 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-background/40 text-foreground shadow-lg backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:bg-background/60 sm:left-3"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => stepBy(-1)}
          aria-label="محصولات قبلی"
          className="absolute right-2 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-background/40 text-foreground shadow-lg backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:bg-background/60 sm:right-3"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </section>
  );
}
