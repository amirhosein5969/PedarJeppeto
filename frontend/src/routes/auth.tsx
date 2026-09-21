import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageSquare, PhoneCall, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/shop/Logo";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_PROFILE } from "@/lib/admin-auth";
import { api, ApiError } from "@/lib/api";
import type { ApiAuthToken, ApiOtpSent } from "@/lib/api-types";

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
      { title: "ورود و ثبت‌نام | پدر ژپتو" },
      { name: "description", content: "ورود به حساب کاربری فروشگاه چوبی دست‌ساز پدر ژپتو." },
      { property: "og:title", content: "ورود و ثبت‌نام | پدر ژپتو" },
      { property: "og:description", content: "حساب کاربری فروشگاه پدر ژپتو." },
    ],
  }),
  component: Auth,
});

/**
 * Secure OTP login (real). Step 1 sends the phone to `POST /auth/request-otp`
 * (SMS by default); step 2 verifies against `POST /auth/verify-otp` and
 * stores the returned JWT. Cost/abuse control lives server-side (Redis):
 * 3 dispatches per 15 min (429) and 5 wrong-code attempts (code destroyed).
 * The client mirrors those limits: a strict 120 s countdown before resend
 * is even offered, and resend is permanently disabled once the local
 * attempt counter reaches 3 (or the API answers 429).
 */
const OTP_TTL_SECONDS = 120;
const MAX_OTP_ATTEMPTS = 3;
const TOO_MANY_TOAST = "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ۱۵ دقیقه صبر کنید.";
const PHONE_RE = /^09\d{9}$/;

/** Accept Persian keypad digits too (phones often auto-convert them). */
const toLatinDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

/** 120 → "02:00" */
const formatCooldown = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Auth() {
  const { returnTo } = Route.useSearch();
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0); // seconds until resend is allowed
  const [attempts, setAttempts] = useState(0); // OTP dispatches requested this session
  const [locked, setLocked] = useState(false); // permanent (this session) resend block

  const digits = toLatinDigits(phone).trim();

  // Already signed in: never sit on the login page — go home (or back to the
  // interrupted purchase).
  useEffect(() => {
    if (!isLoading && user) {
      navigate({ to: returnTo ?? "/" });
    }
  }, [isLoading, user, navigate, returnTo]);

  // Strict 120-second countdown (one tick per second while running).
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  // --- POST /auth/request-otp ------------------------------------------------
  const requestOtp = useMutation({
    mutationFn: async (method: "sms" | "call"): Promise<ApiOtpSent> =>
      (await api.post<ApiOtpSent>("/auth/request-otp", { phone: digits, method })).data,
    onMutate: () => {
      setError("");
      const next = attempts + 1;
      setAttempts(next);
      // Mirror the server's 3-per-15-min limit: no 4th request is ever sent.
      if (next >= MAX_OTP_ATTEMPTS && !locked) {
        setLocked(true);
        toast.error(TOO_MANY_TOAST);
      }
    },
    onSuccess: () => {
      setCode("");
      setError("");
      setStep("code");
      setCooldown(OTP_TTL_SECONDS);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 429) {
        setLocked(true);
        toast.error(TOO_MANY_TOAST);
      } else {
        setError(err instanceof Error ? err.message : "ارسال کد با خطا مواجه شد؛ دوباره تلاش کنید.");
      }
    },
  });

  // --- POST /auth/verify-otp ---------------------------------------------------
  const verifyOtp = useMutation({
    mutationFn: async (): Promise<ApiAuthToken> =>
      (await api.post<ApiAuthToken>("/auth/verify-otp", {
        phone: digits,
        code: toLatinDigits(code).trim(),
      })).data,
    onSuccess: (data) => {
      login({
        id: `u-${digits}`,
        phone: digits,
        role: digits === ADMIN_PROFILE.phone ? "admin" : "customer",
        token: data.access_token,
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
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : "تأیید کد با خطا مواجه شد؛ دوباره تلاش کنید."
      );
    },
  });

  const resendBlocked = locked || attempts >= MAX_OTP_ATTEMPTS;

  const submitPhone = (e: FormEvent) => {
    e.preventDefault();
    if (!PHONE_RE.test(digits)) {
      setError("شماره موبایل باید ۱۱ رقم و با 09 شروع شود (مثلا 09123456789).");
      return;
    }
    setError("");
    requestOtp.mutate("sms");
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (toLatinDigits(code).trim().length !== 5) {
      setError("کد تأیید باید ۵ رقم باشد.");
      return;
    }
    setError("");
    verifyOtp.mutate();
  };

  const resend = (method: "sms" | "call") => {
    if (resendBlocked || cooldown > 0 || requestOtp.isPending) return;
    requestOtp.mutate(method);
  };

  const goBackToPhone = () => {
    setStep("phone");
    setCode("");
    setError("");
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="space-y-6 rounded-2xl border border-border bg-card p-8">
        <div className="flex flex-col items-center text-center">
          <Logo size={190} glow />
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
              disabled={requestOtp.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {requestOtp.isPending ? (
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
              disabled={verifyOtp.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {verifyOtp.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> در حال تأیید…
                </>
              ) : (
                "تأیید و ورود"
              )}
            </button>

            {/* Resend area — hidden until the 120 s countdown finishes. */}
            {cooldown > 0 ? (
              <p className="text-center text-[11px] text-muted-foreground">
                ارسال مجدد کد پس از{" "}
                <span dir="ltr" className="font-mono font-bold">
                  {formatCooldown(cooldown)}
                </span>
              </p>
            ) : (
              <div className="space-y-2">
                {resendBlocked && (
                  <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-2.5 text-center text-[11px] font-semibold leading-5 text-destructive">
                    {TOO_MANY_TOAST}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => resend("sms")}
                    disabled={resendBlocked || requestOtp.isPending}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2 py-2.5 text-[11px] font-bold text-foreground/80 transition-colors hover:border-primary hover:text-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MessageSquare size={13} />
                    ارسال مجدد پیامک
                  </button>
                  <button
                    type="button"
                    onClick={() => resend("call")}
                    disabled={resendBlocked || requestOtp.isPending}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2 py-2.5 text-[11px] font-bold text-foreground/80 transition-colors hover:border-primary hover:text-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PhoneCall size={13} />
                    دریافت کد از طریق تماس
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={goBackToPhone}
              className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary-soft"
            >
              <ArrowLeft size={13} />
              اصلاح شماره
            </button>
          </form>
        )}

        <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-[11px] leading-6 text-muted-foreground">
          <ShieldCheck size={14} className="shrink-0 text-primary" />
          کد تأیید از طریق پیامک یا تماس تلفنی به شماره‌ی شما ارسال می‌شود؛ برای
          امنیت حساب، هر کد تنها ۲ دقیقه اعتبار دارد.
        </p>
      </div>
    </div>
  );
}