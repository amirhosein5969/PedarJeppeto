import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  Droplet,
  Info,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Ticket,
  Truck,
  X,
} from "lucide-react";
import { z } from "zod";

import { useCart } from "@/components/shop/CartContext";
import {
  useCatalog,
  useCartSummary,
  useMyAddresses,
  usePlaceOrder,
  useSettings,
  useUsers,
  useValidatePromo,
} from "@/hooks/queries";
import { ApiError } from "@/lib/api";
import { toToman } from "@/lib/api-map";
import type { ApiPromoValidate, ApiUserAddress } from "@/lib/api-types";
import { shippingFee, type ShippingMethod } from "@/lib/checkout";
import { useAuth } from "@/hooks/useAuth";
import { finalPrice, formatPrice, toFa, variantLabel } from "@/lib/shop-data";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const irPhoneRegex = /^(?:\+98|0)?9\d{9}$/;
const irPostalRegex = /^\d{10}$/;

/**
 * Postal code is always optional at the field level: with "ارسال سریع تهران"
 * the courier covers the whole city and no postal code is needed. The
 * superRefine re-requires it for every other shipping method.
 */
const buildCheckoutSchema = (shipping: ShippingMethod) =>
  z
    .object({
      fullName: z.string().min(3, "نام و نام خانوادگی گیرنده را کامل وارد کنید").max(100),
      phone: z.string().regex(irPhoneRegex, "شماره موبایل معتبر وارد کنید"),
      province: z.string().min(2, "استان را وارد کنید"),
      city: z.string().min(2, "شهر را وارد کنید"),
      address: z.string().min(10, "نشانی کامل پستی را وارد کنید").max(300),
      postalCode: z.string().regex(irPostalRegex, "کد پستی باید ۱۰ رقم باشد").optional(),
      note: z.string().max(300).optional(),
    })
    .superRefine((values, ctx) => {
      if (shipping !== "express" && !irPostalRegex.test(values.postalCode ?? "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["postalCode"],
          message: "کد پستی ۱۰ رقمی را وارد کنید.",
        });
      }
    });

type CheckoutValues = z.infer<ReturnType<typeof buildCheckoutSchema>>;

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "تکمیل سفارش | چوب‌کار" },
      { name: "description", content: "ثبت اطلاعات ارسال، انتخاب روش ارسال و پرداخت سفارش." },
      { property: "og:title", content: "تکمیل سفارش | چوب‌کار" },
      { property: "og:description", content: "یک قدم تا تحویل محصولات چوبی دست‌ساز." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { items, subtotal, savings, oilEnabled, oilPrice, setOil } = useCart();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [shipping, setShipping] = useState<ShippingMethod>("standard");

  // Live store settings — VAT, gift box, care oil, shipping methods.
  const { data: store } = useSettings();
  const { isPending: cartPending } = useCartSummary();
  const { data: catalog } = useCatalog(true);
  const placeOrder = usePlaceOrder();
  const validatePromo = useValidatePromo();

  // Configurable shipping methods (admin → تنظیمات → روش‌های ارسال).
  const methods = useMemo(() => store?.shippingMethods ?? [], [store]);

  // If the admin renamed/removed the currently selected method, fall back to
  // the first configured one.
  useEffect(() => {
    if (methods.length > 0 && !methods.some((m) => m.id === shipping)) {
      const first = methods[0];
      if (first) setShipping(first.id);
    }
  }, [methods, shipping]);

  // Luxury promo code — validated against the backend (exact discount amount).
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<ApiPromoValidate | null>(null);

  // Signature packaging (gift box) — order-level add-on. The oil-finish
  // choice travels inside the cart items (chosen on the product page).
  const [giftBox, setGiftBox] = useState(false);

  // The zip field is hidden + optional only for "ارسال سریع تهران".
  const isFastTehran = shipping === "express";

  const rows = items.flatMap((i) => {
    const product = catalog?.products.find((p) => p.id === i.id);
    return product
      ? [{ product, qty: i.qty, oil: i.oil, woodType: i.woodType, color: i.color }]
      : [];
  });

  // Financial accuracy — luxury add-ons included (server is authoritative;
  // these preview values use the exact same formula as the backend).
  const careOilEnabled = store?.careOilEnabled ?? oilEnabled;
  const careOilPrice = store?.careOilPrice ?? oilPrice;
  const careOilOn = (row: { oil: boolean }) => careOilEnabled && row.oil;
  // Cart subtotal already prices in the per-line oil add-on.
  const careOilAmount = rows.reduce((sum, row) => sum + (careOilOn(row) ? careOilPrice : 0), 0);
  const goodsTotal = subtotal;
  const giftBoxAmount = store?.giftBoxEnabled && giftBox ? store.giftBoxPrice : 0;
  const discountAmount = promo ? toToman(promo.discount_amount) : 0;
  const vatAmount = store
    ? Math.round(
        (Math.max(0, goodsTotal + giftBoxAmount - discountAmount) * store.vatPercentage) / 100,
      )
    : 0;
  const fee = shippingFee(shipping, subtotal, methods);
  // Grand total: Goods (+ care oil) + Gift box − Discount + Shipping + VAT.
  const total = goodsTotal + giftBoxAmount - discountAmount + fee + vatAmount;

  // If the cart shrinks below the code's minimum purchase, drop the code so
  // the totals can never show a discount the rules don't allow.
  useEffect(() => {
    if (promo && goodsTotal < toToman(promo.min_purchase_amount)) {
      setPromo(null);
      toast.info("کد تخفیف از سفارش حذف شد.", {
        description: `مبلغ سفارش به حداقل خرید ${formatPrice(toToman(promo.min_purchase_amount))} کد ${promo.code} نمی‌رسد.`,
      });
    }
  }, [promo, goodsTotal]);

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      toast.error("کد هدیه یا تخفیف را وارد کنید.");
      return;
    }
    try {
      const result = await validatePromo.mutateAsync({
        code,
        cartSubtotal: goodsTotal,
      });
      setPromo(result);
      setPromoOpen(false);
      setPromoInput("");
      toast.success("تخفیف با موفقیت اعمال شد", {
        description: `کد ${result.code} — ${formatPrice(toToman(result.discount_amount))} تخفیف`,
      });
    } catch (e) {
      if (e instanceof ApiError) {
        toast.error(
          e.status === 404
            ? "این کد معتبر نیست؛ کد را بررسی کنید."
            : "اعمال کد تخفیف ممکن نشد.",
          { description: e.message },
        );
      } else {
        toast.error("اعمال کد تخفیف ممکن نشد.");
      }
    }
  };

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(buildCheckoutSchema(shipping)),
    defaultValues: {
      fullName: "",
      phone: "",
      province: "",
      city: "",
      address: "",
      postalCode: "",
      note: "",
    },
  });

  // Phase 7 address book: a logged-in customer with saved addresses gets
  // selectable cards; otherwise (or on "new address") the flat form is used and
  // the entered block is auto-saved to the book on the backend.
  const { data: addresses } = useMyAddresses();
  const [addressMode, setAddressMode] = useState<"card" | "new">("new");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const addressInitRef = useRef(false);

  const defaultAddress = useMemo(
    () => addresses?.find((a) => a.is_default) ?? addresses?.[0],
    [addresses],
  );

  // Copy a saved address card into the form fields (prefill + card clicks).
  const applyAddress = (a: ApiUserAddress) => {
    setSelectedAddressId(a.id);
    const set = (name: keyof CheckoutValues, value: string) =>
      form.setValue(name, value, { shouldValidate: false, shouldDirty: false });
    set("province", a.province ?? "");
    set("city", a.city ?? "");
    set("address", a.address ?? "");
    set("postalCode", a.zip_code ?? "");
  };

  const hasBook = Boolean(authUser?.phone && addresses && addresses.length > 0);

  const toggleAddressMode = () => {
    if (addressMode === "card") {
      setAddressMode("new");
    } else {
      setAddressMode("card");
      if (defaultAddress) applyAddress(defaultAddress);
    }
  };

  // Receiver identity (name/phone) prefilled from the profile, once.
  const { data: users } = useUsers();
  useEffect(() => {
    if (!authUser?.phone || !users) return;
    const profile = users.find((u) => u.phone === authUser.phone);
    if (!profile) return;
    const set = (name: keyof CheckoutValues, value: string) =>
      form.setValue(name, value, { shouldValidate: false, shouldDirty: false });
    set("fullName", profile.name);
    set("phone", profile.phone);
  }, [authUser?.phone, users, form]);

  // When the address book arrives, preselect the default card (client only).
  useEffect(() => {
    if (addressInitRef.current) return;
    if (!authUser?.phone || !addresses) return;
    addressInitRef.current = true;
    if (addresses.length > 0 && defaultAddress) {
      setAddressMode("card");
      applyAddress(defaultAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, authUser?.phone, defaultAddress]);

  const onSubmit = async (values: CheckoutValues) => {
    try {
      const order = await placeOrder.mutateAsync({
        fullName: values.fullName.trim(),
        phone: values.phone,
        province: values.province,
        city: values.city,
        postalCode: values.postalCode?.trim() ?? "",
        address: values.address.trim(),
        note: values.note?.trim(),
        shippingMethod: shipping,
        promoCode: promo?.code ?? null,
        signaturePackaging: store?.giftBoxEnabled ? giftBox : false,
        addressId: hasBook && addressMode === "card" ? selectedAddressId : null,
      });
      toast.success("سفارش شما با موفقیت ثبت شد", {
        description: `شماره سفارش: ${order.order_number}`,
        duration: 3000,
      });
      navigate({ to: "/" });
    } catch (e) {
      // 409 — a checkout for this cart is already in flight (double submit).
      if (e instanceof ApiError && e.status === 409) {
        toast.info("سفارش شما در حال ثبت است؛ از ثبت مجدد پرهیز کنید.", {
          description: "لحظه‌ای صبر کنید و سپس دوباره تلاش کنید.",
        });
        return;
      }
      // 400 — business rule (insufficient stock, empty cart, bad promo…).
      if (e instanceof ApiError && e.status === 400) {
        toast.error("ثبت سفارش ناموفق بود.", { description: e.message });
        return;
      }
      if (e instanceof ApiError) {
        toast.error("ثبت سفارش ناموفق بود.", { description: e.message });
        return;
      }
      toast.error("ثبت سفارش ناموفق بود؛ دوباره تلاش کنید.");
    }
  };

  if (cartPending) {
    return (
      <div className="grid min-h-72 place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-extrabold sm:text-3xl">تکمیل سفارش</h1>
        <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            برای تکمیل سفارش، ابتدا محصولی به سبد خرید اضافه کنید.
          </p>
          <Link
            to="/shop"
            className="mt-5 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
          >
            مشاهده محصولات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-12">
      <h1 className="text-2xl font-extrabold sm:text-3xl">تکمیل سفارش</h1>
      <ol className="no-scrollbar mt-5 flex gap-2 overflow-x-auto text-xs">
        {["سبد خرید", "اطلاعات ارسال", "ثبت نهایی"].map((step, i) => (
          <li
            key={step}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 font-semibold",
              i === 0
                ? "border-border text-muted-foreground"
                : "border-primary/60 bg-primary/10 text-primary-soft",
            )}
          >
            <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {toFa(i + 1)}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
        >
          <div className="space-y-6">
            <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="font-bold">اطلاعات گیرنده</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="fullName"
                  label="نام و نام خانوادگی گیرنده"
                  placeholder="مثلاً مریم رضایی"
                  form={form}
                />
                <Field
                  name="phone"
                  label="شماره موبایل گیرنده"
                  placeholder="09123456789"
                  form={form}
                  inputMode="numeric"
                />
              </div>

              {hasBook && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-foreground/80">آدرس ارسال</p>
                  <button
                    type="button"
                    onClick={toggleAddressMode}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary-soft transition-colors hover:text-primary"
                  >
                    {addressMode === "card" ? (
                      <>
                        <Plus size={14} /> ارسال به آدرس جدید
                      </>
                    ) : (
                      <>
                        <MapPin size={14} /> انتخاب آدرس ذخیره‌شده
                      </>
                    )}
                  </button>
                </div>
              )}

              {hasBook && addressMode === "card" ? (
                <div className="grid gap-2">
                  {addresses?.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => applyAddress(a)}
                      aria-pressed={selectedAddressId === a.id}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-4 text-right transition-colors duration-300",
                        selectedAddressId === a.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/60",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2",
                          selectedAddressId === a.id ? "border-primary" : "border-border",
                        )}
                      >
                        {selectedAddressId === a.id && (
                          <span className="size-2 rounded-full bg-primary" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{a.title}</span>
                          {a.is_default && (
                            <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary-soft">
                              پیش‌فرض
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
                          {[
                            a.province,
                            a.city,
                            a.address,
                            a.zip_code ? `کد پستی ${a.zip_code}` : "",
                          ]
                            .filter(Boolean)
                            .join("، ")}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field name="province" label="استان" placeholder="مثلاً تهران" form={form} />
                    <Field name="city" label="شهر" placeholder="مثلا‌ تهران" form={form} />
                    {/* Hidden for express Tehran: the courier covers the whole city. */}
                    {!isFastTehran && (
                      <Field
                        name="postalCode"
                        label="کد پستی ۱۰ رقمی"
                        placeholder="1234567890"
                        form={form}
                        inputMode="numeric"
                      />
                    )}
                  </div>
                  {isFastTehran && (
                    <p className="rounded-xl border border-secondary/60 bg-secondary/20 p-3 text-[11px] leading-6 text-foreground/90">
                      برای «ارسال سریع تهران» کد پستی لازم نیست؛ تحویل داخل شهر زیر ۲۴ ساعت
                      انجام می‌شود.
                    </p>
                  )}
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-foreground/80">
                          نشانی کامل پستی
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            id="address"
                            rows={3}
                            placeholder="استان، شهر، خیابان، کوچه، پلاک و واحد"
                            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-foreground/80">
                      توضیح سفارش (اختیاری)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        id="note"
                        rows={2}
                        placeholder="مثلاً درخواست بسته‌بندی کادویی یا هماهنگی ساعت تحویل"
                        className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-bold">
                <Truck size={18} className="text-primary" /> روش ارسال
              </h2>
              {methods.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  در حال بارگذاری روش‌های ارسال…
                </p>
              )}
              {methods.map((m) => (
                <OptionRow
                  key={m.id}
                  selected={shipping === m.id}
                  onSelect={() => {
                    setShipping(m.id);
                    // Switching to express Tehran makes the zip field optional —
                    // drop any stale value so it can never block the order.
                    if (m.id === "express") {
                      form.setValue("postalCode", "", {
                        shouldValidate: false,
                        shouldDirty: false,
                      });
                    }
                  }}
                  title={m.title}
                  note={m.note}
                  trailing={subtotal >= 5000000 ? "رایگان" : formatPrice(m.fee)}
                />
              ))}
            </section>
          </div>

          <aside className="h-fit space-y-4 rounded-2xl border border-primary/40 bg-card p-5 lg:sticky lg:top-28">
            <h2 className="font-bold">خلاصه سفارش</h2>
            <ul className="space-y-4">
              {rows.map(({ product, qty, oil, woodType, color }) => {
                const label = variantLabel({
                  wood: woodType,
                  color,
                  oil: careOilOn({ oil }),
                });
                return (
                <li key={product.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      className="size-12 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-xs font-semibold">{product.name}</p>
                      {label && (
                        <p className="mt-0.5 text-[11px] font-medium text-primary-soft/80">
                          {label}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">{toFa(qty)} عدد</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-primary-soft">
                      {formatPrice(
                        finalPrice(product) * qty + (careOilOn({ oil }) ? careOilPrice : 0),
                      )}
                    </span>
                  </div>
                  {/* Per-item oil finish — a subtle, indented add-on under the line */}
                  {careOilEnabled && (
                    <div className="ms-[60px]">
                      <button
                        type="button"
                        aria-pressed={oil}
                        onClick={() => {
                          setOil(product.id, !oil);
                        }}
                        className={cn(
                          "flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors duration-300",
                          oil
                            ? "border-primary/50 bg-primary/10 text-primary-soft"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        <Droplet size={12} strokeWidth={2} />
                        روغن جلا با قابلیت پرداخت (+ {formatPrice(careOilPrice)})
                      </button>
                    </div>
                  )}
                </li>
                );
              })}
            </ul>

            {/* Luxury promo code — hidden by default, expands into input + اعمال */}
            <div>
              {promo ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/[0.07] px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-primary-soft">
                    <BadgeCheck size={14} className="shrink-0" />
                    <span className="truncate">
                      کد <span dir="ltr">{promo.code}</span> — {formatPrice(discountAmount)} تخفیف
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label="حذف کد تخفیف"
                    onClick={() => setPromo(null)}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setPromoOpen((v) => !v)}
                    aria-expanded={promoOpen}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary-soft transition-colors hover:text-primary"
                  >
                    <Ticket size={14} />
                    کد هدیه یا تخفیف دارید؟
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-300",
                        promoOpen && "rotate-180",
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-300 ease-out",
                      promoOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="flex gap-2 pt-2">
                        <input
                          dir="ltr"
                          aria-label="کد هدیه یا تخفیف"
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void applyPromo();
                            }
                          }}
                          placeholder="مثلاً LUXURY20"
                          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-xs outline-none placeholder:text-muted-foreground/40 focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => void applyPromo()}
                          disabled={validatePromo.isPending}
                          className="h-9 shrink-0 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          {validatePromo.isPending ? "در حال بررسی…" : "اعمال"}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Signature packaging — gift box + wooden crate add-on */}
            {store?.giftBoxEnabled && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                  بسته‌بندی هدیه و جعبه چوبی
                  <a
                    href="/guide#signature-packaging"
                    target="_blank"
                    aria-label="معرفی بسته‌بندی امضای چوب‌کار"
                    className="text-muted-foreground/70 transition-colors hover:text-primary-soft"
                  >
                    <Info className="h-4 w-4" />
                  </a>
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <span className="text-[11px] font-bold text-primary-soft">
                    {formatPrice(store.giftBoxPrice)}
                  </span>
                  <Switch checked={giftBox} onCheckedChange={setGiftBox} />
                </span>
              </div>
            )}

            <div className="h-px bg-border" />
            <Row label="جمع کالاها" value={formatPrice(goodsTotal)} />
            {careOilAmount > 0 && (
              <Row label="شامل روغن جلا و پرداخت" value={`+ ${formatPrice(careOilAmount)}`} />
            )}
            <Row label="تخفیف محصولات" value={`− ${formatPrice(savings)}`} accent />
            {discountAmount > 0 && (
              <Row
                label={`تخفیف کد ${promo ? promo.code : ""}`}
                value={`− ${formatPrice(discountAmount)}`}
                accent
              />
            )}
            {giftBoxAmount > 0 && (
              <Row label="بسته‌بندی هدیه و جعبه چوبی" value={formatPrice(giftBoxAmount)} />
            )}
            <Row label="هزینه ارسال" value={fee === 0 ? "رایگان" : formatPrice(fee)} />
            <Row
              label="مالیات بر ارزش افزوده"
              value={store === null ? "…" : formatPrice(vatAmount)}
            />
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm">مبلغ قابل پرداخت</span>
              <span className="text-lg font-extrabold text-primary-soft">{formatPrice(total)}</span>
            </div>

            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> در حال ثبت سفارش…
                </>
              ) : (
                <>
                  ثبت نهایی سفارش <ArrowLeft size={16} />
                </>
              )}
            </button>

            <Link
              to="/cart"
              className="block text-center text-xs text-muted-foreground transition-colors hover:text-primary-soft"
            >
              بازگشت به سبد خرید
            </Link>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck size={14} className="text-primary" /> پرداخت امن روی بستر رمزنگاری‌شده
            </p>
          </aside>
        </form>
      </Form>
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  form,
  inputMode,
}: {
  name: keyof CheckoutValues;
  label: string;
  placeholder: string;
  form: ReturnType<typeof useForm<CheckoutValues>>;
  inputMode?: "numeric" | "text";
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel htmlFor={name} className="text-xs text-foreground/80">
            {label}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              id={name}
              placeholder={placeholder}
              {...(inputMode ? { inputMode } : {})}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function OptionRow({
  selected,
  onSelect,
  title,
  note,
  trailing,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  note: string;
  trailing?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-4 text-right transition-colors duration-300",
        selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/60",
      )}
    >
      <span
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-full border-2",
          selected ? "border-primary" : "border-border",
        )}
      >
        {selected && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{note}</span>
      </span>
      {trailing && <span className="shrink-0 text-xs font-bold text-primary-soft">{trailing}</span>}
    </button>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "font-semibold text-primary-soft" : "font-semibold"}>{value}</span>
    </div>
  );
}