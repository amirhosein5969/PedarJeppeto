import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  LogIn,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  ShoppingCart,
  User,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "./Logo";
import { useCart } from "./CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/queries";
import { toFa } from "@/lib/shop-data";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  to: string;
};

const navItems: NavItem[] = [
  { label: "خانه", to: "/" },
  { label: "فروشگاه", to: "/shop" },
  { label: "راهنمای خرید", to: "/guide" },
  { label: "درباره ما", to: "/about" },
  { label: "تماس با ما", to: "/contact" },
];

export function Header() {
  const { count } = useCart();
  const { data: categories } = useCategories();
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Hide the nav row on scroll-down, reveal it on scroll-up. The header is
  // position:fixed with a static flow placeholder below, so hiding the nav row
  // never changes document scroll height — no scroll-anchoring feedback loop.
  useEffect(() => {
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 10) setNavHidden(false);
      else if (y > lastScrollY && y > 80) setNavHidden(true);
      else if (y < lastScrollY) setNavHidden(false);
      lastScrollY = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/shop", search: { q: query || undefined } });
    setOpen(false);
    setSearchOpen(false);
  };

  // Clears the mock session, closes any open header panels, and sends the
  // shopper home — never leaves a stale menu over the page.
  const handleLogout = () => {
    logout();
    setOpen(false);
    setSearchOpen(false);
    toast.success("با موفقیت از حساب خارج شدید.");
    navigate({ to: "/" });
  };

  const NavLink = ({ item }: { item: NavItem }) => (
    <Link
      to={item.to}
      className="group/link relative flex items-center gap-1.5 px-4 py-2 text-base font-medium whitespace-nowrap text-foreground/85 transition-colors duration-500 hover:text-primary-soft"
      activeProps={{ className: "text-primary-soft" }}
    >
      {item.label}
      <span className="absolute -bottom-1.5 left-0 h-[1.5px] w-full origin-center scale-x-0 bg-primary transition-transform duration-500 ease-out group-hover/link:scale-x-100" />
    </Link>
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[100] w-full rounded-b-2xl border-x border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4">
          {/* Row 1: brand, search, actions */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-2.5 sm:gap-3 sm:py-2">
            <Link
              to="/"
              className="flex items-center justify-center"
              aria-label="پدر ژپتو — صفحه‌ی نخست"
            >
              <Logo size={64} glow />
            </Link>

            {/* Center: full search from tablet up, icon-triggered panel on mobile */}
            <div className="min-w-0">
              <form onSubmit={submit} className="relative mx-auto hidden w-full max-w-2xl sm:block">
                <Search
                  size={18}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="جستجوی محصول…"
                  className="h-10 w-full rounded-full border border-white/5 bg-[#25221e] pr-10 pl-4 text-sm outline-none transition-colors placeholder:text-foreground/60 focus:border-primary sm:text-base"
                />
              </form>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="grid size-9 place-items-center rounded-lg border border-border bg-card sm:hidden"
                aria-label="جستجو"
              >
                {searchOpen ? <X size={18} /> : <Search size={18} />}
              </button>
              <Link
                to="/cart"
                className="relative grid size-9 place-items-center rounded-lg transition-colors hover:text-primary sm:size-10"
                aria-label="سبد خرید"
              >
                <ShoppingCart size={20} className="text-foreground" />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {toFa(count)}
                  </span>
                )}
              </Link>
              <div className="hidden h-6 w-px bg-border sm:block" />
              {isLoading || !user ? (
                <Link
                  to="/auth"
                  className="hidden items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-sm font-medium whitespace-nowrap text-foreground/90 transition-colors hover:bg-white/5 sm:flex"
                >
                  <LogIn size={15} />
                  ورود به حساب کاربری
                </Link>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="حساب کاربری"
                      className="hidden items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-sm font-medium whitespace-nowrap text-foreground/90 transition-colors hover:bg-white/5 sm:flex"
                    >
                      <User size={15} />
                      حساب کاربری
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="z-[200] w-56 rounded-xl border-white/10 bg-[#1a1714]/95 backdrop-blur-md"
                  >
                    <DropdownMenuLabel className="flex flex-col items-start gap-0.5 px-3 py-2.5">
                      <span className="text-sm font-bold text-foreground">حساب کاربری</span>
                      {user.phone && (
                        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                          {user.phone}
                        </span>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem className="gap-2.5" onClick={() => navigate({ to: "/profile/orders" })}>
                      <ShoppingCart size={15} />
                      سفارش‌های من
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2.5"
                      onClick={() => navigate({ to: "/profile/account" })}
                    >
                      <UserRound size={15} />
                      پروفایل
                    </DropdownMenuItem>
                    {user.role === "admin" && (
                      <DropdownMenuItem
                        className="gap-2.5 font-bold text-primary-soft focus:text-primary-soft"
                        onClick={() => navigate({ to: "/admin" })}
                      >
                        <ShieldCheck size={15} />
                        پنل مدیریت
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem
                      className="gap-2.5 text-destructive focus:text-destructive"
                      onClick={handleLogout}
                    >
                      <LogOut size={15} />
                      خروج از حساب
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {user && (
                <button
                  className="hidden size-10 place-items-center rounded-lg transition-colors hover:text-primary sm:grid"
                  aria-label="اعلان‌ها"
                >
                  <Bell size={20} />
                </button>
              )}
              <button
                onClick={() => setOpen((v) => !v)}
                className="grid size-9 place-items-center rounded-lg border border-border bg-card sm:size-10 lg:hidden"
                aria-label="منو"
              >
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {/* Sub-header: collapses smoothly on scroll. The header is fixed (out of
            flow), so collapsing it never changes document scroll height — the
            threshold cannot re-trigger itself (no jitter loop). */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none",
              navHidden
                ? "max-h-0 -translate-y-2 py-0 opacity-0 pointer-events-none"
                : "max-h-16 translate-y-0 py-1.5 opacity-100 lg:overflow-visible",
            )}
            aria-hidden={navHidden}
          >
            <nav>
              <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-t border-white/5 lg:overflow-visible">
                {navItems.map((item) => (
                  <NavLink key={item.label} item={item} />
                ))}
              </div>
            </nav>
          </div>

          {/* Mobile search panel */}
          {searchOpen && (
            <form onSubmit={submit} className="relative border-t border-border/60 py-2 sm:hidden">
              <Search
                size={16}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجوی محصول…"
                autoFocus
                className="h-11 w-full rounded-xl border border-border bg-card pr-9 pl-3 text-base outline-none focus:border-primary"
              />
            </form>
          )}

          {/* Mobile menu */}
          {open && (
            <nav className="mt-2 mb-3 grid gap-1 rounded-xl border border-border bg-card p-2 lg:hidden">
              <div className="px-3 py-2 text-sm font-bold text-foreground">دسته‌بندی‌ها</div>
              {categories?.map((c) => (
                <Link
                  key={c.slug}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-base font-semibold text-foreground transition-colors hover:bg-accent hover:text-primary-soft"
                >
                  {c.name}
                </Link>
              ))}
              <div className="my-1 h-px bg-border" />
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-base font-semibold text-foreground transition-colors hover:bg-accent hover:text-primary-soft"
                >
                  {item.label}
                </Link>
              ))}
              {isLoading || !user ? (
                <Link
                  to="/auth"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-base font-semibold text-primary"
                >
                  ورود به حساب کاربری
                </Link>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2.5 text-sm">
                    <span className="font-semibold text-foreground">حساب کاربری</span>
                    <span dir="ltr" className="font-mono text-xs font-bold text-muted-foreground">
                      {user.phone}
                    </span>
                  </div>
                  <Link
                    to="/profile/account"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-base font-semibold text-foreground transition-colors hover:bg-accent hover:text-primary-soft"
                  >
                    پروفایل من
                  </Link>
                  <Link
                    to="/profile/orders"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-base font-semibold text-foreground transition-colors hover:bg-accent hover:text-primary-soft"
                  >
                    تاریخچه سفارشات
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-right text-base font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut size={16} />
                    خروج از حساب
                  </button>
                </>
              )}
            </nav>
          )}
        </div>
      </header>

      {/* Placeholder: the fixed header is out of flow, so this reserves its
          expanded height (84/80 top row — 64px glow logo + padding — plus the
          53 nav row + 1px border) so the page content is never covered at the
          top. It is static — the header collapsing on scroll never moves page
          content. */}
      <div aria-hidden="true" className="h-[138px] shrink-0 sm:h-[134px]" />
    </>
  );
}
