import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/shop/Logo";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_PROFILE } from "@/lib/admin-auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { returnTo?: string } => {
    const raw = search["returnTo"];
    // Only same-origin internal paths are honored (never absolute/protocol URLs).
    if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
      return { returnTo: raw };
    }
    return {};
  },
  head: () => ({
    meta: [
      { title: "ورود و ثبت‌نام | چوب‌کار" },
      { name: "description", content: "ورود به حساب کاربری فروشگاه چوبی دست‌ساز چوب‌کار." },
      { property: "og:title", content: "ورود و ثبت‌نام | چوب‌کار" },
      { property: "og:description", content: "حساب کاربری فروشگاه چوب‌کار." },
    ],
  }),
  component: Auth,
});

/** Mock OTP credentials: any 09xxxxxxxxx phone + the demo code below. */
const DEMO_CODE = "12345";
const PHONE_RE = /^09\d{9}$/;

/** Accept Persian keypad digits too (phones often auto-convert them). */
const toLatinDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

function Auth() {
  const { returnTo } = Route.useSearch();
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Already signed in: never sit on the login page — go home (or back to the
  // interrupted purchase).
  useEffect(() => {
    if (!isLoading && user) {
      navigate({ to: returnTo ?? "/" });
    }
  }, [isLoading, user, navigate, returnTo]);

  const submitPhone = (e: FormEvent) => {
    e.preventDefault();
    const digits = toLatinDigits(phone).trim();
    if (!PHONE_RE.test(digits)) {
      setError("شماره موبایل باید ۱۱ رقم و با 09 شروع شود (مثلا 09123456789).");
      return;
    }
    setError("");
    setSending(true);
    // Mocked SMS dispatch delay.
    setTimeout(() => {
      setSending(false);
      setStep("code");
    }, 900);
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (toLatinDigits(code).trim() !== DEMO_CODE) {
      setError("کد تأیید نادرست است. دوباره تلاش کنید.");
      return;
    }
    setError("");
    setVerifying(true);
    const digits = toLatinDigits(phone).trim();
    setTimeout(() => {
      setVerifying(false);
      login({
        id: `u-${digits}`,
        phone: digits,
        role: digits === ADMIN_PROFILE.phone ? "admin" : "customer",
      });
      toast.success("با موفقیت وارد شدید", {
        action: {
          label: "رفتن به سبد خرید",
          onClick: () => navigate({ to: "/cart" }),
        },
      });
      // Never interrupt a purchase: a return intent (e.g. /checkout from the
      // cart guard) wins; a standard header login goes home.
      navigate({ to: returnTo ?? "/" });
    }, 700);
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="space-y-6 rounded-2xl border border-border bg-card p-8">
        <div className="flex flex-col items-center text-center">
          <Logo size={60} />
          <h1 className="mt-4 text-xl font-extrabold">ورود / ثبت‌نام</h1>
          <p className="mt-2 text-xs leading-7 text-muted-foreground">
            {returnTo
              ? "برای ادامه‌ی خرید، وارد حساب کاربری خود شوید."
              : "شماره موبایل خود را وارد کنید تا کد تأیید برایتان ارسال شود."}
          </p>
        </div>

        {/* Step indicator */}
        <ol className="flex items-center justify-center gap-2 text-[11px] font-bold">
          <li
            className={
              step === "phone"
                ? "rounded-full border border-primary/60 bg-primary/10 px-3 py-1 text-primary-soft"
                : "rounded-full border border-border px-3 py-1 text-muted-foreground"
            }
          >
            ۱. شماره موبایل
          </li>
          <span className="h-px w-6 bg-border" />
          <li
            className={
              step === "code"
                ? "rounded-full border border-primary/60 bg-primary/10 px-3 py-1 text-primary-soft"
                : "rounded-full border border-border px-3 py-1 text-muted-foreground"
            }
          >
            ۲. کد تأیید
          </li>
        </ol>

        {step === "phone" ? (
          <form onSubmit={submitPhone} className="space-y-4 text-right">
            <div className="space-y-2">
              <label htmlFor="auth-phone" className="block text-xs font-bold text-foreground/80">
                شماره موبایل
              </label>
              <input
                id="auth-phone"
                dir="ltr"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(toLatinDigits(e.target.value))}
                placeholder="09123456789"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-right text-sm tracking-widest outline-none placeholder:text-muted-foreground/40 focus:border-primary"
              />
            </div>
            {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> در حال ارسال کد…
                </>
              ) : (
                "دریافت کد تأیید"
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-4 text-right">
            <p className="rounded-xl border border-secondary/60 bg-secondary/20 p-3 text-[11px] leading-6 text-foreground/90">
              کد تأیید به شماره‌ی{" "}
              <span dir="ltr" className="font-mono font-bold">
                {phone}
              </span>{" "}
              ارسال شد.
            </p>
            <div className="space-y-2">
              <label htmlFor="auth-code" className="block text-xs font-bold text-foreground/80">
                کد تأیید ۵ رقمی
              </label>
              <input
                id="auth-code"
                dir="ltr"
                inputMode="numeric"
                maxLength={5}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) =>
                  setCode(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 5))
                }
                placeholder="12345"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-lg font-bold tracking-[0.6em] outline-none placeholder:tracking-normal placeholder:text-muted-foreground/40 focus:border-primary"
              />
            </div>
            {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={verifying}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {verifying ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> در حال تأیید…
                </>
              ) : (
                "تأیید و ورود"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError("");
              }}
              className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary-soft"
            >
              <ArrowLeft size={13} />
              تغییر شماره موبایل
            </button>
          </form>
        )}

        <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-[11px] leading-6 text-muted-foreground">
          <ShieldCheck size={14} className="shrink-0 text-primary" />
          حالت نمایشی: هر شماره‌ای با 09 و کد ۱۲۳۴۵ پذیرفته می‌شود؛ با شماره
          <span dir="ltr" className="font-mono font-bold text-primary-soft">
            {ADMIN_PROFILE.phone}
          </span>{" "}
          با نقش «مدیر» وارد می‌شوید.
        </p>
      </div>
    </div>
  );
}
