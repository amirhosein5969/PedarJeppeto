import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SectionHeader } from "@/components/shop/SectionHeader";
import { cn } from "@/lib/utils";
import heroWorkshop from "@/assets/hero-workshop.jpg";
import about1 from "@/assets/about-1.jpg";
import about2 from "@/assets/about-2.jpg";
import kitchenImg from "@/assets/cat-kitchen.jpg";
import officeImg from "@/assets/cat-office.jpg";
import giftImg from "@/assets/cat-gift.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "درباره‌ی چوب‌کار | کارگاه محصولات چوبی دست‌ساز" },
      {
        name: "description",
        content:
          "داستان کارگاه چوب‌کار؛ انتخاب الوار، هنر دست و پرداخت روغن. محصولات چوبی دست‌ساز از چوب طبیعی گردو، بلوط و راش.",
      },
      { property: "og:title", content: "درباره‌ی چوب‌کار" },
      { property: "og:description", content: "قصه‌ی چوب، با دست نوشته شده." },
    ],
  }),
  component: About,
});

/** Scroll-reveal wrapper — fades/slides content in once (same pattern as SectionHeader). */
function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
      className={cn(
        visible
          ? "animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out motion-reduce:animate-none"
          : "opacity-0 motion-reduce:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}

const craftStations = [
  {
    image: about1,
    alt: "بررسی رگه‌ی الوار در کارگاه",
    step: "۰۱",
    title: "انتخاب الوار",
    text: "الوارهای کهنه و با اصالت، یکی‌یکی از نظر رگه، تاب و سلامت چوب بررسی می‌شوند.",
    span: "lg:col-span-5",
    height: "h-[24rem]",
    offset: "",
  },
  {
    image: kitchenImg,
    alt: "تراش و فرم‌دهی دستی",
    step: "۰۲",
    title: "تراش و فرم‌دهی",
    text: "فرم اصلی با دست و ابزار دستی شکل می‌گیرد؛ نه با قالب‌های صنعتی.",
    span: "lg:col-span-4",
    height: "h-[20rem]",
    offset: "lg:mt-16",
  },
  {
    image: officeImg,
    alt: "سنباده‌کاری مویی سطوح چوبی",
    step: "۰۳",
    title: "سنباده‌کاری مویی",
    text: "نرم‌سازی تدریجی سطوح تا لطافتی ابریشمی و یکنواخت زیر دست.",
    span: "lg:col-span-3",
    height: "h-[22rem]",
    offset: "",
  },
  {
    image: about2,
    alt: "پرداخت چوب با روغن و موم",
    step: "۰۴",
    title: "روغن و موم",
    text: "تغذیه‌ی چوب با روغن زیتون و موم طبیعی برای درخشش گرم و ماندگار.",
    span: "lg:col-span-4",
    height: "h-[22rem]",
    offset: "lg:mt-10",
  },
  {
    image: giftImg,
    alt: "بررسی نهایی قطعه پیش از امضا",
    step: "۰۵",
    title: "بررسی نهایی",
    text: "هر قطعه پیش از امضا، یک‌بار دیگر زیر نور و زیر دست آزمون می‌شود.",
    span: "lg:col-span-8",
    height: "h-[24rem]",
    offset: "lg:mt-24",
  },
];

function About() {
  return (
    <div>
      {/* 1 — Cinematic hero: edge-to-edge cover with delicate overlay typography */}
      <section className="relative h-[74vh] min-h-[32rem] w-full overflow-hidden">
        <img
          src={heroWorkshop}
          alt="کارگاه چوب‌کار"
          width={1600}
          height={900}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/50 to-background/20" />
        <div className="absolute inset-0 bg-linear-to-l from-background/85 via-background/25 to-transparent" />

        <div className="relative mx-auto flex h-full w-full max-w-7xl flex-col justify-end px-4 pb-16 sm:pb-20">
          <Reveal>
            <div className="mb-5 h-px w-24 bg-linear-to-l from-primary/90 to-transparent" />
            <p className="text-xs font-bold tracking-[0.35em] text-primary-soft">
              کارگاه چوب‌کار — از سال ۱۳۹۲
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl leading-[1.2] font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl">
              قصه‌ی چوب،
              <br />
              با دست نوشته شده
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-8 text-muted-foreground sm:text-base">
              از انتخاب یک الوار کهنه تا آخرین لایه‌ی روغن؛ هر آنچه در این کارگاه می‌گذرد، قصه‌ای
              است از صبر، چوب و دست.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 2 — The workshop story: long-form editorial with sticky label column */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
          <Reveal>
            <div className="lg:sticky lg:top-36">
              <div className="mb-4 h-px w-24 bg-linear-to-l from-primary/80 to-transparent" />
              <p className="text-xs font-bold tracking-[0.3em] text-primary-soft">داستان کارگاه</p>
            </div>
          </Reveal>

          <div className="max-w-3xl space-y-7 text-[15px] leading-10 text-muted-foreground">
            <Reveal>
              <p>
                کارگاه چوب‌کار در بهار ۱۳۹۲، در انتهای کوچه‌ی نجاران و با یک اره‌ی دستی و چند تخته‌ی
                چوب گردو شروع شد. پدربزرگم سال‌ها نجار خانه بود و می‌گفت «چوب، آخرین حرفش را با صبر
                می‌زند.» آن روزها هیچ برنامه‌ی بزرگی نداشتیم؛ فقط یک باور ساده که وسایلی با دست
                ساخته می‌شوند، روح دارند. هنوز هم همین باور، هر تصمیم کارگاه را هدایت می‌کند و هر
                قطعه‌ای که از این‌جا بیرون می‌رود، تکه‌ای از آن میراث خانوادگی است.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <p>
                الواری که وارد کارگاه می‌شود، ابتدا هفته‌ها در سایه آرام خشک می‌شود تا تابش و رطوبتش
                از بین برود؛ بعد یکی‌یکی زیر چشم ما می‌گذرد: رگه‌اش، رنگش، بوی چوبش. گردوی کوهی،
                بلوط باغ‌های قدیمی و راشِ بی‌صدا؛ هر چوبی اخلاق خودش را دارد و ما وظیفه‌ی ما فقط این
                است که آن اخلاق را کشف کنیم و دست‌نشانه نیندازیم. وقتی الوار درست پیدا شد، تازه
                قصه‌ی هر قطعه شروع می‌شود.
              </p>
            </Reveal>
            <Reveal delay={150}>
              <blockquote className="border-s-2 border-primary py-1 ps-6 text-lg leading-10 font-bold text-foreground">
                «چوب با عجله پاسخ نمی‌دهد؛ هر دست‌کاری را، به همان اندازه‌ی صبر سازنده‌اش،
                برمی‌گرداند.»
              </blockquote>
            </Reveal>
            <Reveal delay={200}>
              <p>
                تراش، سنباده‌ی مویی، روغن خوراکی و موم طبیعی؛ همه‌چیز با دست، با همان وسواسی که نسل
                قبل به ما آموخت. به همین دلیل هیچ دو قطعه‌ای از کارگاه ما شبیه هم نیستند و هر خط و
                نشان روی چوب، امضای دستی ماست. ما وسایلی می‌سازیم که سال‌ها کنارتان بمانند، با
                بچه‌هایتان بزرگ شوند و با گذر زمان، گرم‌تر و زیباتر از روز اول شوند.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 3 — The art of craft: staggered, asymmetrical image grid */}
      <section className="grain-panel border-y border-border py-24 sm:py-28">
        <div className="mx-auto w-full max-w-7xl px-4">
          <SectionHeader title="هنر دست" subtitle="پنج ایستگاه ساخت در کارگاه چوب‌کار" />

          <div className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-12">
            {craftStations.map((station, i) => (
              <Reveal
                key={station.step}
                delay={i * 80}
                className={cn(station.span, station.offset)}
              >
                <figure className="group">
                  <div
                    className={cn(
                      "overflow-hidden rounded-2xl border border-border shadow-soft",
                      station.height,
                    )}
                  >
                    <img
                      src={station.image}
                      alt={station.alt}
                      loading="lazy"
                      width={1000}
                      height={750}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  </div>
                  <figcaption className="mt-4 space-y-1.5 pr-1">
                    <p className="text-[11px] font-extrabold tracking-[0.25em] text-primary-soft">
                      {station.step}
                    </p>
                    <h3 className="text-sm font-extrabold text-foreground">{station.title}</h3>
                    <p className="text-xs leading-6 text-muted-foreground">{station.text}</p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4 — Quiet closing CTA on the deep panel tone */}
      <section className="bg-[#151311] py-24 sm:py-28">
        <div className="mx-auto w-full max-w-3xl px-4 text-center">
          <Reveal>
            <div className="mx-auto mb-5 h-px w-24 bg-linear-to-r from-primary/80 to-transparent" />
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              قطعه‌ی بعدی، قصه‌ی شماست
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-8 text-muted-foreground sm:text-base">
              اگر تکه‌ای از این قصه برای خانه یا هدیه‌ی‌تان می‌خواهید، کاتالوگ کارگاه را ورق بزنید
              یا برای یک سفارش سفارشی، با ما در تماس باشید.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/shop"
                className="rounded-xl bg-primary px-7 py-3 text-sm font-bold text-primary-foreground transition-transform duration-300 hover:-translate-y-0.5"
              >
                مشاهده محصولات
              </Link>
              <Link
                to="/contact"
                className="rounded-xl border border-primary/50 px-7 py-3 text-sm font-bold text-primary-soft transition-colors duration-300 hover:bg-primary hover:text-primary-foreground"
              >
                تماس با ما
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
