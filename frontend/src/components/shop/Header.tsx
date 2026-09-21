import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
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
import { AnnouncementBar, DEFAULT_ANNOUNCEMENTS } from "./AnnouncementBar";
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

/** Tier 3 links — split around the centered "دسته‌بندی محصولات" dropdown. */
const navBefore: NavItem[] = [
  { label: "خانه", to: "/" },
  { label: "فروشگاه", to: "/shop" },
];
const navAfter: NavItem[] = [
  { label: "راهنمای خرید", to: "/guide" },
  { label: "درباره ما", to: "/about" },
  { label: "تماس با ما", to: "/contact" },
];

/** Premium underline that grows from the center on hover (shared style). */
const GROW_UNDERLINE =
  "absolute -bottom-0.5 left-0 h-[2px] w-full origin-center scale-x-0 rounded-full " +
  "bg-linear-to-l from-primary-soft to-primary/60 transition-transform duration-300 ease-out";

export function Header() {
  const { count } = useCart();
  const { data: categories } = useCategories();
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);

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

  // Clears the session, closes any open header panels, and sends the shopper
  // home — never leaves a stale menu over the page.
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
      className="group/link relative flex items-center whitespace-nowrap px-3.5 py-1.5 text-[15px] font-bold text-foreground/80 transition-colors duration-300 hover:text-primary-soft"
      activeProps={{ className: "relative flex items-center whitespace-nowrap px-3.5 py-1.5 text-[15px] font-bold text-primary-soft" }}
    >
      {item.label}
      <span aria-hidden="true" className={cn(GROW_UNDERLINE, "group-hover/link:scale-x-100")} />
    </Link>
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[100] w-full rounded-b-2xl border-x border-b border-primary/10 bg-background/85 shadow-[0_14px_34px_-16px_rgba(0,0,0,0.55)] backdrop-blur-md">
        {/* Tier 1 — announcement bar (admin-panel ready, see AnnouncementBar) */}
        <AnnouncementBar items={DEFAULT_ANNOUNCEMENTS} />

        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4">
          {/* Tier 2 — brand / search / actions.
              flex-row-reverse: in this RTL document the DOM order (brand,
              search, actions) renders visually LEFT → CENTER → RIGHT. */}
          <div className="flex flex-row-reverse items-center gap-2.5 py-2.5 sm:gap-4 sm:py-2">
            {/* Brand — the untouched glow Logo, visually on the left */}
            <Link
              to="/"
              className="flex shrink-0 items-center justify-center"
              aria-label="پدر ژپتو — صفحه‌ی نخست"
            >
              <Logo size={85} glow />
            </Link>

            {/* Center: wide pill search (tablet & up) */}
            <div className="min-w-0 flex-1">
              <form onSubmit={submit} className="relative mx-auto hidden w-full max-w-2xl sm:block">
                <Search
                  size={18}
                  strokeWidth={1.8}
                  className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-primary-soft/50"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="search"
                  placeholder="دنبال چه محصولی هستید؟ مثل تخته سرو…"
                  className="h-11 w-full rounded-full border border-primary/15 bg-linear-to-b from-[#2e2416] to-[#251c10] pr-11 pl-5 text-sm text-foreground shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)] outline-none transition-all duration-300 placeholder:text-foreground/40 focus:border-primary/50 focus:ring-2 focus:ring-primary/25"
                />
              </form>
            </div>

            {/* Right: user actions. DOM order in this RTL flex row reads
                right→left, so the hamburger ends up furthest right and the
                mobile search toggle sits next to the search field. */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setOpen((v) => !v)}
                className="grid size-10 place-items-center rounded-full border border-primary/15 bg-card text-foreground/85 transition-colors duration-300 hover:border-primary/40 lg:hidden"
                aria-label="منو"
              >
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>

              <Link
                to="/cart"
                className="relative flex items-center gap-2 rounded-full border border-primary/15 bg-card py-2 pr-3 pl-3.5 transition-colors duration-300 hover:border-primary/40"
                aria-label="سبد خرید"
              >
                <span className="relative inline-flex">
                  <ShoppingCart
                    size={20}
                    strokeWidth={2.2}
                    fill="currentColor"
                    fillOpacity={0.12}
                    className="text-foreground"
                  />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-primary-foreground shadow-glow">
                      {toFa(count)}
                    </span>
                  )}
                </span>
                <span className="hidden text-xs font-bold text-foreground/85 lg:block">سبد خرید</span>
              </Link>

              <div className="hidden h-6 w-px bg-primary/15 lg:block" />

              {isLoading || !user ? (
                <Link
                  to="/auth"
                  className="hidden items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-bold whitespace-nowrap text-primary-soft transition-all duration-300 hover:border-primary/50 hover:bg-primary/20 sm:flex"
                >
                  <User size={16} strokeWidth={1.8} />
                  ورود / ثبت‌نام
                </Link>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="حساب کاربری من"
                      className="hidden items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-bold whitespace-nowrap text-primary-soft transition-all duration-300 hover:border-primary/50 hover:bg-primary/20 sm:flex"
                    >
                      <UserRound size={16} strokeWidth={1.8} />
                      حساب کاربری من
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
                  className="hidden size-10 place-items-center rounded-full text-foreground/70 transition-colors duration-300 hover:text-primary-soft sm:grid"
                  aria-label="اعلان‌ها"
                >
                  <Bell size={20} />
                </button>
              )}

              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="grid size-10 place-items-center rounded-full border border-primary/15 bg-card text-foreground/85 transition-colors duration-300 hover:border-primary/40 sm:hidden"
                aria-label="جستجو"
              >
                {searchOpen ? <X size={18} /> : <Search size={18} />}
              </button>
            </div>
          </div>

          {/* Tier 3 — perfectly centered navigation row (collapses on scroll) */}
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
              <div className="no-scrollbar flex items-center justify-center gap-0.5 overflow-x-auto border-t border-primary/10 sm:gap-1">
                {navBefore.map((item) => (
                  <NavLink key={item.label} item={item} />
                ))}

                {/* Category dropdown with chevron */}
                <DropdownMenu onOpenChange={setCatsOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="group/cat relative flex items-center gap-1 whitespace-nowrap px-3.5 py-1.5 text-[15px] font-bold text-foreground/80 transition-colors duration-300 hover:text-primary-soft"
                    >
                      دسته‌بندی محصولات
                      <ChevronDown
                        size={14}
                        strokeWidth={2.4}
                        className={cn(
                          "transition-transform duration-300",
                          catsOpen && "rotate-180",
                        )}
                      />
                      <span
                        aria-hidden="true"
                        className={cn(GROW_UNDERLINE, "group-hover/cat:scale-x-100")}
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="center"
                    className="z-[200] w-60 rounded-xl border-white/10 bg-[#1a1714]/95 backdrop-blur-md"
                  >
                    {(categories ?? []).map((c) => (
                      <DropdownMenuItem
                        key={c.slug}
                        onClick={() => navigate({ to: "/category/$slug", params: { slug: c.slug } })}
                      >
                        {c.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {navAfter.map((item) => (
                  <NavLink key={item.label} item={item} />
                ))}
              </div>
            </nav>
          </div>

          {/* Mobile search panel */}
          {searchOpen && (
            <form onSubmit={submit} className="relative border-t border-primary/10 py-2 sm:hidden">
              <Search
                size={16}
                strokeWidth={1.8}
                className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-foreground/40"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="دنبال چه محصولی هستید؟ مثل تخته سرو…"
                autoFocus
                className="h-11 w-full rounded-full border border-border bg-card pr-11 pl-4 text-base outline-none transition-colors focus:border-primary"
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
              {navBefore.concat(navAfter).map((item) => (
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
                  ورود / ثبت‌نام
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
          expanded height — tier 1 (29px) + tier 2 (105/101px, 85px glow logo) +
          tier 3 (45px nav row) — so page content is never covered at the top.
          It is static: the nav row collapsing on scroll never moves content. */}
      <div aria-hidden="true" className="h-[182px] shrink-0 sm:h-[178px]" />
    </>
  );
}