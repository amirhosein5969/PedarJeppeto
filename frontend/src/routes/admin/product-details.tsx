import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Droplet, Info, Plus, TreePine, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { loadWoodSettings, saveWoodSettings, type WoodSettings } from "@/lib/admin-wood-types";
import type { StoreSettings } from "@/lib/admin-settings";
import { useSaveSettings, useSettings } from "@/hooks/queries";
import { formatPrice, toFa } from "@/lib/shop-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/product-details")({
  component: ProductDetailsAdmin,
  head: () => ({
    meta: [{ title: "جزئیات محصولات | چوب‌کار" }],
  }),
});

const inputClass =
  "border-white/10 bg-[#1c1916] text-foreground placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25";

function ProductDetailsAdmin() {
  // SSR-safe: localStorage-backed settings hydrate on the client only.
  const [settings, setSettings] = useState<WoodSettings | null>(null);
  const [newWood, setNewWood] = useState("");
  // روغن جلا configuration lives in the shared store settings (live API) so
  // the storefront, checkout and invoice all read the same price/switch.
  const { data: store } = useSettings();
  const saveStore = useSaveSettings();
  const [oilPriceInput, setOilPriceInput] = useState<string | null>(null);

  useEffect(() => {
    setSettings(loadWoodSettings());
  }, []);

  // The oil price input hydrates once the live settings arrive.
  useEffect(() => {
    if (store && oilPriceInput === null) setOilPriceInput(String(store.careOilPrice));
  }, [store, oilPriceInput]);

  const commit = (next: WoodSettings) => {
    setSettings(next);
    saveWoodSettings(next);
  };

  const commitStore = (next: StoreSettings, ok: string) => {
    saveStore.mutate(next, {
      onSuccess: () => toast.success(ok),
      onError: (err) => toast.error(`ذخیره‌ی تنظیمات ناموفق بود: ${err.message}`),
    });
  };

  const addWood = () => {
    const name = newWood.trim();
    if (!name) return;
    if (!settings) return;
    if (settings.woodTypes.includes(name)) {
      toast.error(`گزینه‌ی «${name}» از قبل در فهرست وجود دارد.`);
      return;
    }
    commit({ ...settings, woodTypes: [...settings.woodTypes, name] });
    setNewWood("");
    toast.success(`چوب «${name}» به فهرست اضافه شد.`);
  };

  const renameWood = (index: number, name: string) => {
    if (!settings) return;
    commit({
      ...settings,
      woodTypes: settings.woodTypes.map((w, i) => (i === index ? name : w)),
    });
  };

  const removeWood = (index: number) => {
    if (!settings) return;
    const removed = settings.woodTypes[index];
    commit({
      ...settings,
      woodTypes: settings.woodTypes.filter((_, i) => i !== index),
    });
    toast.success(`چوب «${removed}» از فهرست حذف شد.`);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">جزئیات محصولات</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            مدیریت جنس چوب و نحوه‌ی نمایش آن در صفحه‌ی محصول
          </p>
        </div>
        {settings && (
          <Badge className="border-transparent bg-primary/15 text-[11px] font-extrabold text-primary-soft hover:bg-primary/15">
            {toFa(settings.woodTypes.length)} نوع چوب
          </Badge>
        )}
      </div>

      {/* Global behavior toggle */}
      <section className="mt-6 rounded-xl border border-white/5 bg-[#151311] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <TreePine className="size-5" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-foreground">انتخاب جنس توسط مشتری</p>
              <p className="mt-1 max-w-xl text-xs leading-6 text-muted-foreground">
                روشن: مشتری در صفحه‌ی محصول جنس چوب را از فهرست کشوییِ نوع‌های چوب پایین همین صفحه
                انتخاب می‌کند. خاموش: مشتری یک کادر متنی برای نوشتن توضیح چوب دلخواه می‌بیند و در
                فرم محصولات هم فیلد جنس متنی می‌شود.
              </p>
            </div>
          </div>
          <Switch
            checked={settings?.customerSelectionEnabled ?? false}
            disabled={settings === null}
            onCheckedChange={(v) => {
              if (!settings) return;
              commit({ ...settings, customerSelectionEnabled: v });
              toast.success(
                v
                  ? "انتخاب جنس از فهرست چوب‌ها برای مشتریان فعال شد."
                  : "انتخاب جنس از فهرست غیرفعال شد؛ کادر متنی جای آن را می‌گیرد.",
              );
            }}
          />
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3 text-[11px] leading-6 text-muted-foreground/80">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
          {settings?.customerSelectionEnabled ? (
            <span>
              هم‌اکنون در صفحه‌ی محصول، فهرست کشویی جنس چوب نمایش داده می‌شود و در فرم
              «افزودن/ویرایش محصول» فیلد جنس از همین فهرست انتخاب می‌شود.
            </span>
          ) : (
            <span>
              هم‌اکنون در صفحه‌ی محصول، کادر متنی توضیح چوب نمایش داده می‌شود و فیلد جنس در فرم
              محصولات هم دستی (متنی) است.
            </span>
          )}
        </div>
      </section>

      {/* Wood type manager */}
      <section className="mt-6 overflow-hidden rounded-xl border border-white/5 bg-[#151311]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
          <div>
            <h2 className="text-sm font-extrabold text-foreground">فهرست نوع‌های چوب</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              این فهرست سراسری است و روی همه‌ی محصولات اعمال می‌شود. برای تغییر نام، متن گزینه را
              مستقیماً ویرایش کنید.
            </p>
          </div>
        </div>
        <Separator className="bg-white/5" />

        {settings === null ? (
          <div className="grid min-h-40 place-items-center text-xs text-muted-foreground">
            بارگذاری فهرست چوب‌ها…
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {settings.woodTypes.length === 0 && (
              <li className="px-5 py-8 text-center">
                <p className="text-sm font-bold text-foreground">فهرست خالی است</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  با کادر پایین، اولین نوع چوب را اضافه کنید.
                </p>
              </li>
            )}
            {settings.woodTypes.map((wood, index) => (
              <li
                key={index}
                className="flex items-center gap-3 px-5 py-3 transition-colors duration-300 hover:bg-white/[0.02]"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <TreePine className="size-4" />
                </span>
                <Input
                  value={wood}
                  onChange={(e) => {
                    renameWood(index, e.target.value);
                  }}
                  className={cn(inputClass, "h-9 max-w-xs flex-1 text-sm font-bold")}
                  aria-label={`نام چوب ${index + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`حذف ${wood}`}
                  onClick={() => {
                    removeWood(index);
                  }}
                  className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Separator className="bg-white/5" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addWood();
          }}
          className="flex flex-wrap items-center gap-3 p-5"
        >
          <Input
            value={newWood}
            onChange={(e) => {
              setNewWood(e.target.value);
            }}
            placeholder="مثلاً چوب سیب"
            className={cn(inputClass, "h-10 max-w-xs flex-1")}
            aria-label="نام چوب جدید"
          />
          <Button
            type="submit"
            className="h-10 bg-linear-to-l from-primary to-primary-soft px-5 font-bold text-primary-foreground shadow-soft transition-all duration-300 hover:opacity-90"
          >
            <Plus className="size-4" />
            افزودن نوع چوب
          </Button>
        </form>
      </section>

      {/* Oil finish option — price rides onto the product page and invoice */}
      <section className="mt-6 rounded-xl border border-white/5 bg-[#151311] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Droplet className="size-5" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-foreground">روغن جلا با قابلیت پرداخت</p>
              <p className="mt-1 max-w-xl text-xs leading-6 text-muted-foreground">
                گزینه‌ی «پرداخت نهایی با روغن» در صفحه‌ی محصول به مشتری نمایش داده می‌شود؛ با روشن
                بودن این کلید و تعیین قیمت، مبلغ آن به قیمت نهایی محصول، سبد خرید، خلاصه‌ی سفارش و
                فاکتور اضافه می‌شود.
              </p>
            </div>
          </div>
          <Switch
            checked={store?.careOilEnabled ?? false}
            disabled={store === null || saveStore.isPending}
            onCheckedChange={(v) => {
              if (!store) return;
              commitStore(
                { ...store, careOilEnabled: v },
                v ? "گزینه‌ی روغن جلا برای مشتریان فعال شد." : "گزینه‌ی روغن جلا غیرفعال شد.",
              );
            }}
          />
        </div>
        <Separator className="my-4 bg-white/5" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!store) return;
            const raw = Number((oilPriceInput ?? "").replace(/[^\d]/g, ""));
            if (!Number.isFinite(raw) || raw < 0) {
              toast.error("قیمت روغن را به عدد وارد کنید.");
              return;
            }
            commitStore(
              { ...store, careOilPrice: Math.round(raw) },
              `قیمت روغن جلا به ${formatPrice(Math.round(raw))} تغییر کرد.`,
            );
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="space-y-1.5">
            <label htmlFor="oil-price" className="text-xs text-foreground/80">
              قیمت اضافه روغن جلا (تومان)
            </label>
<Input
              id="oil-price"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={oilPriceInput ?? ""}
              onChange={(e) => {
                setOilPriceInput(e.target.value);
              }}
              placeholder="مثلا‌‌ ۱۲۰۰۰۰"
              className={cn(inputClass, "h-10 w-48")}
              disabled={store === null || saveStore.isPending}
            />
          </div>
          <Button
            type="submit"
            disabled={store === null}
            className="h-10 bg-linear-to-l from-primary to-primary-soft px-5 font-bold text-primary-foreground shadow-soft transition-all duration-300 hover:opacity-90"
          >
            ذخیره قیمت روغن
          </Button>
          {store && (
            <p className="mb-2.5 text-[11px] text-muted-foreground">
              قیمت فعلی:{" "}
              <span className="font-bold text-primary-soft">{formatPrice(store.careOilPrice)}</span>
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
