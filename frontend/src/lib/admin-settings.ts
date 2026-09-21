/**
 * Store settings **domain** type (Phase 5: live API-backed).
 *
 * Data comes from `GET /api/v1/settings`, mapped in `api-map.ts`
 * (`toStoreSettings` — the API's `support_phone` ⇄ `phone` and
 * `signature_packaging_*` ⇄ `giftBox*` fields land here). This module only
 * owns the **type** + the fallback defaults; the localStorage
 * load/save mock was removed.
 *
 * Holds the seller information (مشخصات فروشنده) printed on the official
 * invoice and the luxury add-on configuration used by checkout:
 * signature gift-box packaging (جعبه چوبی هدیه) and the per-item premium
 * wood care oil (روغن جلای طبیعی).
 */

/** A configurable shipping method offered at checkout (name + price). */
export type ShippingMethodConfig = {
  /** Stable id persisted on each order, e.g. "standard" / "express". */
  id: string;
  /** Display title, e.g. "پست پیشتاز". */
  title: string;
  /** Short delivery note, e.g. "۳ تا ۵ روز کاری". */
  note: string;
  /** Cost in toman. */
  fee: number;
};

export type StoreSettings = {
  /** Store name as printed on the invoice, e.g. "PEDAR JEPETO". */
  storeName: string;
  phone: string;
  email: string;
  address: string;
  /** 10-digit Iranian postal code. */
  zipCode: string;
  /** مالیات بر ارزش افزوده — percentage (0–100), default 10%. */
  vatPercentage: number;
  /** هزینه بسته‌بندی ویژه / جعبه چوبی هدیه (toman). */
  giftBoxPrice: number;
  /** آیا بسته‌بندی ویژه در سبد خرید قابل انتخاب است؟ */
  giftBoxEnabled: boolean;
  /** قیمت روغن جلای طبیعی — add-on هر محصول (toman). */
  careOilPrice: number;
  /** آیا روغن محافظ در انبار موجود است؟ */
  careOilEnabled: boolean;
  /** Configurable shipping methods (name + price) offered at checkout. */
  shippingMethods: ShippingMethodConfig[];
  /** نوار اطلاع‌رسانی بالای سایت (announcement bar). */
  announcementText: string;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "PEDAR JEPETO",
  phone: "02177626411",
  email: "mr.note.ir@gmail.com",
  address: "تهران - تهران، میدان بهارستان، کوچه قرائت، پلاک ۴",
  zipCode: "1147945571",
  vatPercentage: 10,
  giftBoxPrice: 185000,
  giftBoxEnabled: true,
  careOilPrice: 120000,
  careOilEnabled: true,
  shippingMethods: [
    { id: "standard", title: "پست پیشتاز", note: "۳ تا ۵ روز کاری", fee: 69000 },
    {
      id: "express",
      title: "ارسال سریع تهران",
      note: "تحویل کمتر از ۲۴ ساعت",
      fee: 145000,
    },
  ],
  announcementText: "ارسال رایگان برای خریدهای بالای ۱ میلیون تومان",
};
