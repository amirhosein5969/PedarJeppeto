import { useEffect, useRef } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Printer, X } from "lucide-react";

import { useAdminOrder, useSettings } from "@/hooks/queries";
import { InvoiceSheet } from "@/components/InvoiceSheet";
import { Button } from "@/components/ui/button";

/**
 * Standalone printable invoice — intentionally NOT under the /admin folder so
 * it renders without the AdminLayout (no sidebar/topbar). The browser's native
 * print dialog (Save as PDF) does the rendering, so no PDF library is needed.
 *
 * Phase 5: the order comes from `GET /api/v1/orders/{id}` — the route param
 * is the numeric DB id, and the printed invoice number is `203 + dbId`.
 */
export const Route = createFileRoute("/invoice/$orderId")({
  component: InvoicePage,
  head: () => ({
    meta: [{ title: "صورتحساب فروش کالا و خدمات | چوب‌کار" }],
  }),
});

function InvoicePage() {
  const { orderId } = Route.useParams();
  const dbId = Number(orderId);
  const validId = Number.isInteger(dbId) && dbId > 0;

  const { data: liveOrder, isPending } = useAdminOrder(validId ? dbId : undefined);
  const { data: settings } = useSettings();
  const autoPrinted = useRef(false);

  // The API persists the packaging *flag* only — the printed gift-box price
  // is resolved from live store settings.
  const order = liveOrder
    ? { ...liveOrder, giftBoxPrice: liveOrder.giftBox ? (settings?.giftBoxPrice ?? 0) : 0 }
    : null;

  // Auto-print once the data is in. We wait for the webfont (up to 1.5s) so
  // the printed sheet is pixel-perfect instead of falling back mid-print.
  useEffect(() => {
    if (!order || !settings || autoPrinted.current) return;
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
  }, [order, settings]);

  if (!validId) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-200 print:bg-white print:py-0">
        <div className="text-center text-neutral-700">
          <p className="text-sm font-bold">سفارش موردنظر یافت نشد.</p>
          <Link
            to="/admin/orders"
            className="mt-3 inline-block text-xs text-neutral-500 underline"
          >
            بازگشت به مدیریت سفارشات
          </Link>
        </div>
      </div>
    );
  }

  if (!order || !settings) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-200 print:bg-white print:py-0">
        <div className="text-center text-neutral-700">
          <p className="text-sm font-bold">
            {isPending ? "در حال آماده‌سازی فاکتور…" : "سفارش موردنظر یافت نشد."}
          </p>
          {!isPending && (
            <Link
              to="/admin/orders"
              className="mt-3 inline-block text-xs text-neutral-500 underline"
            >
              بازگشت به مدیریت سفارشات
            </Link>
          )}
        </div>
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
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          چاپ / ذخیره‌ی PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.close()}>
          <X className="size-3.5" />
          بستن صفحه
        </Button>
      </div>

      <InvoiceSheet
        order={order}
        settings={settings}
        invoiceNo={203 + dbId}
        issuedOn={issuedOn}
      />
    </div>
  );
}