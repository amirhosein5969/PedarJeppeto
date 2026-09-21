import { useEffect, useMemo, useRef } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Printer, X } from "lucide-react";

import {
  ORDER_STATUSES,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/admin-orders";
import { useAdminOrders, useSettings } from "@/hooks/queries";
import { InvoiceSheet } from "@/components/InvoiceSheet";
import { Button } from "@/components/ui/button";

/**
 * Batch invoice printing: renders every order matching the active filter
 * (status / search, passed as query params from the orders page) as its own
 * A4 page. `break-after-page` on each wrapper makes the browser's native
 * print dialog split them into individual pages — no PDF library involved.
 *
 * Phase 5: orders come from `GET /api/v1/orders`; each printed invoice keeps
 * the same number as the single-invoice route (`203 + dbId`).
 */
export const Route = createFileRoute("/invoice-batch")({
  validateSearch: (search: Record<string, unknown>) => {
    const status = search["status"];
    const q = search["q"];
    return {
      ...(typeof status === "string" && (ORDER_STATUSES as readonly string[]).includes(status)
        ? { status: status as OrderStatus }
        : {}),
      ...(typeof q === "string" && q.trim() ? { q: q.trim() } : {}),
    };
  },
  component: InvoiceBatch,
  head: () => ({
    meta: [{ title: "چاپ گروهی فاکتورها | پدر ژپتو" }],
  }),
});

function InvoiceBatch() {
  const { status, q } = Route.useSearch();
  const { data: liveOrders, isPending } = useAdminOrders();
  const { data: settings } = useSettings();
  const autoPrinted = useRef(false);

  // Invoice numbers stay consistent with the single-invoice route
  // (203 + dbId), regardless of the active filter.
  const invoices = useMemo(() => {
    if (!liveOrders || !settings) return [];
    const lower = q?.toLowerCase() ?? "";
    return liveOrders
      .map(
        (order): { order: AdminOrder; invoiceNo: number } => ({
          // The API stores the packaging flag only — resolve the printed
          // gift-box price from live store settings.
          order: { ...order, giftBoxPrice: order.giftBox ? settings.giftBoxPrice : 0 },
          invoiceNo: 203 + order.dbId,
        }),
      )
      .filter(({ order }) => {
        if (status && order.status !== status) return false;
        if (q && !(order.id.toLowerCase().includes(lower) || order.customer.includes(q))) {
          return false;
        }
        return true;
      });
  }, [liveOrders, settings, status, q]);

  // Auto-print the whole stack once data + fonts are ready.
  useEffect(() => {
    if (!settings || invoices.length === 0 || autoPrinted.current) return;
    let cancelled = false;
    const run = () => {
      if (cancelled || autoPrinted.current) return;
      autoPrinted.current = true;
      window.print();
    };
    if (typeof document !== "undefined" && document.fonts) {
      Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(run);
      return () => {
        cancelled = true;
      };
    }
    const t = setTimeout(run, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [settings, invoices.length]);

  if (!liveOrders || !settings) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-200 print:bg-white">
        <p className="text-sm font-bold text-neutral-700">
          {isPending ? "در حال آماده‌سازی فاکتورها…" : "بارگذاری سفارشات ناموفق بود."}
        </p>
      </div>
    );
  }

  const issuedOn = new Intl.DateTimeFormat("fa-IR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-neutral-300/60 py-8 print:bg-white print:py-0">
      {/* Screen-only toolbar — never printed */}
      <div className="mx-auto mb-4 flex w-full max-w-[210mm] items-center justify-between gap-3 px-1 print:hidden">
        <Button size="sm" onClick={() => window.print()} disabled={invoices.length === 0}>
          <Printer className="size-3.5" />
          {invoices.length > 0 ? "چاپ همه‌ی فاکتورها / ذخیره‌ی PDF" : "چاپ"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.close()}>
          <X className="size-3.5" />
          بستن صفحه
        </Button>
      </div>

      {invoices.length === 0 ? (
        <div className="mx-auto max-w-[210mm] px-4 text-center text-neutral-700">
          <p className="text-sm font-bold">هیچ سفارشی با این فیلتر یافت نشد.</p>
          <Link to="/admin/orders" className="mt-3 inline-block text-xs text-neutral-500 underline">
            بازگشت به مدیریت سفارشات
          </Link>
        </div>
      ) : (
        <div>
          {invoices.map(({ order, invoiceNo }) => (
            <section key={order.dbId} className="break-after-page pb-8 print:pb-0">
              <InvoiceSheet
                order={order}
                settings={settings}
                invoiceNo={invoiceNo}
                issuedOn={issuedOn}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}