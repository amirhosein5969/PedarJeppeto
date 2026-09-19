import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  Droplet,
  Eye,
  Gift,
  MoreVertical,
  Printer,
  Search,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import {
  ORDER_STATUS_META,
  ORDER_STATUSES,
  customerPurchaseNumber,
  lineTotal,
  orderAgeDays,
  orderAgeLabel,
  orderSubtotal,
  orderTotal,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/admin-orders";
import { useAdminOrders, useSettings, useUpdateOrderStatus } from "@/hooks/queries";
import { formatPrice, toFa } from "@/lib/shop-data";
import { cn } from "@/lib/utils";
import { useTableSort } from "@/lib/use-table-sort";
import { SortHead } from "@/components/admin/SortHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
  head: () => ({
    meta: [{ title: "مدیریت سفارشات | چوب‌کار" }],
  }),
});

/** Default workflow priority: pending orders bubble to the top. */
const STATUS_RANK: Record<OrderStatus, number> = {
  pending: 0,
  processing: 1,
  shipped: 2,
  delivered: 3,
  cancelled: 4,
};

/** Sort value per column — stable module-level fn keeps the memo cheap. */
const orderSortValue = (o: AdminOrder, key: string): string | number => {
  switch (key) {
    case "id":
      return o.dbId;
    case "customer":
      return o.customer;
    case "date":
      return o.date;
    case "age":
      return orderAgeDays(o);
    case "total":
      return orderTotal(o);
    case "status":
      return STATUS_RANK[o.status];
    default:
      return 0;
  }
};

/** The standalone printable invoice route (no AdminLayout chrome), keyed by dbId. */
const invoiceUrl = (dbId: number) => `/invoice/${dbId}`;

function AdminOrders() {
  const { data: liveOrders } = useAdminOrders();
  const { data: settings } = useSettings();
  const updateStatus = useUpdateOrderStatus();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [details, setDetails] = useState<AdminOrder | null>(null);

  // The API persists the shipping-method *id* + packaging *flag* only, so the
  // display title / gift-box price are resolved from live store settings.
  const orders: AdminOrder[] | null = useMemo(() => {
    if (!liveOrders) return null;
    return liveOrders.map((o) => ({
      ...o,
      shippingMethodTitle:
        settings?.shippingMethods.find((m) => m.id === o.shippingMethod)?.title ??
        o.shippingMethod,
      giftBoxPrice: o.giftBox ? (settings?.giftBoxPrice ?? 0) : 0,
    }));
  }, [liveOrders, settings]);

  const { sort, toggleSort, sorted } = useTableSort(orders, orderSortValue);

  const filtered = useMemo(() => {
    if (!sorted) return null;
    const q = query.trim();
    const lower = q.toLowerCase();
    const matches = sorted.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      return !q || o.id.toLowerCase().includes(lower) || o.customer.includes(q);
    });
    // No column sort active: keep the workflow priority (pending first,
    // then workflow stage, newest id first).
    if (!sort.key) {
      return [...matches].sort(
        (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (a.dbId < b.dbId ? 1 : -1),
      );
    }
    return matches;
  }, [sorted, query, statusFilter, sort.key]);

  /** Batch print: opens the printable stack in a new tab, inheriting the
   *  active status filter and search query. */
  const openBatchPrint = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    const q = query.trim();
    if (q) params.set("q", q);
    const qs = params.toString();
    window.open(`/invoice-batch${qs ? `?${qs}` : ""}`, "_blank", "noopener,noreferrer");
  };

  const changeStatus = (order: AdminOrder, status: OrderStatus) => {
    if (order.status === status) return;
    updateStatus.mutate(
      { id: order.dbId, status },
      {
        onSuccess: () => {
          // Keep an open details sheet in sync with the new status.
          setDetails((d) => (d && d.dbId === order.dbId ? { ...d, status } : d));
          toast.success(
            `وضعیت سفارش ${order.id} به «${ORDER_STATUS_META[status].label}» تغییر کرد.`,
          );
        },
        onError: (err) => {
          toast.error(`تغییر وضعیت سفارش ناموفق بود: ${err.message}`);
        },
      },
    );
  };

  return (
    <div>
      {/* Page header + order search */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">مدیریت سفارشات</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            پیگیری و پردازش سفارش‌های فروشگاه
            {orders ? ` — ${toFa(orders.length)} سفارش` : ""}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={openBatchPrint}
            className="h-10 shrink-0 border-white/10 bg-transparent font-bold text-foreground hover:bg-white/5"
          >
            <Printer className="size-4" />
            چاپ گروهی فاکتورها
          </Button>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="جستجو با شماره سفارش یا نام مشتری…"
              className="h-10 border-white/10 bg-[#1c1916] ps-9 placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
            />
          </div>
        </div>
      </div>

      {/* Status filter chips — the batch print inherits this filter */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <StatusChip
          label="همه"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        {ORDER_STATUSES.map((s) => (
          <StatusChip
            key={s}
            label={ORDER_STATUS_META[s].label}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          />
        ))}
      </div>

      {/* Orders table card — scrolls horizontally on narrow screens */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-white/5 bg-[#151311]">
        {filtered === null ? (
          <div className="grid min-h-64 place-items-center text-xs text-muted-foreground">
            بارگذاری سفارش‌ها…
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-10 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Search className="size-6" />
              </span>
              <p className="mt-4 text-sm font-bold text-foreground">نتیجه‌ای یافت نشد</p>
              <p className="mt-1 text-xs text-muted-foreground">
                شماره سفارش یا نام مشتری را دقیق‌تر وارد کنید.
              </p>
            </div>
          </div>
        ) : (
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <SortHead
                  label="شماره سفارش"
                  sortKey="id"
                  sort={sort}
                  onSort={toggleSort}
                  className="min-w-28"
                />
                <SortHead
                  label="نام مشتری"
                  sortKey="customer"
                  sort={sort}
                  onSort={toggleSort}
                  className="min-w-32"
                />
                <SortHead label="تاریخ ثبت" sortKey="date" sort={sort} onSort={toggleSort} />
                <SortHead
                  label="زمان سپری‌شده"
                  sortKey="age"
                  sort={sort}
                  onSort={toggleSort}
                  className="min-w-32"
                />
                <SortHead label="مبلغ کل" sortKey="total" sort={sort} onSort={toggleSort} />
                <SortHead label="وضعیت" sortKey="status" sort={sort} onSort={toggleSort} />
                <TableHead className="w-14 text-right text-xs font-bold text-muted-foreground">
                  عملیات
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="py-3.5">
                    <span dir="ltr" className="font-mono text-xs font-bold text-primary-soft">
                      {o.id}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap text-sm font-bold text-foreground">
                        {o.customer}
                      </span>
                      {orders && <LoyaltyBadge nth={customerPurchaseNumber(orders, o)} />}
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5 text-xs text-foreground/85">
                    <span dir="ltr">{o.date}</span>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <AgeCell order={o} />
                  </TableCell>
                  <TableCell className="py-3.5 text-xs font-extrabold text-foreground">
                    {formatPrice(orderTotal(o))}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <StatusPill status={o.status} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`عملیات سفارش ${o.id}`}
                          className="size-8 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="z-[200] border-white/10 bg-[#1a1714]"
                      >
                        <DropdownMenuItem
                          onClick={() => {
                            setDetails(o);
                          }}
                        >
                          <Eye />
                          مشاهده جزئیات
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            window.open(invoiceUrl(o.dbId), "_blank", "noopener,noreferrer");
                          }}
                        >
                          <Printer />
                          چاپ فاکتور
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/5" />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <ArrowLeftRight />
                            تغییر وضعیت
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="z-[200] border-white/10 bg-[#1a1714]">
                            {ORDER_STATUSES.map((status) => (
                              <DropdownMenuItem
                                key={status}
                                onClick={() => {
                                  changeStatus(o, status);
                                }}
                              >
                                <span
                                  className={`size-2 shrink-0 rounded-full ${ORDER_STATUS_META[status].dot}`}
                                />
                                {ORDER_STATUS_META[status].label}
                                {o.status === status && <Check className="ms-auto text-primary" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Order details sheet — slides from the left to avoid the RTL sidebar */}
      <Sheet
        open={details !== null}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      >
        <SheetContent
          side="left"
          className="z-[100] w-full overflow-y-auto border-white/5 bg-[#151311] sm:max-w-md"
        >
          <SheetHeader className="text-start">
            <SheetTitle className="text-foreground">
              جزئیات سفارش{" "}
              <span dir="ltr" className="font-mono text-primary-soft">
                {details?.id}
              </span>
            </SheetTitle>
            <SheetDescription className="text-xs">
              ثبت شده در {details?.date} توسط {details?.customer}
            </SheetDescription>
          </SheetHeader>

          {details && (
            <div className="space-y-4 px-4 pb-6 sm:px-6">
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3">
                <span className="text-xs text-muted-foreground">وضعیت فعلی</span>
                <StatusPill status={details.status} />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3">
                <span className="text-xs text-muted-foreground">سابقه‌ی خرید مشتری</span>
                {orders ? (
                  <LoyaltyBadge nth={customerPurchaseNumber(orders, details)} />
                ) : (
                  <span className="text-xs text-muted-foreground">…</span>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3">
                <span className="text-xs text-muted-foreground">روش ارسال</span>
                <span className="text-xs font-bold text-foreground">
                  {details.shippingMethodTitle || "—"}
                </span>
              </div>

              {/* Receiver information — the exact shipping block captured at checkout */}
              <div>
                <p className="text-xs font-extrabold text-primary-soft">اطلاعات گیرنده</p>
                <Separator className="mt-2 bg-white/5" />
                <div className="mt-3 space-y-2.5">
                  <DetailRow label="نام گیرنده" value={details.shippingDetails.name} />
                  <DetailRow label="شماره موبایل" value={details.shippingDetails.phone} ltr />
                  <DetailRow label="استان" value={details.shippingDetails.province} />
                  <DetailRow label="شهر" value={details.shippingDetails.city} />
                  <DetailRow
                    label="کد پستی"
                    value={details.shippingDetails.postalCode || "— (ارسال سریع)"}
                    ltr
                  />
                  <div className="rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3">
                    <span className="text-xs text-muted-foreground">نشانی</span>
                    <p className="mt-1.5 text-xs leading-6 font-bold text-foreground">
                      {details.shippingDetails.address}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-extrabold text-primary-soft">اقلام سفارش</p>
                <Separator className="mt-2 bg-white/5" />
                <ul className="mt-3 space-y-3">
                  {details.items.map((item) => (
                    <li
                      key={item.productId}
                      className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{item.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {toFa(item.qty)} عدد × {formatPrice(item.unitPrice)}
                        </p>
                        {/* Explicit care-oil state per product line */}
                        <p
                          className={cn(
                            "mt-1.5 flex items-center gap-1.5 text-[11px] font-bold",
                            item.careOilAdded ? "text-primary-soft" : "text-muted-foreground/60",
                          )}
                        >
                          <Droplet size={12} strokeWidth={2.25} />
                          {item.careOilAdded
                            ? `روغن جلا درخواست شده (+ ${formatPrice(item.careOilPrice)})`
                            : "روغن جلا: بدون درخواست"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-extrabold text-foreground">
                        {formatPrice(lineTotal(item))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Signature gift box — shown distinctly when requested */}
              {details.giftBox && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/[0.07] px-4 py-3">
                  <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Gift className="size-4 text-primary-soft" />
                    بسته‌بندی هدیه و جعبه چوبی
                  </span>
                  <span className="text-xs font-extrabold text-primary-soft">
                    {formatPrice(details.giftBoxPrice)}
                  </span>
                </div>
              )}

              <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/[0.07] px-4 py-3">
                <MoneyRow label="جمع کالاها" value={formatPrice(orderSubtotal(details))} />
                {details.giftBox && (
                  <MoneyRow
                    label="بسته‌بندی هدیه و جعبه چوبی"
                    value={formatPrice(details.giftBoxPrice)}
                  />
                )}
                <MoneyRow label="هزینه ارسال" value={formatPrice(details.shippingCost)} />
                <MoneyRow
                  label="تخفیف"
                  value={
                    details.discountAmount > 0 ? `− ${formatPrice(details.discountAmount)}` : "—"
                  }
                />
                <MoneyRow label="مالیات بر ارزش افزوده" value={formatPrice(details.vatAmount)} />
                <div className="my-1.5 h-px bg-primary/20" />
                <MoneyRow label="مبلغ کل" value={formatPrice(orderTotal(details))} strong />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.open(invoiceUrl(details.dbId), "_blank", "noopener,noreferrer");
                }}
                className="h-10 w-full border-white/10 bg-transparent font-bold text-foreground hover:bg-white/5"
              >
                <Printer className="size-4" />
                چاپ فاکتور (صورتحساب رسمی)
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.badge}`}
    >
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

/** Read-only label/value row used in the order details sheet. */
function DetailRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className={
          ltr
            ? "truncate font-mono text-xs font-bold text-foreground"
            : "truncate text-xs font-bold text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

/** Label/value money row for the financial breakdown in the details sheet. */
function MoneyRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={strong ? "text-xs font-bold text-foreground" : "text-xs text-muted-foreground"}
      >
        {label}
      </span>
      <span
        className={
          strong ? "text-sm font-extrabold text-primary-soft" : "text-xs font-bold text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

/** Compact status filter chip used above the orders table. */
function StatusChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-primary-soft"
          : "border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/5 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/**
 * Returning-customer indicator. 1st order → subtle gray "خرید اول";
 * repeat customer → gold/amber star badge with the purchase number.
 */
function LoyaltyBadge({ nth }: { nth: number }) {
  if (nth <= 1) {
    return (
      <span className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
        خرید اول
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
      <Star className="size-2.5 fill-current" />
      مشتری وفادار (خرید {toFa(nth)}ام)
    </span>
  );
}

/**
 * Time elapsed since the order. Amber + warning icon when a pending order has
 * been waiting > 2 days (SLA breach — needs immediate processing).
 */
function AgeCell({ order }: { order: AdminOrder }) {
  const breached = order.status === "pending" && orderAgeDays(order) > 2;
  return (
    <span
      className={cn(
        "flex items-center gap-1 whitespace-nowrap text-xs",
        breached ? "font-extrabold text-amber-400" : "text-muted-foreground",
      )}
      title={breached ? "سفارش در انتظار بیش از ۲ روز است — نیاز به پردازش فوری" : undefined}
    >
      {breached && <AlertTriangle className="size-3.5 shrink-0" />}
      {orderAgeLabel(order)}
    </span>
  );
}
