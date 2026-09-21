import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Instagram, Mail, MapPin, Phone, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "./Logo";
import { toFa } from "@/lib/shop-data";

const quickLinks = [
  { label: "فروشگاه", to: "/shop" },
  { label: "درباره ما", to: "/about" },
  { label: "راهنمای خرید", to: "/guide" },
  { label: "تماس با ما", to: "/contact" },
];

/** lucide-react has no Bale/Basalam marks, so those use styled letter badges. */
const socials: { label: string; icon?: typeof Instagram; char?: string }[] = [
  { icon: Instagram, label: "اینستاگرام" },
  { icon: Send, label: "تلگرام" },
  { icon: Phone, label: "واتساپ" },
  { char: "B", label: "بله" },
  { char: "ب", label: "باسلام" },
];

export function Footer() {
  const [email, setEmail] = useState("");

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("عضویت شما در باشگاه مشتریان ثبت شد", {
      description: "کد تخفیف خوش‌آمدگویی به ایمیل شما ارسال می‌شود.",
    });
    setEmail("");
  };

  return (
    <footer className="mt-20 border-t border-white/5 bg-[#151311]">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 md:grid-cols-2 lg:grid-cols-4">
        {/* Brand + mission + social */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Logo size={44} />
            <span className="text-lg font-extrabold text-primary-soft">پدر ژپتو</span>
          </div>
          <p className="text-sm leading-7 text-muted-foreground">
            کارگاه کوچک ما از سال ۱۳۹۲ محصولات چوبی دست‌ساز می‌سازد؛ با چوب طبیعی، پرداخت روغن
            خوراکی و صبرِ دست.
          </p>
          <div className="inline-flex items-center gap-2 rounded-xl border border-secondary/60 bg-secondary/25 px-4 py-3 text-xs text-foreground/90">
            <ShieldCheck size={18} className="text-primary" />
            نماد اعتماد الکترونیکی (E-Namad)
          </div>
          <div className="flex gap-2 pt-1">
            {socials.map(({ icon: Icon, label, char }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="grid size-10 place-items-center rounded-full border border-white/5 bg-white/5 text-primary transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:shadow-glow"
              >
                {Icon ? (
                  <Icon size={17} />
                ) : (
                  <span className="text-[13px] leading-none font-extrabold">{char}</span>
                )}
              </a>
            ))}
          </div>
        </div>

        {/* Quick navigation */}
        <div>
          <h4 className="mb-4 font-bold text-primary-soft">دسترسی سریع</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {quickLinks.map((l) => (
              <li key={l.label}>
                <Link
                  to={l.to as never}
                  className="transition-colors duration-300 hover:text-primary-soft"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Workshop contact */}
        <div>
          <h4 className="mb-4 font-bold text-primary-soft">کارگاه پدر ژپتو</h4>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/5 bg-white/5 text-primary">
                <Phone size={15} />
              </span>
              {toFa("021-88445566")}
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/5 bg-white/5 text-primary">
                <Mail size={15} />
              </span>
              info@choobkar.ir
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/5 bg-white/5 text-primary">
                <MapPin size={15} />
              </span>
              <span className="leading-7">
                تهران، خیابان کارگر شمالی، کوچه نجاران، پلاک {toFa(24)}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/5 bg-white/5 text-primary">
                <Clock size={15} />
              </span>
              <span className="leading-7">
                شنبه تا چهارشنبه: ۹:۰۰ الی ۱۸:۰۰
                <br />
                پنج‌شنبه‌ها: ۹:۰۰ الی ۱۴:۰۰
              </span>
            </li>
          </ul>
        </div>

        {/* Newsletter / workshop club */}
        <div>
          <h4 className="mb-4 font-bold text-primary-soft">باشگاه مشتریان پدر ژپتو</h4>
          <p className="mb-4 text-sm leading-7 text-muted-foreground">
            ایمیل خود را وارد کنید تا از محصولات تازه‌ی کارگاه و کدهای تخفیف اختصاصی باخبر شوید.
          </p>
          <form onSubmit={subscribe} className="space-y-3">
            <label htmlFor="newsletter-email" className="sr-only">
              ایمیل برای عضویت در باشگاه مشتریان
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.com"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm outline-none backdrop-blur-md transition-all duration-300 placeholder:text-muted-foreground focus:border-primary/60 focus:shadow-glow"
            />
            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-l from-primary to-primary-soft text-sm font-bold text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow"
            >
              <Send size={15} />
              عضویت در باشگاه
            </button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            عضویت برای دریافت کدهای تخفیف کارگاهی — بدون اسپم، لغو با یک کلیک.
          </p>
        </div>
      </div>

      <div className="border-t border-white/5 py-5 text-center text-xs text-muted-foreground">
        تمامی حقوق این وب‌سایت متعلق به پدر ژپتو است. © {toFa(1404)}
      </div>
    </footer>
  );
}
