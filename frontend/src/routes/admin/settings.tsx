import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Droplet, Gift, Plus, RotateCcw, Save, Store, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

import {
  DEFAULT_STORE_SETTINGS,
  type ShippingMethodConfig,
  type StoreSettings,
} from "@/lib/admin-settings";
import { useSaveSettings, useSettings } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
  head: () => ({
    meta: [{ title: "تنظیمات فروشگاه | چوب‌کار" }],
  }),
});

function AdminSettings() {
  const { data: live, isPending } = useSettings();
  const saveSettings = useSaveSettings();
  // null until the live settings arrive — the form then hydrates once.
  const [form, setForm] = useState<StoreSettings | null>(null);

  useEffect(() => {
    if (live && form === null) setForm(live);
  }, [live, form]);

  const set = (patch: Partial<StoreSettings>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateMethod = (index: number, patch: Partial<ShippingMethodConfig>) => {
    if (!form) return;
    set({
      shippingMethods: form.shippingMethods.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    });
  };

  const addMethod = () => {
    if (!form) return;
    const used = new Set(form.shippingMethods.map((m) => m.id));
    let n = form.shippingMethods.length + 1;
    let id = `method-${n}`;
    while (used.has(id)) {
      n += 1;
      id = `method-${n}`;
    }
    set({
      shippingMethods: [
        ...form.shippingMethods,
        { id, title: "", note: "", fee: 0 },
      ],
    });
  };

  const removeMethod = (index: number) => {
    if (!form) return;
    if (form.shippingMethods.length <= 1) {
      toast.error("حداقل یک روش ارسال برای صفحه‌ی پرداخت لازم است.");
      return;
    }
    set({ shippingMethods: form.shippingMethods.filter((_, i) => i !== index) });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (form.storeName.trim().length < 2) {
      toast.error("نام فروشگاه حداقل ۲ نویسه باشد.");
      return;
    }
    const shippingMethods = form.shippingMethods.map((m) => ({
      id: m.id.trim() || m.id,
      title: m.title.trim(),
      note: m.note.trim(),
      fee: Math.max(0, Math.round(m.fee || 0)),
    }));
    if (shippingMethods.some((m) => !m.title)) {
      toast.error("عنوان همه‌ی روش‌های ارسال را کامل کنید.");
      return;
    }
    const next: StoreSettings = {
      storeName: form.storeName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      zipCode: form.zipCode.trim(),
      vatPercentage: Math.min(
        100,
        Math.max(0, Number.isFinite(form.vatPercentage) ? form.vatPercentage : 0),
      ),
      giftBoxPrice: Math.max(0, Math.round(form.giftBoxPrice || 0)),
      giftBoxEnabled: form.giftBoxEnabled,
      careOilPrice: Math.max(0, Math.round(form.careOilPrice || 0)),
      careOilEnabled: form.careOilEnabled,
      shippingMethods,
    };
    setForm(next);
    saveSettings.mutate(next, {
      onSuccess: () => {
        toast.success(
          "تنظیمات فروشگاه ذخیره شد؛ در چاپ فاکتور و صفحه‌ی پرداخت به‌کار می‌رود.",
        );
      },
      onError: (err) => {
        toast.error(`ذخیره‌ی تنظیمات ناموفق بود: ${err.message}`);
      },
    });
  };

  const reset = () => {
    setForm(DEFAULT_STORE_SETTINGS);
    saveSettings.mutate(DEFAULT_STORE_SETTINGS, {
      onSuccess: () => {
        toast.success("اطلاعات فروشنده به مقادیر پیش‌فرض بازگشت.");
      },
      onError: (err) => {
        toast.error(`ذخیره‌ی مقادیر پیش‌فرض ناموفق بود: ${err.message}`);
      },
    });
  };

  if (!form) {
    return (
      <div className="grid min-h-64 place-items-center px-10 text-center text-xs text-muted-foreground">
        {isPending
          ? "بارگذاری تنظیمات…"
          : "بارگذاری تنظیمات ناموفق بود؛ اتصال به سرور فروشگاه را بررسی کنید."}
      </div>
    );
  }

  const inputClass =
    "border-white/10 bg-[#1c1916] placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25";

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">تنظیمات فروشگاه</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            مشخصات فروشنده — این اطلاعات روی صورتحساب چاپی درج می‌شود
          </p>
        </div>
      </div>

      {/* Settings card */}
      <form
        onSubmit={submit}
        className="mt-6 max-w-2xl space-y-5 rounded-xl border border-white/5 bg-[#151311] p-5"
      >
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold text-primary-soft">
            <Store className="size-4" />
            مشخصات فروشنده
          </p>
          <Separator className="mt-2 bg-white/5" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="store-name" className="text-xs text-foreground/80">
            نام فروشگاه
          </Label>
          <Input
            id="store-name"
            dir="ltr"
            value={form.storeName}
            onChange={(e) => {
              set({ storeName: e.target.value });
            }}
            placeholder="PEDAR JEPETO"
            className={`text-start ${inputClass}`}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="store-phone" className="text-xs text-foreground/80">
              تلفن
            </Label>
            <Input
              id="store-phone"
              dir="ltr"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => {
                set({ phone: e.target.value });
              }}
              placeholder="02177626411"
              className={`text-start ${inputClass}`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-zip" className="text-xs text-foreground/80">
              کد پستی
            </Label>
            <Input
              id="store-zip"
              dir="ltr"
              inputMode="numeric"
              value={form.zipCode}
              onChange={(e) => {
                set({ zipCode: e.target.value });
              }}
              placeholder="1147945571"
              className={`text-start ${inputClass}`}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="store-vat" className="text-xs text-foreground/80">
            مالیات بر ارزش افزوده (درصد)
          </Label>
          <Input
            id="store-vat"
            dir="ltr"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={form.vatPercentage}
            onChange={(e) => {
              const raw = e.target.value;
              set({ vatPercentage: raw === "" ? 0 : Number(raw) });
            }}
            className={`text-start ${inputClass}`}
          />
          <p className="text-[11px] leading-5 text-muted-foreground">
            روی مبلغ (جمع کالاها − تخفیف) اعمال می‌شود؛ در خلاصه‌ی پرداخت و فاکتور چاپی نمایش داده
            می‌شود.
          </p>
        </div>

        {/* ── Luxury add-ons: signature gift box + premium care oil ── */}
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold text-primary-soft">
            <Gift className="size-4" />
            بسته‌بندی و افزودنی‌های لوکس
          </p>
          <Separator className="mt-2 bg-white/5" />
        </div>

        <div className="space-y-3 rounded-lg border border-white/5 bg-[#1c1916] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-foreground">بسته‌بندی هدیه و جعبه چوبی</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                در صفحه‌ی پرداخت به‌صورت سوییچ قابل انتخاب است.
              </p>
            </div>
            <Switch
              checked={form.giftBoxEnabled}
              onCheckedChange={(v) => set({ giftBoxEnabled: v })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-giftbox" className="text-xs text-foreground/80">
              هزینه‌ی بسته‌بندی ویژه (تومان)
            </Label>
            <Input
              id="store-giftbox"
              dir="ltr"
              type="number"
              min={0}
              step={10000}
              value={form.giftBoxPrice}
              onChange={(e) => {
                const raw = e.target.value;
                set({ giftBoxPrice: raw === "" ? 0 : Number(raw) });
              }}
              className={`text-start ${inputClass}`}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-white/5 bg-[#1c1916] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Droplet className="size-3.5 text-primary" />
                روغن جلای طبیعی
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                افزودنی اختیاری «برای هر محصول» در صفحه‌ی پرداخت.
              </p>
            </div>
            <Switch
              checked={form.careOilEnabled}
              onCheckedChange={(v) => set({ careOilEnabled: v })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-careoil" className="text-xs text-foreground/80">
              قیمت روغن جلای طبیعی (تومان)
            </Label>
            <Input
              id="store-careoil"
              dir="ltr"
              type="number"
              min={0}
              step={10000}
              value={form.careOilPrice}
              onChange={(e) => {
                const raw = e.target.value;
                set({ careOilPrice: raw === "" ? 0 : Number(raw) });
              }}
              className={`text-start ${inputClass}`}
            />
          </div>
        </div>

        {/* ── Shipping methods: the options + fees shown at checkout ── */}
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold text-primary-soft">
            <Truck className="size-4" />
            روش‌های ارسال
          </p>
          <Separator className="mt-2 bg-white/5" />
        </div>

        <div className="space-y-3">
          {form.shippingMethods.map((m, i) => (
            <div key={m.id} className="space-y-3 rounded-lg border border-white/5 bg-[#1c1916] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground" dir="ltr">
                  {m.id}
                </span>
                <button
                  type="button"
                  onClick={() => removeMethod(i)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <Trash2 className="size-3.5" />
                  حذف
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor={`ship-title-${m.id}`} className="text-xs text-foreground/80">
                    عنوان نمایشی
                  </Label>
                  <Input
                    id={`ship-title-${m.id}`}
                    value={m.title}
                    onChange={(e) => {
                      updateMethod(i, { title: e.target.value });
                    }}
                    placeholder="مثلا پست پیشتاز"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ship-note-${m.id}`} className="text-xs text-foreground/80">
                    توضیح
                  </Label>
                  <Input
                    id={`ship-note-${m.id}`}
                    value={m.note}
                    onChange={(e) => {
                      updateMethod(i, { note: e.target.value });
                    }}
                    placeholder="مثلا ۳ تا ۵ روز کاری"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ship-fee-${m.id}`} className="text-xs text-foreground/80">
                    هزینه ارسال (تومان)
                  </Label>
                  <Input
                    id={`ship-fee-${m.id}`}
                    dir="ltr"
                    type="number"
                    min={0}
                    step={10000}
                    value={m.fee}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateMethod(i, { fee: raw === "" ? 0 : Number(raw) });
                    }}
                    className={`text-start ${inputClass}`}
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addMethod}
            className="h-10 w-full border-dashed border-white/10 bg-transparent text-foreground hover:bg-white/5"
          >
            <Plus className="size-4" />
            افزودن روش ارسال
          </Button>

          <p className="rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3 text-[11px] leading-6 text-muted-foreground">
            این روش‌ها در صفحه‌ی پرداخت (check-out) نمایش داده می‌شوند؛ نام روش انتخابی روی هر
            سفارش ثبت می‌شود و در جزئیات سفارش قابل مشاهده است.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="store-email" className="text-xs text-foreground/80">
            ایمیل
          </Label>
          <Input
            id="store-email"
            dir="ltr"
            type="email"
            value={form.email}
            onChange={(e) => {
              set({ email: e.target.value });
            }}
            placeholder="store@example.com"
            className={`text-start ${inputClass}`}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="store-address" className="text-xs text-foreground/80">
            آدرس
          </Label>
          <Textarea
            id="store-address"
            rows={2}
            value={form.address}
            onChange={(e) => {
              set({ address: e.target.value });
            }}
            placeholder="تهران - تهران، …"
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="submit"
            className="h-10 bg-linear-to-l from-primary to-primary-soft font-bold text-primary-foreground transition-all duration-300 hover:opacity-90"
          >
            <Save className="size-4" />
            ذخیره تغییرات
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            className="h-10 border-white/10 bg-transparent font-bold text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            <RotateCcw className="size-4" />
            مقادیر پیش‌فرض
          </Button>
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3 text-[11px] leading-6 text-muted-foreground">
          <Store className="mt-0.5 size-3.5 shrink-0 text-primary" />
          این مشخصات در بخش «مشخصات فروشنده» صورتحساب چاپی (صفحه‌ی چاپ فاکتور هر سفارش) نمایش داده
          می‌شود.
        </p>
      </form>
    </div>
  );
}
