import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Ban,
  Check,
  Droplet,
  Droplets,
  Hammer,
  Package,
  RotateCcw,
  ShoppingBag,
  Sun,
  Truck,
} from "lucide-react";
import { FaqAccordion } from "@/components/shop/FaqAccordion";
import { SectionHeader } from "@/components/shop/SectionHeader";
// Static imagery is served from `public/` at the site root.
const catGiftImg = "/cat-gift.jpg";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "راهنمای خرید | چوب‌کار" },
      {
        name: "description",
        content: "روش ثبت سفارش، ارسال، پرداخت و شرایط مرجوعی محصولات چوبی دست‌ساز چوب‌کار.",
      },
      { property: "og:title", content: "راهنمای خرید | چوب‌کار" },
      { property: "og:description", content: "همه‌چیز درباره سفارش، ارسال و مرجوعی." },
    ],
  }),
  component: Guide,
});

const steps = [
  {
    icon: ShoppingBag,
    title: "انتخاب قطعه چوبی",
    text: "محصول موردعلاقه‌تان را از میان دسته‌بندی‌ها انتخاب، به سبد اضافه و سفارش را نهایی کنید.",
  },
  {
    icon: Hammer,
    title: "آماده‌سازی و بسته‌بندی ایمن در کارگاه",
    text: "قطعه‌ی انتخابی آخری بار پرداخت و با بسته‌بندی چندلایه‌ی ضدضربه برای سفر آماده می‌شود.",
  },
  {
    icon: Truck,
    title: "ارسال سریع با تیپاکس و پست",
    text: "تهران ۱ تا ۲ روز کاری با پیک؛ شهرستان‌ها ۳ تا ۵ روز کاری با پست پیشتاز و تیپاکس.",
  },
];

const careTips = [
  {
    icon: Droplets,
    title: "فقط شست‌وشوی دستی",
    text: "با آب ولرم، صابون ملایم و اسفنج نرم بشویید و بلافاصله با دستمال خشک کنید.",
  },
  {
    icon: Ban,
    title: "خداحافظی با ماشین ظرفشویی",
    text: "حرارت و مواد شوینده‌ی قوی، الیاف چوب را می‌شکافد و روغن محافظ را از بین می‌برد.",
  },
  {
    icon: Sun,
    title: "دور از آفتاب مستقیم و رطوبت",
    text: "نور شدید رنگ را می‌بَرَد و رطوبت دائمی باعث تورم و کپک چوب طبیعی می‌شود.",
  },
  {
    icon: Droplet,
    title: "روغن‌کاری دوره‌ای",
    text: "هر ۲ تا ۳ ماه یک‌بار با کمی روغن مینرال غذایی یا روغن زیتون چرب کنید تا رطوبت و درخشش چوب حفظ شود.",
  },
];

function Guide() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <SectionHeader
        as="h1"
        title="راهنمای خرید و نگهداری"
        subtitle="از انتخاب تا رسیدن بسته‌ی چوبی شما سه قدم بیشتر فاصله نیست — و با چند عادت ساده، محصولات دست‌ساز چوب‌کار نسل‌به‌نسل دوام می‌آورند."
      />

      <section className="mt-10 grid gap-5 md:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.title}
            className="relative rounded-3xl border border-border bg-card p-6 text-center transition-colors duration-300 hover:border-primary/50"
          >
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary/40 text-primary">
              <step.icon size={24} strokeWidth={1.75} />
            </span>
            <h2 className="mt-4 font-bold text-foreground">{step.title}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-5 flex flex-col items-start gap-5 rounded-3xl border border-primary/25 bg-[#1c1916] p-6 sm:flex-row sm:items-center sm:p-8">
        <span className="grid size-14 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary-soft">
          <RotateCcw size={24} strokeWidth={1.75} />
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-extrabold text-foreground">شرایط مرجوعی</h2>
            <span className="rounded-full border border-primary/30 bg-linear-to-r from-primary/20 to-primary/5 px-3 py-1 text-xs font-bold text-primary-soft">
              ۷ روز ضمانت بازگشت
            </span>
          </div>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            تا ۷ روز پس از دریافت کالا، در صورت سالم بودن بسته‌بندی و محصول، امکان مرجوعی وجود دارد
            و مبلغ پرداختی به همان حساب شما بازمی‌گردد.
          </p>
        </div>
        <Link
          to="/contact"
          className="shrink-0 rounded-xl border border-primary/50 px-5 py-2.5 text-sm font-bold text-primary-soft transition-colors duration-300 hover:bg-primary hover:text-primary-foreground"
        >
          پیگیری مرجوعی
        </Link>
      </section>

      <section className="mt-14 overflow-hidden rounded-3xl border border-border bg-card">
        <div className="wood-texture border-b border-border/60 p-6 sm:p-8">
          <p className="text-xs font-bold tracking-wide text-primary">مراقبت مثل یک نجار</p>
          <h2 className="mt-2 text-xl font-extrabold sm:text-2xl">راهنمای نگهداری چوب</h2>
          <p className="mt-3 max-w-2xl text-sm leading-8 text-muted-foreground">
            چوب طبیعی ماده‌ای زنده است؛ با تغییر رطوبت نفس می‌کشد. مراقبت از آن بیشتر از دهه‌ها عمر
            و درخشش گرمش را تضمین می‌کند.
          </p>
        </div>
        <div className="grid gap-8 p-6 sm:grid-cols-2 sm:p-8">
          {careTips.map((tip) => (
            <div key={tip.title} className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary/40 text-primary">
                <tip.icon size={19} strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="font-bold text-foreground">{tip.title}</h3>
                <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{tip.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Signature packaging — the unboxing experience (checkout Info link target) ── */}
      <section
        id="signature-packaging"
        className="mt-14 scroll-mt-24 overflow-hidden rounded-3xl border border-primary/25 bg-[#1c1916]"
      >
        <div className="grid lg:grid-cols-2">
          {/* Editorial image */}
          <div className="relative min-h-64 overflow-hidden sm:min-h-80 lg:min-h-full">
            <img
              src={catGiftImg}
              alt="بسته‌بندی امضای چوب‌کار"
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-[#1c1916]/60 via-transparent to-transparent" />
            <span className="absolute bottom-4 start-4 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background/60 px-3 py-1.5 text-[11px] font-bold text-primary-soft backdrop-blur">
              <Package size={12} />
              جعبه چوبی امضای چوب‌کار
            </span>
          </div>

          {/* Refined typography column */}
          <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
            <p className="text-xs font-bold tracking-[0.2em] text-primary">بسته‌بندی امضای ما</p>
            <h2 className="text-2xl font-extrabold leading-snug text-foreground sm:text-3xl">
              تجربه‌ی جعبه‌گشایی
            </h2>
            <p className="text-sm leading-8 text-muted-foreground">
              هر قطعه‌ی چوب‌کار مانند یک هدیه‌ی دست‌ساز بسته می‌شود؛ نه فقط تا سالم برسد، که تا
              لحظه‌ی باز کردن جعبه، بخشی از خرید باشد. جعبه‌ی چوبی امضای ما با کاغذ کرافت چندلایه،
              پرکننده‌ی ضدضربه و روبان ابریشمی، قطعه‌تان را برای هر سفر آماده می‌کند — و کارتِ
              دست‌نوشته‌ای که همراهش می‌رسد، از همان روز اول به شما یادآوری می‌کند که چوب، با مراقبت
              ساده، نسل‌ها دوام می‌آورد.
            </p>
            <ul className="space-y-2.5 text-sm text-foreground/90">
              {[
                "جعبه‌ی چوبی امضای چوب‌کار — دوباره قابل استفاده",
                "کاغذ کرافت چندلایه و پرکننده‌ی ضدضربه برای حمل مطمئن",
                "کارتِ دست‌نوشته همراه با راهنمای نگهداری چوب",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span className="mt-1 grid size-4 shrink-0 place-items-center rounded-full bg-primary/15 text-primary-soft">
                    <Check size={10} strokeWidth={3} />
                  </span>
                  <span className="leading-7">{line}</span>
                </li>
              ))}
            </ul>
            <div>
              <Link
                to="/checkout"
                className="inline-block rounded-xl border border-primary/50 px-5 py-2.5 text-sm font-bold text-primary-soft transition-colors duration-300 hover:bg-primary hover:text-primary-foreground"
              >
                سفارش با بسته‌بندی ویژه
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <SectionHeader title="پرسش‌های متداول" />
        <div className="mt-6">
          <FaqAccordion />
        </div>
      </section>
    </div>
  );
}
