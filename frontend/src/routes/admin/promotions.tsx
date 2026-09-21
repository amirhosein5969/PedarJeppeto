import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Percent, Plus, Save, Tag, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { promoDiscount } from "@/lib/admin-promotions";
import type { PromoCode } from "@/lib/api-map";
import { useDeletePromo, usePromos, useSavePromo } from "@/hooks/queries";
import { formatPrice, toFa } from "@/lib/shop-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/promotions")({
  component: AdminPromotions,
  head: () => ({
    meta: [{ title: "مدیریت تخفیف‌ها | پدر ژپتو" }],
  }),
});

const CODE_RE = /^[A-Z0-9]{3,20}$/;

/** The temp id given to a not-yet-saved draft (POST /promotions on save). */
const NEW_ID = "new";

function AdminPromotions() {
  const { data: livePromos, isPending, isError } = usePromos();
  const savePromo = useSavePromo();
  const deletePromo = useDeletePromo();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Copy-on-write edit buffer. `null` = the form renders the live row; once
  // the user edits ANYTHING the buffer is materialized from the live row and
  // takes precedence — this is what keeps the inputs responsive when editing
  // an EXISTING code (without it the inputs would keep showing the stale
  // live values and look "locked").
  const [draft, setDraft] = useState<PromoCode | null>(null);
  const [dirty, setDirty] = useState(false);

  const promos = livePromos ?? [];
  const isNew = draft?.id === NEW_ID;
  const selected = draft ?? promos.find((p) => p.id === selectedId) ?? promos[0] ?? null;
  const selectedIndex = selected ? promos.findIndex((p) => p.id === selected.id) : -1;

  const selectPromo = (id: string) => {
    setSelectedId(id);
    setDraft(null); // re-sync the form with the freshly selected live row
    setDirty(false);
  };

  const addPromo = () => {
    setDraft({
      id: NEW_ID,
      code: "",
      discountPercentage: 10,
      maxDiscountAmount: 0,
      minPurchaseAmount: 0,
      usageLimit: 0,
      timesUsed: 0,
      isActive: true,
    });
    setSelectedId(NEW_ID);
    setDirty(true);
  };

  const removePromo = (id: string) => {
    const target = promos.find((p) => p.id === id);
    deletePromo.mutate(id, {
      onSuccess: () => {
        toast.success(`کد «${target?.code ?? ""}» حذف شد.`);
        if (selectedId === id) {
          setSelectedId(null);
          setDraft(null);
          setDirty(false);
        }
      },
      onError: (err) => {
        toast.error(`حذف کد تخفیف ناموفق بود: ${err.message}`);
      },
    });
  };

  const updateSelected = (patch: Partial<Omit<PromoCode, "id">>) => {
    const base = draft ?? selected;
    if (!base) return;
    setDraft({ ...base, ...patch });
    setDirty(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const code = selected.code.trim().toUpperCase();
    if (!CODE_RE.test(code)) {
      toast.error("کد تخفیف باید ۳ تا ۲۰ نویسه حروف/اعداد انگلیسی بزرگ باشد.");
      return;
    }
    const duplicate = promos.find(
      (p) => p.code.trim().toUpperCase() === code && p.id !== selected.id,
    );
    if (duplicate) {
      toast.error("کدی با این نام از قبل وجود دارد؛ نام‌ها باید یکتا باشند.");
      return;
    }
    const input = {
      code,
      discountPercentage: Math.min(100, Math.max(0, selected.discountPercentage)),
      maxDiscountAmount: Math.max(0, Math.round(selected.maxDiscountAmount)),
      minPurchaseAmount: Math.max(0, Math.round(selected.minPurchaseAmount)),
      usageLimit: Math.max(0, Math.round(selected.usageLimit)),
      isActive: selected.isActive,
    };
    savePromo.mutate(
      { id: isNew ? undefined : selected.id, input },
      {
        onSuccess: (saved) => {
          toast.success(
            isNew
              ? `کد «${saved.code}» ایجاد شد و در صفحه‌ی پرداخت فعال است.`
              : `کد «${saved.code}» به‌روزرسانی شد؛ در صفحه‌ی پرداخت فعال است.`,
          );
          // Drop the edit buffer and re-point at the live row (the mutation
          // invalidates the promos query, so the refreshed list renders).
          setDraft(null);
          setSelectedId(String(saved.id));
          setDirty(false);
        },
        onError: (err) => {
          toast.error(`ذخیره‌ی کد تخفیف ناموفق بود: ${err.message}`);
        },
      },
    );
  };

  if (isPending) {
    return (
      <div className="grid min-h-64 place-items-center text-xs text-muted-foreground">
        بارگذاری کدهای تخفیف…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="grid min-h-64 place-items-center px-10 text-center text-xs text-muted-foreground">
        بارگذاری کدهای تخفیف ناموفق بود؛ اتصال به سرور فروشگاه را بررسی کنید.
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">مدیریت تخفیف‌ها</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            کدهای هدیه و تخفیف صفحه‌ی پرداخت — وضعیت و سقف استفاده هر کد را همین‌جا تنظیم کنید.
          </p>
        </div>
        <span
          className={
            dirty
              ? "rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary-soft"
              : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-muted-foreground"
          }
        >
          {dirty ? "تغییرات ذخیره‌نشده" : "همگام با فروشگاه"}
        </span>
      </div>

      {/* Master–detail split pane */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Master: promo code list */}
        <div className="overflow-hidden rounded-xl border border-white/5 bg-[#151311]">
          <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
            <p className="text-xs font-extrabold text-primary-soft">
              کدها ({toFa(promos.length + (isNew ? 1 : 0))})
            </p>
            <Button
              type="button"
              size="sm"
              onClick={addPromo}
              disabled={isNew}
              className="bg-linear-to-l from-primary to-primary-soft font-bold text-primary-foreground"
            >
              <Plus className="size-3.5" />
              افزودن کد
            </Button>
          </div>

          {promos.length === 0 && !isNew ? (
            <div className="grid place-items-center gap-3 px-4 py-12 text-center">
              <Tag className="size-8 text-muted-foreground/40" />
              <p className="text-xs leading-6 text-muted-foreground">
                هیچ کد تخفیفی وجود ندارد.
                <br />
                کد جدیدی بسازید.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={addPromo}
                className="bg-linear-to-l from-primary to-primary-soft font-bold text-primary-foreground"
              >
                <Plus className="size-3.5" />
                افزودن کد
              </Button>
            </div>
          ) : (
            <ul className="max-h-[560px] space-y-2 overflow-y-auto p-3">
              {isNew && draft && (
                <li
                  className={cn(
                    "rounded-lg border border-primary/50 bg-primary/10",
                  )}
                >
                  <div className="flex items-center gap-2.5 p-2">
                    <span className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
                      <span className="grid size-11 shrink-0 place-items-center rounded-md border border-primary/40 bg-primary/10 font-mono text-[11px] font-bold text-primary-soft">
                        {draft.code ? draft.code.slice(0, 8) : "—"}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-foreground">
                          {draft.code.trim() || "کد جدید (ذخیره‌نشده)"}
                        </span>
                      </span>
                    </span>
                  </div>
                </li>
              )}
              {promos.map((p) => {
                const isSelected = p.id === selected?.id && !isNew;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "rounded-lg border transition-colors",
                      isSelected
                        ? "border-primary/50 bg-primary/10"
                        : "border-white/5 bg-[#1c1916] hover:border-white/15",
                    )}
                  >
                    <div className="flex items-center gap-2.5 p-2">
                      <button
                        type="button"
                        onClick={() => selectPromo(p.id)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-start"
                      >
                        <span
                          className={cn(
                            "grid size-11 shrink-0 place-items-center rounded-md border font-mono text-[11px] font-bold",
                            p.isActive
                              ? "border-primary/40 bg-primary/10 text-primary-soft"
                              : "border-white/10 bg-[#25221e] text-muted-foreground/60",
                          )}
                        >
                          {p.code ? p.code.slice(0, 8) : "—"}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-foreground">
                            {p.code.trim() || "کد بدون نام"}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="inline-flex items-center gap-0.5">
                              <Percent className="size-2.5" />
                              {toFa(p.discountPercentage)}٪
                            </span>
                            <span>·</span>
                            <span>
                              {toFa(p.timesUsed)}
                              {p.usageLimit > 0 ? ` از ${toFa(p.usageLimit)}` : " استفاده"}
                            </span>
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                p.isActive ? "bg-emerald-400" : "bg-rose-400",
                              )}
                            />
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label="حذف کد"
                        onClick={() => removePromo(p.id)}
                        disabled={deletePromo.isPending}
                        className="grid size-6 shrink-0 place-items-center rounded border border-white/10 text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail: editor for the selected code */}
        <div className="overflow-hidden rounded-xl border border-white/5 bg-[#151311]">
          {selected ? (
            <>
              {/* Live preview — mirrors the chip the customer sees at checkout */}
              <div className="border-b border-white/5 bg-[#1c1916] px-5 py-6">
                <p className="text-[10px] font-bold text-muted-foreground">
                  پیش‌نمایش — همان‌طور که مشتری در صفحه‌ی پرداخت می‌بیند
                </p>
                <div className="mx-auto mt-3 flex w-fit items-center justify-between gap-4 rounded-xl border border-primary/40 bg-primary/[0.07] px-4 py-3">
                  <span className="flex items-center gap-2 text-xs font-bold text-primary-soft">
                    <Ticket className="size-4" />
                    کد{" "}
                    <span dir="ltr" className="font-mono">
                      {selected.code.trim().toUpperCase() || "…"}
                    </span>{" "}
                    —{" "}
                    {formatPrice(
                      promoDiscount(
                        { ...selected, code: selected.code.trim().toUpperCase() || "X" },
                        1_000_000,
                      ),
                    )}{" "}
                    تخفیف
                  </span>
                </div>
                <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
                  تخفیف محاسبه‌شده روی سبد نمایشی ۱,۰۰۰,۰۰۰ تومانی
                </p>
              </div>

              {/* Editor form */}
              <form onSubmit={submit} className="space-y-5 p-5">
                <div>
                  <p className="text-xs font-extrabold text-primary-soft">
                    {isNew
                      ? "کد تخفیف جدید"
                      : `ویرایش کد ${toFa(selectedIndex + 1)} از ${toFa(promos.length)}`}
                  </p>
                  <Separator className="mt-2 bg-white/5" />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="promo-code" className="text-xs text-foreground/80">
                      کد تخفیف (حروف بزرگ انگلیسی)
                    </Label>
                    <Input
                      id="promo-code"
                      dir="ltr"
                      value={selected.code}
                      onChange={(e) => updateSelected({ code: e.target.value.toUpperCase() })}
                      placeholder="LUXURY20"
                      className="border-white/10 bg-[#1c1916] font-mono text-start placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promo-pct" className="text-xs text-foreground/80">
                      درصد تخفیف (٪)
                    </Label>
                    <Input
                      id="promo-pct"
                      dir="ltr"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={selected.discountPercentage}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateSelected({
                          discountPercentage: raw === "" ? 0 : Number(raw),
                        });
                      }}
                      className="border-white/10 bg-[#1c1916] text-start placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="promo-cap" className="text-xs text-foreground/80">
                      سقف مبلغ تخفیف (تومان)
                    </Label>
                    <Input
                      id="promo-cap"
                      dir="ltr"
                      type="number"
                      min={0}
                      step={10000}
                      value={selected.maxDiscountAmount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateSelected({
                          maxDiscountAmount: raw === "" ? 0 : Number(raw),
                        });
                      }}
                      className="border-white/10 bg-[#1c1916] text-start placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
                    />
                    <p className="text-[10px] text-muted-foreground/70">۰ = بدون سقف</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promo-min" className="text-xs text-foreground/80">
                      حداقل مبلغ خرید (تومان)
                    </Label>
                    <Input
                      id="promo-min"
                      dir="ltr"
                      type="number"
                      min={0}
                      step={100000}
                      value={selected.minPurchaseAmount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateSelected({ minPurchaseAmount: raw === "" ? 0 : Number(raw) });
                      }}
                      className="border-white/10 bg-[#1c1916] text-start placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
                    />
                    <p className="text-[10px] text-muted-foreground/70">
                      ۰ = بدون حداقل؛ کد روی سبدهای زیر این مبلغ اعمال نمی‌شود
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promo-limit" className="text-xs text-foreground/80">
                      سقف استفاده سراسری (تعداد)
                    </Label>
                    <Input
                      id="promo-limit"
                      dir="ltr"
                      type="number"
                      min={0}
                      step={1}
                      value={selected.usageLimit}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateSelected({ usageLimit: raw === "" ? 0 : Number(raw) });
                      }}
                      className="border-white/10 bg-[#1c1916] text-start placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
                    />
                    <p className="text-[10px] text-muted-foreground/70">۰ = نامحدود</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promo-used" className="text-xs text-foreground/80">
                      دفعات استفاده‌شده
                    </Label>
                    <Input
                      id="promo-used"
                      dir="ltr"
                      type="number"
                      value={selected.timesUsed}
                      readOnly
                      className="border-white/10 bg-[#1c1916] text-start text-muted-foreground/70 focus-visible:border-white/10 focus-visible:ring-0"
                    />
                    <p className="text-[10px] text-muted-foreground/70">
                      با هر سفارش موفق به‌صورت خودکار افزایش می‌یابد
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">کد فعال است</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      کد غیرفعال در صفحه‌ی پرداخت «منقضی شده» اعلام می‌شود.
                    </p>
                  </div>
                  <Switch
                    checked={selected.isActive}
                    onCheckedChange={(v) => updateSelected({ isActive: v })}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    type="submit"
                    disabled={savePromo.isPending}
                    className="h-10 bg-linear-to-l from-primary to-primary-soft font-bold text-primary-foreground transition-all duration-300 hover:opacity-90"
                  >
                    <Save className="size-4" />
                    {isNew ? "ایجاد کد تخفیف" : "ذخیره تغییرات"}
                  </Button>
                </div>

                <p className="flex items-start gap-2 rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3 text-[11px] leading-6 text-muted-foreground">
                  <Tag className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  مشتری در صفحه‌ی پرداخت کد را وارد می‌کند؛ اعتبارسنجی فعال بودن و سقف استفاده
                  توسط سرور انجام می‌شود و مبلغ تخفیف روی جمع سبد (با سقف مبلغ) محاسبه می‌گردد.
                </p>
              </form>
            </>
          ) : (
            <div className="grid min-h-72 place-items-center px-4 py-10 text-center">
              <div>
                <Tag className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-bold text-foreground">
                  کدی برای ویرایش انتخاب نشده است
                </p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  از فهرست کدها یکی را انتخاب کنید یا کد جدیدی بسازید.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}