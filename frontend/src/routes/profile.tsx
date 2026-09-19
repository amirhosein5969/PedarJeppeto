import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut, ShoppingBag, UserRound } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  component: ProfileLayout,
  // Bare /profile lands on the account tab.
  beforeLoad: ({ location }) => {
    if (location.pathname === "/profile" || location.pathname === "/profile/") {
      throw redirect({ to: "/profile/account" });
    }
  },
  head: () => ({
    meta: [{ title: "حساب کاربری | چوب‌کار" }],
  }),
});

/** The two portal tabs. Order matters — it is the sidebar order. */
const PORTAL_NAV = [
  { to: "/profile/account", label: "پروفایل من", icon: UserRound },
  { to: "/profile/orders", label: "تاریخچه سفارشات", icon: ShoppingBag },
] as const;

const NAV_LEAVES = PORTAL_NAV as readonly { to: string; label: string }[];

function ProfileLayout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Auth lives in client-side localStorage (mock OTP). We can only decide
  // "signed out → send to /auth" after hydration, so the guard runs in an
  // effect (never during SSR).
  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: "/auth", search: { returnTo: "/profile/account" }, replace: true });
    }
  }, [isLoading, user, navigate]);

  // Signed out / still hydrating: show a quiet shell, not a flash of content.
  if (isLoading || !user) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-center text-sm text-muted-foreground">در حال بارگذاری…</p>
      </div>
    );
  }

  const active = NAV_LEAVES.find((item) => pathname.startsWith(item.to));

  const handleLogout = () => {
    logout();
    toast.success("با موفقیت از حساب خارج شدید.");
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      {/* Section header — a quiet Aesop-style kicker + hairline rule. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-primary-soft">
            حساب کاربری
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            خوش آمدید
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            از اینکه همراه ما هستید، سپاسگزاریم.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-muted-foreground transition-colors duration-300 hover:border-destructive/40 hover:text-destructive"
        >
          <LogOut className="size-3.5" />
          خروج از حساب
        </button>
      </div>

      <div className="mt-6 h-px w-full bg-gradient-to-l from-transparent via-white/10 to-transparent" />

      {/* Sidebar + content. On mobile the sidebar becomes a horizontal tab row. */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <aside>
          <nav aria-label="حساب کاربری" className="flex gap-1 overflow-x-auto lg:flex-col">
            {PORTAL_NAV.map((item) => {
              const isActive = active?.to === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold transition-all duration-300",
                    isActive
                      ? "border-primary/30 bg-primary/10 text-primary-soft"
                      : "border-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground/70 group-hover:text-foreground",
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* A whisper of reassurance at the bottom of the sidebar. */}
          <div className="mt-8 hidden lg:block">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-[11px] font-bold text-foreground/80">شماره موبایل شما</p>
              <p
                dir="ltr"
                className="mt-1.5 text-left font-mono text-xs tracking-wider text-primary-soft"
              >
                {user.phone}
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}