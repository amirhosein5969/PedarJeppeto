import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Coins,
  Package,
  PackageX,
  ReceiptText,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UserRoundPlus,
  Wallet,
  XCircle,
} from "lucide-react";

import { orderTotal } from "@/lib/admin-orders";
import { adminUnitProfit } from "@/lib/admin-products";
import {
  useActivityFeed,
  useAdminCatalog,
  useAdminOrders,
  useSales7d,
  useTraffic7d,
} from "@/hooks/queries";
import { toToman } from "@/lib/api-map";
import { formatPrice, toFa } from "@/lib/shop-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({
    meta: [{ title: "پیشخوان مدیریت | پدر ژپتو" }],
  }),
});

/** Literal form of the theme token --primary: oklch(0.72 0.145 62).
 * Recharts paints SVG attributes, so it needs a concrete color value. */
const BRAND = "#e48d00";

/** Muted stone for the traffic series — keeps the panel monochromatic. */
const TRAFFIC = "#a8a29e";

/** Persian weekday labels indexed by `Date.getDay()` (0 = Sunday). */
const WEEKDAY_FA = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه"];

/**
 * Compact relative timestamp for the activity feed ("۳ دقیقه پیش" / "دیروز").
 * The backend sends ISO-8601; we only need a human "since" phrasing.
 */
function relTime(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMin < 1) return "همین الان";
  if (diffMin < 60) return `${toFa(diffMin)} دقیقه پیش`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `${toFa(hours)} ساعت پیش`;
  const days = Math.round(hours / 24);
  if (days === 1) return "دیروز";
  return `${toFa(days)} روز پیش`;
}

type FeedTone = "primary" | "emerald" | "rose" | "amber" | "sky";

type FeedItem = {
  key: string;
  icon: typeof ShoppingCart;
  text: string;
  time: string;
  tone: FeedTone;
};

const FEED_TONE: Record<FeedTone, string> = {
  primary: "text-primary",
  emerald: "text-emerald-400",
  rose: "text-rose-400",
  amber: "text-amber-400",
  sky: "text-sky-400",
};

type DashboardStats = {
  revenue: number;
  totalCost: number;
  totalProfit: number;
  activeOrders: number;
  aov: number;
  outOfStock: number;
};

type TopSeller = { id: string; title: string; image: string; qty: number };

function AdminDashboard() {
  // Everything on this panel is live: sales + traffic from
  // GET /analytics/{sales,traffic} (traffic = Redis page-view counters) and
  // the activity feed from GET /analytics/activities.
  const { data: orders } = useAdminOrders();
  const { data: catalog } = useAdminCatalog();
  const { data: sales } = useSales7d();
  const { data: traffic } = useTraffic7d();
  const { data: feed, isPending: feedPending } = useActivityFeed();

  const stats = useMemo<DashboardStats | null>(() => {
    if (!orders || !catalog) return null;
    const products = catalog.products;
    const billable = orders.filter((o) => o.status !== "cancelled");
    const revenue = billable.reduce((sum, o) => sum + orderTotal(o), 0);
    // Cost of goods sold: quantities actually sold (non-cancelled orders)
    // priced at each product's workshop cost (final price − profit margin).
    const marginById = new Map(products.map((p) => [p.id, adminUnitProfit(p)]));
    const totalCost = billable.reduce(
      (sum, o) =>
        sum +
        o.items.reduce(
          (s, item) =>
            s + Math.max(0, item.unitPrice - (marginById.get(item.productId) ?? 0)) * item.qty,
          0,
        ),
      0,
    );
    return {
      revenue,
      totalCost,
      totalProfit: revenue - totalCost,
      activeOrders: orders.filter((o) => o.status === "pending" || o.status === "processing")
        .length,
      aov: billable.length > 0 ? Math.round(revenue / billable.length) : 0,
      outOfStock: products.filter((p) => !p.inStock).length,
    };
  }, [orders, catalog]);

  const topSellers = useMemo<TopSeller[]>(() => {
    if (!orders || !catalog) return [];
    // Units sold per product across all non-cancelled orders.
    const sold = new Map<string, { title: string; qty: number }>();
    for (const order of orders) {
      if (order.status === "cancelled") continue;
      for (const item of order.items) {
        const entry = sold.get(item.productId);
        if (entry) entry.qty += item.qty;
        else sold.set(item.productId, { title: item.title, qty: item.qty });
      }
    }
    return [...sold.entries()]
      .sort(([, a], [, b]) => b.qty - a.qty)
      .slice(0, 5)
      .map(([id, v]) => ({
        id,
        title: v.title,
        qty: v.qty,
        image: catalog.products.find((p) => p.id === id)?.images[0] ?? "",
      }));
  }, [orders, catalog]);

  // Sales chart — live 7-day revenue (money string → toman, ISO date → weekday).
  const salesData = useMemo(
    () =>
      (sales ?? []).map((d) => ({
        day: WEEKDAY_FA[new Date(`${d.date}T00:00:00`).getDay()] ?? "",
        revenue: toToman(d.total),
      })),
    [sales],
  );

  // Traffic chart — live 7-day page views from the Redis counters
  // (ISO date → weekday label for the X axis).
  const trafficData = useMemo(
    () =>
      (traffic ?? []).map((d) => ({
        day: WEEKDAY_FA[new Date(`${d.date}T00:00:00`).getDay()] ?? "",
        pageViews: d.views,
      })),
    [traffic],
  );

  // Recent-activity timeline — the three live event kinds, timestamped events
  // newest first; current-state stock alerts follow (they have no timestamp).
  const feedItems = useMemo<FeedItem[]>(() => {
    if (!feed) return [];
    const items: (FeedItem & { at: number })[] = [];
    for (const o of feed.orders) {
      items.push({
        key: `order-${o.order_number}`,
        icon: o.status === "cancelled" ? XCircle : ShoppingCart,
        text:
          o.status === "cancelled"
            ? `سفارش ${o.order_number} توسط ${o.customer} لغو شد`
            : `ثبت سفارش ${o.order_number} توسط ${o.customer} به مبلغ ${formatPrice(toToman(o.total))}`,
        time: relTime(o.created_at),
        tone: o.status === "cancelled" ? "rose" : "primary",
        at: new Date(o.created_at).getTime(),
      });
    }
    for (const u of feed.users) {
      items.push({
        key: `user-${u.created_at}`,
        icon: UserRoundPlus,
        text: `مشتری جدید ثبت‌نام کرد: ${u.full_name}`,
        time: relTime(u.created_at),
        tone: "sky",
        at: new Date(u.created_at).getTime(),
      });
    }
    items.sort((a, b) => b.at - a.at);
    const timeline = items.map(({ at: _at, ...item }) => item);
    for (const s of feed.low_stock) {
      timeline.push({
        key: `stock-${s.product_id}`,
        icon: PackageX,
        text:
          s.stock_count === 0
            ? `اتمام موجودی: ${s.title}`
            : `کاهش موجودی: ${s.title} — ${toFa(s.stock_count)} عدد باقی‌مانده`,
        time: "وضعیت فعلی انبار",
        tone: s.stock_count === 0 ? "rose" : "amber",
      });
    }
    return timeline;
  }, [feed]);

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">پیشخوان مدیریت</h1>
          <p className="mt-1 text-xs text-muted-foreground">نمای کلی عملکرد فروشگاه پدر ژپتو</p>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary-soft">
          آمار زنده
        </span>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-3">
        <StatCard
          label="درآمد کل"
          value={stats ? formatPrice(stats.revenue) : "—"}
          hint="+۱۲.۵٪ ماه گذشته"
          trend="up"
          icon={ReceiptText}
        />
        <StatCard
          label="هزینه کل (بهای تمام‌شده فروش)"
          value={stats ? formatPrice(stats.totalCost) : "—"}
          hint="بر پایه تعداد فروش‌رفته"
          trend="up"
          icon={Wallet}
        />
        <StatCard
          label="سود کل"
          value={stats ? formatPrice(stats.totalProfit) : "—"}
          hint="درآمد کل − هزینه کل"
          trend="up"
          icon={Coins}
        />
        <StatCard
          label="سفارشات فعال"
          value={stats ? toFa(stats.activeOrders) : "—"}
          hint="+۸.۳٪ این هفته"
          trend="up"
          icon={ShoppingCart}
        />
        <StatCard
          label="میانگین ارزش سفارش"
          value={stats ? formatPrice(stats.aov) : "—"}
          hint="+۴.۱٪ ماه گذشته"
          trend="up"
          icon={TrendingUp}
        />
        <StatCard
          label="محصولات ناموجود"
          value={stats ? toFa(stats.outOfStock) : "—"}
          hint="−۲ این هفته"
          trend="down"
          icon={Package}
        />
      </div>

      {/* Store stats — single column: each chart gets the full row width */}
      <div className="mt-6 grid grid-cols-1 gap-6">
        {/* Revenue chart (full width) */}
        <div className="rounded-xl border border-white/5 bg-[#151311] p-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-foreground">نمودار فروش</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">۷ روز گذشته</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: BRAND }} />
              <span className="text-[11px] font-bold text-muted-foreground">
                فروش روزانه (تومان)
              </span>
            </div>
          </div>
          {/* dir=ltr keeps the chart geometry standard; labels stay Persian */}
          <div dir="ltr" className="mt-4 h-64 text-muted-foreground">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  tickMargin={10}
                />
                <YAxis
                  width={48}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  tickFormatter={(value: number) => `${toFa(Math.round(value / 1_000_000))}م`}
                />
                <Tooltip
                  content={<RevenueTooltip />}
                  cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={BRAND}
                  strokeWidth={2}
                  fill="url(#adminRevenueFill)"
                  activeDot={{ r: 4, fill: BRAND, stroke: "#151311", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Traffic chart (full width) */}
        <div className="rounded-xl border border-white/5 bg-[#151311] p-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-foreground">ترافیک وبسایت</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                ۷ روز گذشته — شمارش زنده از سرور
              </p>
            </div>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: TRAFFIC }} />
              <span className="text-[11px] font-bold text-muted-foreground">بازدید صفحه</span>
            </span>
          </div>
          <div dir="ltr" className="mt-4 h-64 text-muted-foreground">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminTrafficFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TRAFFIC} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={TRAFFIC} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  tickMargin={10}
                />
                <YAxis
                  width={44}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  tickFormatter={(value: number) => toFa(value)}
                />
                <Tooltip
                  content={<TrafficTooltip />}
                  cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="pageViews"
                  stroke={TRAFFIC}
                  strokeWidth={2}
                  fill="url(#adminTrafficFill)"
                  activeDot={{ r: 4, fill: TRAFFIC, stroke: "#151311", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live feed + best sellers — two-up on wide screens */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-[#151311] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-foreground">فعالیت‌های اخیر</h2>
              <span className="flex size-2" aria-hidden>
                <span className="absolute inline-flex size-2 animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
            </div>

            {feedItems.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">
                {feedPending ? "در حال بارگذاری فعالیت‌ها…" : "هنوز فعالیتی ثبت نشده است."}
              </p>
            ) : (
              <ul className="mt-5">
                {feedItems.map((event, index) => {
                  const last = index === feedItems.length - 1;
                  return (
                    <li key={event.key} className="flex gap-3.5">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-full border border-white/5 bg-white/[0.03]",
                            FEED_TONE[event.tone],
                          )}
                        >
                          <event.icon className="size-4" />
                        </span>
                        {!last && <span className="my-1 w-px flex-1 bg-white/5" />}
                      </div>
                      <div className={cn("min-w-0", !last && "pb-5")}>
                        <p className="text-xs font-bold leading-relaxed text-foreground/90">
                          {event.text}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground/70">{event.time}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-white/5 bg-[#151311] p-5 shadow-2xl">
            <h2 className="text-sm font-extrabold text-foreground">پرفروش‌ترین محصولات</h2>
            {topSellers.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">هنوز فروشی ثبت نشده است.</p>
            ) : (
              <ul className="mt-4 space-y-3.5">
                {topSellers.map((seller, index) => (
                  <li key={seller.id} className="flex items-center gap-3">
                    <span className="w-4 shrink-0 text-center text-[11px] font-extrabold text-muted-foreground/50">
                      {toFa(index + 1)}
                    </span>
                    <div className="size-10 shrink-0 overflow-hidden rounded-lg border border-white/5 bg-[#1c1916]">
                      {seller.image && (
                        <img
                          src={seller.image}
                          alt={seller.title}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      )}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-xs font-bold text-foreground/90">
                      {seller.title}
                    </p>
                    <span className="shrink-0 whitespace-nowrap text-[11px] font-bold text-primary-soft">
                      {toFa(seller.qty)} فروش
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  trend: "up" | "down";
  icon: typeof ReceiptText;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-xl border border-white/5 bg-[#151311] p-5 shadow-2xl transition-colors duration-300 hover:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-4 truncate text-xl font-extrabold text-foreground">{value}</p>
      <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400/90">
        <TrendIcon className="size-3.5" />
        {hint}
      </p>
    </div>
  );
}

type RevenueTooltipProps = {
  active?: boolean;
  payload?: { payload: { day: string; revenue: number } }[];
};

/** Dark minimal tooltip replacing the default Recharts one. */
function RevenueTooltip({ active, payload }: RevenueTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div
      dir="rtl"
      className="rounded-lg border border-white/10 bg-[#1c1916] px-3.5 py-2.5 shadow-2xl"
    >
      <p className="text-[11px] font-bold text-muted-foreground">{point.day}</p>
      <p className="mt-1 inline-flex items-center gap-2 text-xs font-extrabold text-primary-soft">
        <span className="size-2 rounded-full" style={{ backgroundColor: BRAND }} />
        {formatPrice(point.revenue)}
      </p>
    </div>
  );
}

type TrafficTooltipProps = {
  active?: boolean;
  payload?: { payload: { day: string; pageViews: number } }[];
};

function TrafficTooltip({ active, payload }: TrafficTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div
      dir="rtl"
      className="rounded-lg border border-white/10 bg-[#1c1916] px-3.5 py-2.5 shadow-2xl"
    >
      <p className="text-[11px] font-bold text-muted-foreground">{point.day}</p>
      <p className="mt-1 inline-flex items-center gap-2 text-xs font-extrabold text-foreground">
        <span className="size-2 rounded-full" style={{ backgroundColor: TRAFFIC }} />
        {toFa(point.pageViews)} بازدید صفحه
      </p>
    </div>
  );
}
