import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Ticket,
  TreePine,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/shop/Logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { to: "/admin/dashboard", label: "پیشخوان", icon: LayoutDashboard },
  {
    label: "محصولات",
    icon: Package,
    children: [
      { to: "/admin/products", label: "لیست محصولات", icon: Package },
      { to: "/admin/product-details", label: "جزئیات محصولات", icon: TreePine },
    ],
  },
  { to: "/admin/categories", label: "دسته‌بندی‌ها", icon: Tags },
  { to: "/admin/orders", label: "سفارشات", icon: ShoppingCart },
  { to: "/admin/promotions", label: "مدیریت تخفیف‌ها", icon: Ticket },
  { to: "/admin/users", label: "کاربران", icon: Users },
  { to: "/admin/storefront", label: "چهره فروشگاه", icon: Store },
  { to: "/admin/settings", label: "تنظیمات فروشگاه", icon: Settings },
] as const;

type NavGroup = Extract<(typeof ADMIN_NAV)[number], { children: unknown }>;

const NAV_LEAVES = ADMIN_NAV.flatMap((item): readonly { to: string; label: string }[] =>
  "children" in item ? item.children : [item],
);

export function AdminLayout() {
  // UNIFIED LOGIN gate: the panel renders only for a persisted session
  // issued by the shared OTP flow (POST /auth/verify-otp) with role=admin.
  // The old mock username/password card is gone — admins sign in at /auth
  // like everyone else; the backend RBAC answers 401/403 regardless.
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  // Submenu accordion state: pinned = manually opened, closed = manually
  // collapsed (also overrides the auto-open of the active group).
  const [pinnedGroups, setPinnedGroups] = useState<string[]>([]);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // SSR / first hydration paint: the session lives in localStorage, so we
  // can only decide on the client — render a neutral frame until then.
  if (isLoading) return <div className="min-h-screen bg-background" />;

  // AdminRoute (second line of defense after the /admin beforeLoad guard):
  // signed out or non-admin → back to the unified OTP login with a return
  // intent, which postLoginPath only honors for actual admins.
  if (!user || !user.token || user.role !== "admin") {
    return <Navigate to="/auth" search={{ returnTo: pathname }} replace />;
  }

  const active = NAV_LEAVES.find((item) => pathname.startsWith(item.to));

  // The group containing the current page auto-opens unless it was manually
  // collapsed; other groups open only when pinned by the user.
  const activeGroup = ADMIN_NAV.find(
    (item): item is NavGroup =>
      "children" in item && item.children.some((child) => pathname.startsWith(child.to)),
  );
  const isGroupOpen = (group: NavGroup) =>
    pinnedGroups.includes(group.label) ||
    (activeGroup?.label === group.label && !closedGroups.includes(group.label));
  const toggleGroup = (group: NavGroup) => {
    if (isGroupOpen(group)) {
      setPinnedGroups((prev) => prev.filter((label) => label !== group.label));
      setClosedGroups((prev) => (prev.includes(group.label) ? prev : [...prev, group.label]));
    } else {
      setClosedGroups((prev) => prev.filter((label) => label !== group.label));
      setPinnedGroups((prev) => (prev.includes(group.label) ? prev : [...prev, group.label]));
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile drawer backdrop */}
      <div
        aria-hidden
        onClick={() => {
          setNavOpen(false);
        }}
        className={cn(
          "fixed inset-0 z-[35] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Fixed sidebar — right side (RTL), border on its inner (left) edge.
          Layered below Radix dialogs (z-50) so sheets/overlays cover it. */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-64 flex-col border-l border-white/5 bg-[#151311] transition-transform duration-300 ease-out lg:translate-x-0",
          navOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 px-5">
          <Logo size={36} />
          <div>
            <p className="text-sm font-extrabold text-foreground">پدر ژپتو</p>
            <p className="text-[10px] font-bold text-muted-foreground">پنل مدیریت</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <p className="px-3 pb-2 pt-3 text-[10px] font-bold text-muted-foreground/60">
            مدیریت فروشگاه
          </p>
          <ul className="space-y-1">
            {ADMIN_NAV.map((item) =>
              "children" in item ? (
                <li key={item.label}>
                  <button
                    type="button"
                    aria-expanded={isGroupOpen(item)}
                    onClick={() => {
                      toggleGroup(item);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors duration-300",
                      activeGroup?.label === item.label
                        ? "text-primary-soft"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="flex-1 text-start">{item.label}</span>
                    <ChevronDown
                      className={cn(
                        "size-3.5 shrink-0 transition-transform duration-300",
                        isGroupOpen(item) && "rotate-180",
                      )}
                    />
                  </button>
                  <ul
                    className={cn(
                      "grid transition-[grid-template-rows] duration-300 ease-out",
                      isGroupOpen(item) ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <li className="overflow-hidden">
                      <ul className="ms-4 me-2 space-y-1 border-s border-white/5 pt-1">
                        {item.children.map((child) => (
                          <li key={child.to}>
                            <Link
                              to={child.to}
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-bold transition-colors duration-300",
                                active?.to === child.to
                                  ? "bg-primary/10 text-primary-soft"
                                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                              )}
                            >
                              <child.icon className="size-3.5 shrink-0" />
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  </ul>
                </li>
              ) : (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors duration-300",
                      active?.to === item.to
                        ? "bg-primary/10 text-primary-soft"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="border-t border-white/5 p-3">
          <Link
            to="/"
            target="_blank"
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-xs font-bold text-muted-foreground transition-colors duration-300 hover:bg-white/5 hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            مشاهده فروشگاه
          </Link>
          <p className="pt-3 text-center text-[10px] text-muted-foreground/50">نسخه نمایشی ۰٫۱</p>
        </div>
      </aside>

      {/* Fixed topbar — starts where the sidebar ends on desktop */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-white/5 bg-[#151311]/85 px-4 backdrop-blur-md lg:right-64 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="باز کردن منو"
            onClick={() => {
              setNavOpen(true);
            }}
            className="size-9 text-foreground hover:bg-white/5 hover:text-foreground lg:hidden"
          >
            <Menu className="size-4.5" />
          </Button>
          <nav aria-label=" breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
            <span className="hidden text-muted-foreground sm:inline">پدر ژپتو</span>
            <ChevronLeft className="hidden size-3.5 shrink-0 text-muted-foreground/50 sm:inline" />
            <span className="truncate font-extrabold text-foreground">
              {active?.label ?? "پیشخوان"}
            </span>
          </nav>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2.5 rounded-full border border-white/5 bg-white/[0.03] py-1 pe-3 ps-1 transition-colors duration-300 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-primary to-primary-soft text-xs font-extrabold text-primary-foreground">
                م
              </span>
              <span className="hidden text-start leading-tight sm:block">
                <span className="block text-xs font-bold text-foreground">مدیر پدر ژپتو</span>
                <span dir="ltr" className="block text-[10px] text-muted-foreground">
                  {user.phone}
                </span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-xs font-bold">مدیر پدر ژپتو</span>
              <span dir="ltr" className="text-[11px] font-normal text-muted-foreground">
                {user.phone}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                toast.info("پروفایل مدیر در گام‌های بعدی ساخته می‌شود.");
              }}
            >
              <UserRound />
              پروفایل
            </DropdownMenuItem>
            <Separator className="bg-white/5" />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                // Unified logout: drops the shared session (admin + storefront).
                logout();
                toast.success("از حساب مدیر خارج شدید.");
                navigate({ to: "/" });
              }}
            >
              <LogOut />
              خروج از حساب
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Content offset: topbar height + sidebar width (right, RTL) */}
      <main className="min-h-screen pt-16 lg:pr-64">
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
