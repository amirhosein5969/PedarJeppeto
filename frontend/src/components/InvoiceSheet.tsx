import { lineTotal, orderSubtotal, orderTotal, type AdminOrder } from "@/lib/admin-orders";
import { type StoreSettings } from "@/lib/admin-settings";
import { toFa } from "@/lib/shop-data";

/** Persian-digit grouped number, no currency suffix (for table cells). */
const faNum = (value: number) => toFa(value.toLocaleString("en-US"));

type InvoiceSheetProps = {
  order: AdminOrder;
  settings: StoreSettings;
  /** Printed invoice number (204 + order index). */
  invoiceNo: number;
  /** Jalali issue date string, e.g. "۱۵ شهریور ۱۴۰۴". */
  issuedOn: string;
};

/**
 * One official Iranian invoice (صورتحساب فروش کالا و خدمات) as a white A4
 * sheet. Pure black/gray ink; the whole document sits inside a single solid
 * black outer frame — the formal, traditional Iranian ledger look — with all
 * grids, headers and signature boxes neatly inside that bounding box.
 * Rendered by both the single-invoice route and the batch-print route.
 */
export function InvoiceSheet({ order, settings, invoiceNo, issuedOn }: InvoiceSheetProps) {
  const subtotal = orderSubtotal(order);
  const giftBox = order.giftBox ? order.giftBoxPrice : 0;
  const total = orderTotal(order);

  return (
    <div
      dir="rtl"
      className="mx-auto w-full max-w-[210mm] bg-white p-4 text-neutral-900 shadow-xl sm:p-6 print:max-w-none print:p-0 print:shadow-none"
    >
      {/* Singular solid black outer border — every element sits inside this frame */}
      <div className="border-2 border-neutral-900 p-5 sm:p-7 print:border-2 print:border-neutral-900 print:p-6">
        {/* ── Header: seller identity (right) · title (center) · refs (left) */}
        <header className="flex items-start justify-between gap-4 border-b-2 border-neutral-800 pb-4">
          <div className="flex w-40 shrink-0 flex-col items-end sm:w-44">
            <p
              dir="ltr"
              className="text-xl leading-8 font-extrabold tracking-[0.18em] text-neutral-600 sm:text-2xl"
            >
              {settings.storeName}
            </p>
            <div className="mt-2 h-1 w-24 bg-red-800" />
          </div>
          <div className="pt-1 text-center">
            <h1 className="text-lg font-extrabold leading-8 text-neutral-900 sm:text-xl">
              صورتحساب فروش کالا و خدمات
            </h1>
            <p className="mt-1 text-[11px] text-neutral-500">
              (قابل ارائه به‌عنوان فاکتور رسمی فروش)
            </p>
          </div>
          <div className="w-40 shrink-0 space-y-1.5 text-[11px] leading-5 text-neutral-700 sm:w-44">
            <p className="flex justify-between gap-2">
              <span>شماره فاکتور:</span>
              <span className="font-bold">{toFa(invoiceNo)}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span>مرجع سفارش:</span>
              <span dir="ltr" className="font-mono font-bold">
                {order.id}
              </span>
            </p>
            <p className="flex justify-between gap-2">
              <span>تاریخ صدور:</span>
              <span className="font-bold">{issuedOn}</span>
            </p>
          </div>
        </header>

        {/* ── Seller information (from store settings) */}
        <section className="mt-4 border border-neutral-400">
          <h2 className="border-b border-neutral-400 bg-neutral-100 px-3 py-1.5 text-xs font-extrabold">
            مشخصات فروشنده
          </h2>
          <div className="divide-y divide-neutral-200 text-xs">
            <InfoRow label="نام فروشنده" value={settings.storeName} ltr />
            <InfoRow label="تلفن" value={settings.phone} ltr />
            <InfoRow label="ایمیل" value={settings.email} ltr />
            <InfoRow label="آدرس" value={settings.address} />
            <InfoRow label="کد پستی" value={settings.zipCode} ltr />
          </div>
        </section>

        {/* ── Buyer information (from the order's shipping block) */}
        <section className="mt-3 border border-neutral-400">
          <h2 className="border-b border-neutral-400 bg-neutral-100 px-3 py-1.5 text-xs font-extrabold">
            مشخصات خریدار
          </h2>
          <div className="divide-y divide-neutral-200 text-xs">
            <InfoRow label="نام و نام خانوادگی" value={order.shippingDetails.name} />
            <InfoRow label="شماره تماس" value={order.shippingDetails.phone} ltr />
            <InfoRow
              label="استان / شهر"
              value={`${order.shippingDetails.province} - ${order.shippingDetails.city}`}
            />
            <InfoRow label="نشانی" value={order.shippingDetails.address} />
            <InfoRow
              label="کد پستی"
              value={order.shippingDetails.postalCode || "— (ارسال سریع)"}
              ltr
            />
          </div>
        </section>

        {/* ── Products table (per-line care-oil add-on shown under the title) */}
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-neutral-100 text-neutral-800">
              <th className="w-12 border border-neutral-400 px-2 py-2 font-extrabold">ردیف</th>
              <th className="border border-neutral-400 px-2 py-2 text-right font-extrabold">
                محصول
              </th>
              <th className="w-32 border border-neutral-400 px-2 py-2 font-extrabold">
                مبلغ پایه (تومان)
              </th>
              <th className="w-16 border border-neutral-400 px-2 py-2 font-extrabold">تعداد</th>
              <th className="w-32 border border-neutral-400 px-2 py-2 font-extrabold">
                مبلغ کل (تومان)
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={item.productId}>
                <td className="border border-neutral-400 px-2 py-2 text-center font-bold">
                  {toFa(i + 1)}
                </td>
                <td className="border border-neutral-400 px-2 py-2 align-top">
                  <span className="font-medium">{item.title}</span>
                  {item.careOilAdded && (
                    <span className="mt-1 block text-[10px] text-neutral-600">
                      + روغن جلا با قابلیت پرداخت ({faNum(item.careOilPrice)} تومان)
                    </span>
                  )}
                </td>
                <td className="border border-neutral-400 px-2 py-2 align-top text-center">
                  {faNum(item.unitPrice)}
                </td>
                <td className="border border-neutral-400 px-2 py-2 align-top text-center font-bold">
                  {toFa(item.qty)}
                </td>
                <td className="border border-neutral-400 px-2 py-2 align-top text-center font-bold">
                  {faNum(lineTotal(item))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Signatures (right) + summary table (bottom-left) */}
        <div className="mt-5 flex items-end justify-between gap-6">
          <div className="grid flex-1 grid-cols-2 gap-4">
            <SignatureBox label="مهر و امضای فروشگاه" />
            <SignatureBox label="امضای خریدار" />
          </div>
          <table className="w-60 shrink-0 border-collapse text-xs sm:w-64">
            <tbody>
              <SummaryRow label="مبلغ کل محصولات" value={faNum(subtotal)} />
              {giftBox > 0 && (
                <SummaryRow label="بسته‌بندی ویژه (جعبه چوبی)" value={faNum(giftBox)} />
              )}
              <SummaryRow label="هزینه ارسال" value={faNum(order.shippingCost)} />
              <SummaryRow label="تخفیف‌ها" value={faNum(order.discountAmount)} />
              <SummaryRow label="جمع مالیات" value={faNum(order.vatAmount)} />
              <tr className="bg-neutral-100">
                <td className="border border-neutral-400 px-3 py-2 font-extrabold">مجموع</td>
                <td className="border border-neutral-400 px-3 py-2 text-center font-extrabold">
                  {faNum(total)} تومان
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-6 border-t border-neutral-300 pt-3 text-center text-[10px] text-neutral-500">
          این صورتحساب به‌صورت خودکار توسط سامانه‌ی فروشگاه «پدر ژپتو» صادر شده و حکم فاکتور رسمی
          فروش را دارد.
        </p>
      </div>
    </div>
  );
}

/** Label/value row used inside the seller & buyer info boxes. */
function InfoRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-1.5">
      <span className="shrink-0 text-neutral-500">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className={`truncate font-bold ${ltr ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Bordered stamp/signature area with a caption strip. */
function SignatureBox({ label }: { label: string }) {
  return (
    <div className="border border-neutral-400">
      <p className="border-b border-neutral-400 bg-neutral-100 px-2 py-1.5 text-center text-[11px] font-extrabold">
        {label}
      </p>
      <div className="h-16" />
    </div>
  );
}

/** One row of the bottom-left summary table. */
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="border border-neutral-400 px-3 py-1.5 font-medium text-neutral-700">
        {label}
      </td>
      <td className="border border-neutral-400 px-3 py-1.5 text-center font-bold">{value}</td>
    </tr>
  );
}
