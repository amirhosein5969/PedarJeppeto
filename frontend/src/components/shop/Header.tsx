import { Link, useNavigate } from "@tanstack/react-router";
import {
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
import { AnnouncementBar, type AnnouncementItem } from "./AnnouncementBar";
import { Logo } from "./Logo";
import { MiniCart } from "./MiniCart";
import { NotificationsPopover } from "./NotificationsPopover";
import { useCart } from "./CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useCategories, useSettings } from "@/hooks/queries";
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

/**
 * Tier 3 nav links: a thin amber line that grows from the CENTER via an
 * ::after pseudo-element (w-0 → w-full, anchored at left-1/2). On hover the
 * text pops from 75% opacity to full; the active route stays lit + underlined.
 */
const NAV_COMMON =
  "relative flex items-center whitespace-nowrap px-3.5 py-1.5 text-[15px] font-bold " +
  "transition-colors duration-300 " +
  "after:absolute after:-bottom-0.5 after:left-1/2 after:h-[2px] after:w-0 " +
  "after:-translate-x-1/2 after:rounded-full " +
  "after:bg-linear-to-l after:from-primary-soft after:to-primary/60 " +
  "after:transition-all after:duration-300 after:ease-out";
const NAV_IDLE = cn(NAV_COMMON, "text-foreground/75 hover:text-foreground hover:after:w-full");
const NAV_ACTIVE = cn(NAV_COMMON, "text-primary-soft after:w-full");

export function Header() {
  const { count } = useCart();
  const { data: categories } = useCategories();
  const { data: storeSettings } = useSettings();
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

  // Tier 1, item 1 — fully dynamic: the first announcement is whatever the
  // admin stored in StoreSettings (announcement_text); until the live value
  // arrives, fall back to the default free-shipping line.
  const announcementItems: AnnouncementItem[] = [
    {
      id: "store-announcement",
      text:
        storeSettings?.announcementText?.trim() || "ارسال رایگان برای خریدهای بالای ۱ میلیون تومان",
      icon: "truck",
    },
    { id: "handmade", text: "ساخت دست‌ساز با چوب طبیعی", icon: "leaf" },
  ];

  const NavLink = ({ item }: { item: NavItem }) => (
    <Link to={item.to} className={NAV_IDLE} activeProps={{ className: NAV_ACTIVE }}>
      {item.label}
    </Link>
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[100] w-full rounded-b-2xl border-x border-b border-primary/10 bg-background/85 shadow-[0_14px_34px_-16px_rgba(0,0,0,0.55)] backdrop-blur-md">
        {/* Tier 1 — dynamic announcement bar (first item from StoreSettings) */}
        <AnnouncementBar items={announcementItems} />

        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4">
          {/* Tier 2 — brand / search / actions, standard RTL:
              DOM order (brand → search → actions) renders RIGHT → LEFT, so
              the logo sits on the far right, search in the center and the
              action cluster (cart, account, bell) on the far left. */}
          <div className="flex items-center gap-2.5 py-2.5 sm:gap-4 sm:py-2">
            {/* Brand — glow Logo, far right. Compact height on phones so the
                tier-2 row stays a slim native-app bar; full size from sm up. */}
            <Link
              to="/"
              className="flex shrink-0 items-center justify-center"
              aria-label="پدر ژپتو — صفحه‌ی نخست"
            >
              <span className="sm:hidden">
                <Logo size={52} glow />
              </span>
              <span className="hidden sm:block">
                <Logo size={85} glow />
              </span>
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

            {/* Far-left action cluster. DOM order in this RTL row reads
                right→left: cart (nearest the search), divider, account,
                bell, then the mobile-only hamburger / search toggles at the
                very left edge. */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {/* Cart + hover mini-cart (group/mini hover bridge) */}
              <div className="group/mini relative">
                <Link
                  to="/cart"
                  className="flex items-center gap-2 rounded-full border border-primary/15 bg-card py-2 pr-3 pl-3.5 transition-colors duration-300 hover:border-primary/40"
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
                      <span
                        className={cn(
                          "absolute -top-1.5 -right-1.5 grid place-items-center rounded-full bg-primary font-bold leading-none text-primary-foreground shadow-glow ring-2 ring-background",
                          count > 9 ? "h-4 w-5 px-0.5 text-[9px]" : "h-4 w-4 text-[10px]",
                        )}
                      >
                        {toFa(count)}
                      </span>
                    )}
                  </span>
                  <span className="hidden text-xs font-bold text-foreground/85 lg:block">
                    سبد خرید
                  </span>
                </Link>
                <MiniCart />
              </div>

              <div className="hidden h-6 w-px bg-primary/15 lg:block" />

              {isLoading || !user ? (
                <Link
                  to="/auth"
                  className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-2 text-sm font-bold whitespace-nowrap text-primary-soft transition-all duration-300 hover:border-primary/50 hover:bg-primary/20 sm:px-4"
                  aria-label="ورود / ثبت‌نام"
                >
                  <User size={16} strokeWidth={1.8} />
                  <span className="hidden sm:inline">ورود / ثبت‌نام</span>
                </Link>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="حساب کاربری من"
                      className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-2 text-sm font-bold whitespace-nowrap text-primary-soft transition-all duration-300 hover:border-primary/50 hover:bg-primary/20 sm:px-4"
                    >
                      <UserRound size={16} strokeWidth={1.8} />
                      <span className="hidden sm:inline">حساب کاربری من</span>
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
                    <DropdownMenuItem
                      className="gap-2.5"
                      onClick={() => navigate({ to: "/profile/orders" })}
                    >
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

              <NotificationsPopover />

              <button
                onClick={() => setOpen((v) => !v)}
                className="grid size-10 place-items-center rounded-full border border-primary/15 bg-card text-foreground/85 transition-colors duration-300 hover:border-primary/40 md:hidden"
                aria-label="منو"
              >
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>

              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="grid size-10 place-items-center rounded-full border border-primary/15 bg-card text-foreground/85 transition-colors duration-300 hover:border-primary/40 sm:hidden"
                aria-label="جستجو"
              >
                {searchOpen ? <X size={18} /> : <Search size={18} />}
              </button>
            </div>
          </div>

          {/* Tier 3 — perfectly centered navigation row (tablet & up only;
              phones get the hamburger menu). Collapses on scroll-down. */}
          <div
            className={cn(
              "hidden overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none md:block",
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
                    <button type="button" className={cn(NAV_IDLE, "gap-1")}>
                      دسته‌بندی محصولات
                      <ChevronDown
                        size={14}
                        strokeWidth={2.4}
                        className={cn(
                          "transition-transform duration-300",
                          catsOpen && "rotate-180",
                        )}
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
                        onClick={() =>
                          navigate({ to: "/category/$slug", params: { slug: c.slug } })
                        }
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

          {/* Mobile menu (phones only — inline links live in tier 3 from md up) */}
          {open && (
            <nav className="mt-2 mb-3 grid gap-1 rounded-xl border border-border bg-card p-2 md:hidden">
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
          expanded height — phones: tier 1 (29px) + tier 2 only (52px compact
          logo + padding, ~106px; nav lives in the hamburger); tablet (sm):
          full 85px logo without the nav row (~135px); desktop (md+): + tier 3
          (45px nav row) = ~178px. It is static: the nav row collapsing on
          scroll never moves content. */}
      <div aria-hidden="true" className="h-[106px] shrink-0 sm:h-[135px] md:h-[178px]" />
    </>
  );
}
