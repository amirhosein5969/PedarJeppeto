import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  ImageIcon,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  clearAdminHeroSlides,
  defaultHeroSlidesAsAdmin,
  loadAdminHeroSlides,
  newHeroSlideId,
  saveAdminHeroSlides,
  type HeroSlide,
} from "@/lib/admin-hero";
import { toFa } from "@/lib/shop-data";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
// Static imagery is served from `public/` at the site root.
const defaultHeroImg = "/hero-workshop.jpg";

export const Route = createFileRoute("/admin/storefront")({
  component: AdminStorefront,
  head: () => ({
    meta: [{ title: "اسلایدر صفحه‌ی نخست | چوب‌کار" }],
  }),
});

function AdminStorefront() {
  // SSR-safe: the localStorage-backed slide array hydrates on the client only.
  const [loaded, setLoaded] = useState(false);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const saved = loadAdminHeroSlides();
    const initial = saved.length > 0 ? saved : defaultHeroSlidesAsAdmin();
    setSlides(initial);
    setSelectedId(initial[0]?.id ?? null);
    setLoaded(true);
  }, []);

  const selected = useMemo(
    () => slides.find((s) => s.id === selectedId) ?? slides[0] ?? null,
    [slides, selectedId],
  );
  const selectedIndex = selected ? slides.findIndex((s) => s.id === selected.id) : -1;

  const addSlide = () => {
    const slide: HeroSlide = { id: newHeroSlideId(), tag: "", title: "", subtitle: "", image: "" };
    setSlides((prev) => [...prev, slide]);
    setSelectedId(slide.id);
    setDirty(true);
  };

  const removeSlide = (id: string) => {
    const next = slides.filter((s) => s.id !== id);
    setSlides(next);
    if (id === selectedId) setSelectedId(next[0]?.id ?? null);
    setDirty(true);
    toast.success("بنر از فهرست حذف شد؛ با «ذخیره تغییرات» در فروشگاه اعمال می‌شود.");
  };

  const moveSlide = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      if (!moved) return prev;
      next.splice(target, 0, moved);
      return next;
    });
    setDirty(true);
  };

  const updateSelected = (patch: Partial<Omit<HeroSlide, "id">>) => {
    if (!selected) return;
    const id = selected.id;
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirty(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const invalid = slides.find((s) => s.title.trim().length < 3);
    if (invalid) {
      setSelectedId(invalid.id);
      toast.error("تایتل اصلی هر بنر باید حداقل ۳ نویسه باشد.");
      return;
    }
    saveAdminHeroSlides(
      slides.map((s) => ({
        ...s,
        tag: s.tag.trim(),
        title: s.title.trim(),
        subtitle: s.subtitle.trim(),
        image: s.image.trim(),
      })),
    );
    setDirty(false);
    toast.success("اسلایدر صفحه‌ی نخست به‌روزرسانی شد.");
  };

  const reset = () => {
    clearAdminHeroSlides();
    const fresh = defaultHeroSlidesAsAdmin();
    setSlides(fresh);
    setSelectedId(fresh[0]?.id ?? null);
    setDirty(false);
    toast.success("بنرها به حالت پیش‌فرض برگشتند.");
  };

  if (!loaded) {
    return (
      <div className="grid min-h-64 place-items-center text-xs text-muted-foreground">
        بارگذاری تنظیمات…
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">
            اسلایدر صفحه‌ی نخست
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            بنرهای چهره‌ی فروشگاه — ترتیب فهرست، همان ترتیب نمایش در اسلایدر است.
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
        {/* Master: reorderable banner list */}
        <div className="overflow-hidden rounded-xl border border-white/5 bg-[#151311]">
          <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
            <p className="text-xs font-extrabold text-primary-soft">
              بنرهای اسلایدر ({toFa(slides.length)})
            </p>
            <Button
              type="button"
              size="sm"
              onClick={addSlide}
              className="bg-linear-to-l from-primary to-primary-soft font-bold text-primary-foreground"
            >
              <Plus className="size-3.5" />
              افزودن بنر
            </Button>
          </div>

          {slides.length === 0 ? (
            <div className="grid place-items-center gap-3 px-4 py-12 text-center">
              <ImageIcon className="size-8 text-muted-foreground/40" />
              <p className="text-xs leading-6 text-muted-foreground">
                هیچ بنری وجود ندارد.
                <br />
                بنر جدیدی بسازید یا به حالت پیش‌فرض برگردید.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={addSlide}
                  className="bg-linear-to-l from-primary to-primary-soft font-bold text-primary-foreground"
                >
                  <Plus className="size-3.5" />
                  افزودن بنر
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={reset}
                  className="border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                  حالت پیش‌فرض
                </Button>
              </div>
            </div>
          ) : (
            <ul className="max-h-[560px] space-y-2 overflow-y-auto p-3">
              {slides.map((s, i) => {
                const isSelected = s.id === selected?.id;
                return (
                  <li
                    key={s.id}
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
                        onClick={() => setSelectedId(s.id)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-start"
                      >
                        {s.image ? (
                          <img
                            src={s.image}
                            alt=""
                            className="size-11 shrink-0 rounded-md border border-white/10 object-cover"
                          />
                        ) : (
                          <span className="grid size-11 shrink-0 place-items-center rounded-md border border-white/10 bg-[#25221e] text-muted-foreground/60">
                            <ImageIcon className="size-4" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-foreground">
                            {s.title.trim() || "بنر بدون تایتل"}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                            {s.tag.trim() || "بدون تگ"}
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label="جابه‌جایی به بالا"
                          disabled={i === 0}
                          onClick={() => moveSlide(i, -1)}
                          className="grid size-6 place-items-center rounded border border-white/10 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ArrowUp className="size-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="جابه‌جایی به پایین"
                          disabled={i === slides.length - 1}
                          onClick={() => moveSlide(i, 1)}
                          className="grid size-6 place-items-center rounded border border-white/10 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ArrowDown className="size-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="حذف بنر"
                          onClick={() => removeSlide(s.id)}
                          className="grid size-6 place-items-center rounded border border-white/10 text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail: editor for the selected banner */}
        <div className="overflow-hidden rounded-xl border border-white/5 bg-[#151311]">
          {selected ? (
            <>
              {/* Live preview — mirrors the storefront hero slide */}
              <div className="relative h-52 overflow-hidden border-b border-white/5 sm:h-64">
                <img
                  src={selected.image || defaultHeroImg}
                  alt="پیش‌نمایش بنر"
                  className="absolute inset-0 size-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-l from-[#12100d] via-[#12100d]/70 to-[#12100d]/30" />
                <div className="relative flex h-full flex-col justify-center gap-2 px-6">
                  {selected.tag.trim() && (
                    <span className="w-fit rounded-full border border-primary/50 bg-background/50 px-3 py-1 text-[11px] text-primary-soft">
                      {selected.tag}
                    </span>
                  )}
                  <h2 className="max-w-md text-2xl leading-snug font-extrabold text-foreground sm:text-3xl">
                    {selected.title.trim() || (
                      <span className="text-foreground/40">تایتل اصلی بنر…</span>
                    )}
                  </h2>
                  <p className="max-w-md text-xs leading-7 text-muted-foreground sm:text-sm">
                    {selected.subtitle.trim() || (
                      <span className="text-muted-foreground/40">توضیحات زیرین بنر…</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Editor form */}
              <form onSubmit={submit} className="space-y-5 p-5">
                <div>
                  <p className="text-xs font-extrabold text-primary-soft">
                    ویرایش بنر {toFa(selectedIndex + 1)} از {toFa(slides.length)}
                  </p>
                  <Separator className="mt-2 bg-white/5" />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="hero-tag" className="text-xs text-foreground/80">
                      تگ بالای عنوان
                    </Label>
                    <Input
                      id="hero-tag"
                      value={selected.tag}
                      onChange={(e) => updateSelected({ tag: e.target.value })}
                      placeholder="مثلاً کارگاه چوب‌کار"
                      className="border-white/10 bg-[#1c1916] placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hero-title" className="text-xs text-foreground/80">
                      تایتل اصلی
                    </Label>
                    <Input
                      id="hero-title"
                      value={selected.title}
                      onChange={(e) => updateSelected({ title: e.target.value })}
                      placeholder="مثلاً چوب، دست، و کمی صبر"
                      className="border-white/10 bg-[#1c1916] placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hero-subtitle" className="text-xs text-foreground/80">
                    توضیحات زیرین
                  </Label>
                  <Textarea
                    id="hero-subtitle"
                    rows={2}
                    value={selected.subtitle}
                    onChange={(e) => updateSelected({ subtitle: e.target.value })}
                    placeholder="مثلاً هر قطعه در کارگاه ما دست‌ساز می‌شود"
                    className="border-white/10 bg-[#1c1916] placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-foreground/80">تصویر پس‌زمینه</Label>
                  <ImageUploadField
                    value={selected.image}
                    onChange={(url) => updateSelected({ image: url })}
                    emptyLabel="با خالی گذاشتن، تصویر پیش‌فرض کارگاه نمایش داده می‌شود"
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
                    بازگشت به حالت پیش‌فرض
                  </Button>
                </div>

                <p className="flex items-start gap-2 rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3 text-[11px] leading-6 text-muted-foreground">
                  <ImagePlus className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  ترتیب بنرها در فهرست، همان ترتیب اسلایدر صفحه‌ی نخست است؛ با دکمه‌های جابه‌جایی
                  ترتیب را عوض کنید. افزودن، حذف و جابه‌جایی پس از «ذخیره تغییرات» در فروشگاه اعمال
                  می‌شود.
                </p>
              </form>
            </>
          ) : (
            <div className="grid min-h-72 place-items-center px-4 py-10 text-center">
              <div>
                <ImageIcon className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-bold text-foreground">
                  بنری برای ویرایش انتخاب نشده است
                </p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  از فهرست بنرها یکی را انتخاب کنید یا بنر جدیدی بسازید.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
