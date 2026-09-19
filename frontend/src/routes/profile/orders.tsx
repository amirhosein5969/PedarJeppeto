import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpCircle, PackageOpen, Printer } from "lucide-react";

import { useMyOrders } from "@/hooks/queries";
import { ApiError } from "@/lib/api";
import { toToman } from "@/lib/api-map";
import { ORDER_STATUS_META, toJalaliString } from "@/lib/admin-orders";
import { formatPrice, toFa } from "@/lib/shop-data";
import type { ApiMyOrder } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile/orders")({
  component: ProfileOrders,
  head: () => ({
    meta: [
      { title: "تاریخچه سفارشات | چوب‌کار" },
      { name: "description", content: "پیگیری سفارش‌های خود در فروشگاه چوب‌کار." },
    ],
  }),
});

/** The happy path, as a minimalist progress timeline. */
const TIMELINE_STEPS = [
  { key: "pending", label: "در انتظار" },
  { key: "processing", label: "در حال آماده‌سازی" },
  { key: "shipped", label: "ارسال شده" },
  { key: "delivered", label: "تحویل شده" },
] as const;

const STEP_INDEX: Record<string, number> = {
  pending: 0,
  processing: 1,
  shipped: 2,
  delivered: 3,
};

function ProfileOrders() {
  const { data: orders, isPending, isError, refetch } = useMyOrders();

  return (
    <div>
      <div>
        <h2 className="text-base font-extrabold text-foreground">تاریخچه سفارشات</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          تمامی سفارش‌های شما — از جدید به قدیم.
        </p>
      </div>

      <div className="mt-6">
        {isPending ? (
          <div className="space-y-4">
            <div className="h-52 animate-pulse rounded-2xl border border-border bg-white/[0.02]" />
            <div className="h-52 animate-pulse rounded-2xl border border-border bg-white/[0.02]" />
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] px-6 py-10 text-center">
            <p className="text-sm font-bold text-rose-400">
              بارگذاری سفارش‌ها انجام نشد.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-xs font-bold text-foreground underline underline-offset-4 hover:text-primary-soft"
            >
              تلاش دوباره
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/[0.07] text-primary">
              <PackageOpen className="size-6" />
            </span>
            <p className="mt-5 text-sm font-extrabold text-foreground">
              هنوز سفارشی ثبت نکرده‌اید
            </p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              وقتی اولین سفارش خود را ثبت کنید، در اینجا قابل پیگیری خواهد بود.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              مشاهده‌ی محصولات
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: ApiMyOrder }) {
  const meta = ORDER_STATUS_META[order.status];
  const stepIdx = STEP_INDEX[order.status] ?? -1;

  return (
    <article className="rounded-2xl border border-border bg-card transition-colors duration-300 hover:border-white/10">
      {/* Header: reference + date (right), status badge (left). */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
        <div>
          <p className="text-sm font-extrabold text-foreground">
            سفارش{" "}
            <span dir="ltr" className="tracking-wide text-foreground/90">
              {order.order_number}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            ثبت شده در {toJalaliString(new Date(order.created_at))}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-bold",
            meta.badge,
          )}
        >
          {meta.label}
        </span>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {/* Horizontal thumbnails — one per line item (images[0]). */}
        <ul className="no-scrollbar flex gap-2.5 overflow-x-auto">
          {order.items.map((item) => (
            <li key={item.product_id} className="relative shrink-0" title={item.title}>
              <div className="size-14 overflow-hidden rounded-xl border border-white/5 bg-[#1c1916] sm:size-16">
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
              </div>
              {item.quantity > 1 && (
                <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {toFa(item.quantity)}×
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Minimalist status timeline (or the cancelled note). */}
        {order.status === "cancelled" ? (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/[0.05] px-4 py-3 text-[11px] font-bold leading-6 text-rose-400">
            این سفارش لغو شده است. برای هرگونه سؤال با ما در تماس باشید.
          </p>
        ) : (
          <div dir="ltr" className="relative px-0.5">
            {/* Track + progress between the first and last dot centers. */}
            <div className="absolute top-[5px] right-[7px] left-[7px] h-px bg-white/10" />
            <div
              className="absolute top-[5px] left-[7px] h-px bg-primary/60 transition-all duration-700"
              style={{ width: `calc((100% - 14px) * ${Math.max(0, stepIdx) / 3})` }}
            />
            <ol className="relative flex items-start justify-between">
              {TIMELINE_STEPS.map((step, i) => {
                const done = i < stepIdx;
                const current = i === stepIdx;
                return (
                  <li key={step.key} className="flex flex-col items-center gap-2">
                    <span
                      className={cn(
                        "z-10 size-3 rounded-full border transition-colors duration-500",
                        current
                          ? "border-primary bg-primary shadow-[0_0_0_4px] shadow-primary/15"
                          : done
                            ? "border-primary/50 bg-primary/35"
                            : "border-white/15 bg-[#1a1714]",
                      )}
                    />
                    <span
                      className={cn(
                        "whitespace-nowrap text-[10px] font-bold transition-colors duration-500",
                        current
                          ? "text-primary-soft"
                          : done
                            ? "text-foreground/70"
                            : "text-muted-foreground/50",
                      )}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Footer: total + secondary actions. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground/70">مبلغ کل پرداختی</p>
            <p className="mt-0.5 text-base font-extrabold text-foreground">
              {formatPrice(toToman(order.total_amount))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              to="/contact"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-4 transition-colors hover:text-primary-soft hover:underline"
            >
              <HelpCircle className="size-3" />
              نیاز به راهنمایی دارید؟
            </Link>
            <Link
              to="/invoice/$orderId"
              params={{ orderId: String(order.id) }}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-foreground transition-colors duration-300 hover:border-primary/40 hover:text-primary-soft"
            >
              <Printer className="size-3.5" />
              دانلود فاکتور
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}