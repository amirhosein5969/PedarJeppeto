import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CalendarHeart,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import {
  useDeleteAddress,
  useMyAddresses,
  useMyProfile,
  useSaveAddress,
  useSaveProfile,
} from "@/hooks/queries";
import type { ApiUserAddress } from "@/lib/api-types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/profile/account")({
  component: ProfileAccount,
  head: () => ({
    meta: [
      { title: "پروفایل من | چوب‌کار" },
      { name: "description", content: "ویرایش اطلاعات و دفترچه‌ی آدرس‌های حساب کاربری چوب‌کار." },
    ],
  }),
});

type ProfileForm = { fullName: string; importantDate: string };

type AddressForm = {
  title: string;
  province: string;
  city: string;
  zipCode: string;
  address: string;
  isDefault: boolean;
};

const EMPTY_ADDRESS: AddressForm = {
  title: "",
  province: "",
  city: "",
  zipCode: "",
  address: "",
  isDefault: false,
};

const ZIP_RE = /^\d{10}$/;

function ProfileAccount() {
  const { user } = useAuth();
  const { data: profile, isPending, isError, error } = useMyProfile();
  const saveProfile = useSaveProfile();

  const { data: addresses, isPending: addrPending } = useMyAddresses();
  const saveAddress = useSaveAddress();
  const deleteAddress = useDeleteAddress();

  const [profileForm, setProfileForm] = useState<ProfileForm>({ fullName: "", importantDate: "" });
  const hydrated = useRef(false);

  // Fill the profile form once it arrives (or once the 404 empty-state settles).
  useEffect(() => {
    if (hydrated.current) return;
    if (isPending) return;
    hydrated.current = true;
    if (profile) {
      setProfileForm({
        fullName: profile.full_name ?? "",
        importantDate: profile.important_date ?? "",
      });
    }
  }, [isPending, profile]);

  // Address-book draft: null = list view, else the form being created/edited.
  const [draft, setDraft] = useState<AddressForm | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // A 404 is "signed in, no saved profile yet" — a first-run empty form.
  const isFresh = isError && error instanceof ApiError && error.status === 404;
  const isFatal = isError && !isFresh;

  if (isFatal) {
    return (
      <StateCard tone="error">
        <p>بارگذاری پروفایل انجام نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید.</p>
      </StateCard>
    );
  }

  const submitProfile = (e: FormEvent) => {
    e.preventDefault();
    const name = profileForm.fullName.trim();
    if (name.length < 3) {
      toast.error("نام و نام خانوادگی را کامل وارد کنید.");
      return;
    }
    saveProfile.mutate(
      { full_name: name, important_date: profileForm.importantDate.trim() || null },
      {
        onSuccess: () => toast.success("پروفایل شما با موفقیت به‌روزرسانی شد."),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "ذخیره‌ی پروفایل ناموفق بود."),
      },
    );
  };

  // ---- address book actions -------------------------------------------------

  const startNew = () => {
    setEditingId(null);
    setDraft({ ...EMPTY_ADDRESS, isDefault: (addresses?.length ?? 0) === 0 });
  };

  const startEdit = (a: ApiUserAddress) => {
    setEditingId(a.id);
    setDraft({
      title: a.title,
      province: a.province ?? "",
      city: a.city ?? "",
      zipCode: a.zip_code ?? "",
      address: a.address ?? "",
      isDefault: a.is_default,
    });
  };

  const cancelDraft = () => {
    setDraft(null);
    setEditingId(null);
  };

  const submitAddress = (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const province = draft.province.trim();
    const city = draft.city.trim();
    const address = draft.address.trim();
    if (province.length < 2) {
      toast.error("استان را وارد کنید.");
      return;
    }
    if (city.length < 2) {
      toast.error("شهر را وارد کنید.");
      return;
    }
    if (address.length < 10) {
      toast.error("نشانی کامل را وارد کنید (حداقل ۱۰ حرف).");
      return;
    }
    if (draft.zipCode.trim() !== "" && !ZIP_RE.test(draft.zipCode.trim())) {
      toast.error("کد پستی باید ۱۰ رقم باشد.");
      return;
    }

    saveAddress.mutate(
      {
        id: editingId ?? undefined,
        input: {
          title: draft.title.trim() || "آدرس",
          province,
          city,
          zip_code: draft.zipCode.trim() || null,
          address,
          is_default: draft.isDefault,
        },
      },
      {
        onSuccess: () => {
          toast.success(editingId ? "آدرس به‌روزرسانی شد." : "آدرس جدید ذخیره شد.");
          cancelDraft();
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "ذخیره‌ی آدرس ناموفق بود."),
      },
    );
  };

  const setDefault = (a: ApiUserAddress) => {
    saveAddress.mutate(
      { id: a.id, input: { is_default: true } },
      {
        onSuccess: () => toast.success(`«${a.title}» آدرس پیش‌فرض شد.`),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "تغییر آدرس پیش‌فرض ناموفق بود."),
      },
    );
  };

  const removeAddress = (a: ApiUserAddress) => {
    deleteAddress.mutate(a.id, {
      onSuccess: () => toast.success("آدرس حذف شد."),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "حذف آدرس ناموفق بود."),
    });
  };

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------- */}
      {/* Profile identity (name + important dates)                         */}
      {/* ---------------------------------------------------------------- */}
      <form onSubmit={submitProfile} className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-extrabold text-foreground">پروفایل من</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              اطلاعات تماس شما را همیشه به‌روز نگه دارید.
            </p>
          </div>
          {isFresh && (
            <span className="rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1 text-[10px] font-bold text-primary-soft">
              اولین ویرایش شما
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <p className="text-[11px] font-bold text-muted-foreground">شماره موبایل</p>
              <p
                dir="ltr"
                className="mt-0.5 text-left font-mono text-sm font-bold tracking-wider text-foreground"
              >
                {user?.phone}
              </p>
            </div>
          </div>
          <p className="text-[10px] leading-5 text-muted-foreground/70">
            مبنای حساب شماست و قابل تغییر نیست.
          </p>
        </div>

        <div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6">
          <Field label="نام و نام خانوادگی" htmlFor="pf-name" className="sm:col-span-2">
            <input
              id="pf-name"
              value={profileForm.fullName}
              onChange={(e) =>
                setProfileForm((p) => ({ ...p, fullName: e.target.value }))
              }
              placeholder="مثلا: پارسا جلیلو"
              className={inputCls}
              required
            />
          </Field>

          <Field
            label="تاریخ‌های مهم"
            htmlFor="pf-important"
            className="sm:col-span-2"
            hint="تولد، سالگرد و روزهای خاص برای ارسال هدایای ویژه (اختیاری)."
          >
            <div className="relative">
              <CalendarHeart className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <input
                id="pf-important"
                value={profileForm.importantDate}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, importantDate: e.target.value }))
                }
                placeholder="مثلا: تولد: ۱۳۷۵/۰۴/۲۰ — سالگرد: ۱۳۹۸/۰۶/۱۲"
                className={`${inputCls} pr-11`}
              />
            </div>
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 px-5 py-4 sm:px-6">
          <button
            type="submit"
            disabled={saveProfile.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveProfile.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saveProfile.isPending ? "در حال ذخیره…" : "ثبت تغییرات"}
          </button>
        </div>
      </form>

      {/* ---------------------------------------------------------------- */}
      {/* Address book (Phase 7)                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border/60 px-5 py-4 sm:px-6">
          <h2 className="text-base font-extrabold text-foreground">دفترچه‌ی آدرس‌ها</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            آدرس‌های ارسال را مدیریت کنید؛ آدرس هر سفارش به‌صورت خودکار اینجا ذخیره می‌شود.
          </p>
        </div>

        <div className="px-5 py-6 sm:px-6">
          {draft ? (
            <form onSubmit={submitAddress} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="عنوان (مثلا: خانه)" htmlFor="ad-title" className="sm:col-span-2">
                  <input
                    id="ad-title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="خانه، محل کار، …"
                    className={inputCls}
                  />
                </Field>
                <Field label="استان" htmlFor="ad-province">
                  <input
                    id="ad-province"
                    value={draft.province}
                    onChange={(e) => setDraft({ ...draft, province: e.target.value })}
                    placeholder="مثلا: تهران"
                    className={inputCls}
                  />
                </Field>
                <Field label="شهر" htmlFor="ad-city">
                  <input
                    id="ad-city"
                    value={draft.city}
                    onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                    placeholder="مثلا: تهران"
                    className={inputCls}
                  />
                </Field>
                <Field label="کد پستی (اختیاری)" htmlFor="ad-zip">
                  <input
                    id="ad-zip"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={10}
                    value={draft.zipCode}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        zipCode: e.target.value.replace(/\D/g, "").slice(0, 10),
                      })
                    }
                    placeholder="1234567890"
                    className={`${inputCls} text-left font-mono tracking-wider`}
                  />
                </Field>
                <Field label="نشانی کامل" htmlFor="ad-address">
                  <input
                    id="ad-address"
                    value={draft.address}
                    onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                    placeholder="خیابان، کوچه، پلاک، واحد"
                    className={inputCls}
                  />
                </Field>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <span className="text-xs font-bold text-foreground/80">
                  آدرس پیش‌فرض برای سفارش‌های بعدی
                </span>
                <Switch
                  checked={draft.isDefault}
                  onCheckedChange={(v) => setDraft({ ...draft, isDefault: v })}
                />
              </label>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelDraft}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-background"
                >
                  <X className="size-4" /> انصراف
                </button>
                <button
                  type="submit"
                  disabled={saveAddress.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saveAddress.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {saveAddress.isPending
                    ? "در حال ذخیره…"
                    : editingId
                      ? "به‌روزرسانی آدرس"
                      : "ذخیره‌ی آدرس"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {addrPending ? (
                <div className="grid min-h-24 place-items-center text-xs text-muted-foreground">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              ) : addresses && addresses.length > 0 ? (
                addresses.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      "rounded-xl border p-4 transition-colors",
                      a.is_default ? "border-primary/50 bg-primary/[0.04]" : "border-border",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <MapPin className="size-4 shrink-0 text-primary" />
                          <span className="text-sm font-bold text-foreground">{a.title}</span>
                          {a.is_default && (
                            <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary-soft">
                              پیش‌فرض
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
                          {[a.province, a.city, a.address, a.zip_code ? `کد پستی ${a.zip_code}` : ""]
                            .filter(Boolean)
                            .join("، ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!a.is_default && (
                          <IconButton
                            label="آدرس پیش‌فرض"
                            onClick={() => setDefault(a)}
                            className="hover:border-primary/50 hover:text-primary-soft"
                          >
                            <Star className="size-4" />
                          </IconButton>
                        )}
                        <IconButton label="ویرایش آدرس" onClick={() => startEdit(a)}>
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton
                          label="حذف آدرس"
                          onClick={() => removeAddress(a)}
                          className="hover:border-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-border p-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    هنوز آدرسی ثبت نشده است. با اولین سفارش یا افزودن دستی ذخیره می‌شود.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={startNew}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/50 px-5 py-3 text-sm font-bold text-primary-soft transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="size-4" /> افزودن آدرس جدید
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Shared input styling — the same quiet language as the auth page. */
const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-primary";

function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-xs font-bold text-foreground/80">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1.5 text-[10px] leading-5 text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function StateCard({ tone, children }: { tone: "error"; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] px-6 py-10 text-center">
      <p className="text-sm font-bold text-rose-400">{children}</p>
    </div>
  );
}