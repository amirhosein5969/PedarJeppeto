import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MoreVertical, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  loadAdminCategories,
  newAdminCategoryId,
  saveAdminCategories,
  type AdminCategory,
} from "@/lib/admin-categories";
import { useAdminCatalog } from "@/hooks/queries";
import { toFa } from "@/lib/shop-data";
import { useTableSort } from "@/lib/use-table-sort";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { SortHead } from "@/components/admin/SortHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategories,
  head: () => ({
    meta: [{ title: "مدیریت دسته‌بندی‌ها | چوب‌کار" }],
  }),
});

/** URL-safe slug: lowercase latin words joined by single dashes. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function AdminCategories() {
  // SSR-safe: the localStorage-backed list hydrates on the client only.
  const [items, setItems] = useState<AdminCategory[] | null>(null);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formImage, setFormImage] = useState("");
  // Live catalog (backend) — the per-slug product counts come from here.
  const { data: catalog } = useAdminCatalog();

  useEffect(() => {
    setItems(loadAdminCategories());
  }, []);

  // How many live catalog products point at each category slug.
  useEffect(() => {
    const counts: Record<string, number> = {};
    for (const p of catalog?.products ?? []) {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    setProductCounts(counts);
  }, [catalog]);

  const productCount = (slug: string) => productCounts[slug] ?? 0;

  // Stable across renders (only changes when the counts do), so the sort
  // memo does not churn.
  const categorySortValue = useCallback(
    (c: AdminCategory, key: string): string | number => {
      switch (key) {
        case "title":
          return c.title;
        case "slug":
          return c.slug;
        case "count":
          return productCounts[c.slug] ?? 0;
        default:
          return 0;
      }
    },
    [productCounts],
  );

  const { sort, toggleSort, sorted } = useTableSort(items, categorySortValue);

  const commit = (next: AdminCategory[]) => {
    setItems(next);
    saveAdminCategories(next);
  };

  const openNew = () => {
    setEditingId(null);
    setFormTitle("");
    setFormSlug("");
    setFormImage("");
    setSheetOpen(true);
  };

  const openEdit = (c: AdminCategory) => {
    setEditingId(c.id);
    setFormTitle(c.title);
    setFormSlug(c.slug);
    setFormImage(c.image);
    setSheetOpen(true);
  };

  const submitForm = (e: FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    const slug = formSlug.trim();
    const image = formImage.trim();
    if (title.length < 3) {
      toast.error("عنوان دسته‌بندی حداقل ۳ نویسه باشد.");
      return;
    }
    if (!SLUG_RE.test(slug)) {
      toast.error("لینک دسته‌بندی فقط حروف کوچک انگلیسی و خط تیره باشد (مثلا serving-board).");
      return;
    }
    if (!image) {
      toast.error("تصویر دسته‌بندی الزامی است.");
      return;
    }
    const duplicate = (items ?? []).some((c) => c.slug === slug && c.id !== editingId);
    if (duplicate) {
      toast.error("این لینک (اسلاگ) قبلا‌ً برای دسته‌بندی دیگری استفاده شده است.");
      return;
    }

    if (editingId) {
      commit((items ?? []).map((c) => (c.id === editingId ? { ...c, title, slug, image } : c)));
      toast.success(`دسته‌بندی «${title}» به‌روزرسانی شد.`);
    } else {
      commit([{ id: newAdminCategoryId(), title, slug, image }, ...(items ?? [])]);
      toast.success(`دسته‌بندی «${title}» اضافه شد.`);
    }
    setSheetOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    commit((items ?? []).filter((c) => c.id !== deleteTarget.id));
    toast.success(`دسته‌بندی «${deleteTarget.title}» حذف شد.`);
    setDeleteTarget(null);
  };

  return (
    <div>
      {/* Page header + primary action */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">دسته‌بندی‌ها</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            مدیریت دسته‌بندی‌های کاتالوگ
            {items ? ` — ${toFa(items.length)} دسته` : ""}
          </p>
        </div>
        <Button
          onClick={openNew}
          className="h-10 bg-linear-to-l from-primary to-primary-soft font-bold text-primary-foreground shadow-soft transition-all duration-300 hover:opacity-90"
        >
          <Plus className="size-4" />
          افزودن دسته‌بندی
        </Button>
      </div>

      {/* Data table card */}
      <div className="mt-6 overflow-hidden rounded-xl border border-white/5 bg-[#151311]">
        {sorted === null ? (
          <div className="grid min-h-64 place-items-center text-xs text-muted-foreground">
            بارگذاری دسته‌بندی‌ها…
          </div>
        ) : sorted.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-10 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Tags className="size-6" />
              </span>
              <p className="mt-4 text-sm font-bold text-foreground">دسته‌بندی‌ای ثبت نشده است</p>
              <p className="mt-1 text-xs text-muted-foreground">
                با دکمه‌ی «افزودن دسته‌بندی» شروع کنید.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="w-20 text-right text-xs font-bold text-muted-foreground">
                  تصویر
                </TableHead>
                <SortHead
                  label="عنوان دسته‌بندی"
                  sortKey="title"
                  sort={sort}
                  onSort={toggleSort}
                  className="min-w-48"
                />
                <SortHead label="لینک" sortKey="slug" sort={sort} onSort={toggleSort} />
                <SortHead label="محصولات" sortKey="count" sort={sort} onSort={toggleSort} />
                <TableHead className="w-14 text-right text-xs font-bold text-muted-foreground">
                  عملیات
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => (
                <TableRow key={c.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="p-3">
                    <div className="size-12 overflow-hidden rounded-lg border border-white/5 bg-[#1c1916]">
                      <img
                        src={c.image}
                        alt={c.title}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <p className="max-w-64 truncate text-sm font-bold text-foreground">{c.title}</p>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <code
                      dir="ltr"
                      className="rounded-md border border-white/5 bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-muted-foreground"
                    >
                      /{c.slug}
                    </code>
                  </TableCell>
                  <TableCell className="py-3.5 text-xs font-bold text-foreground/85">
                    {toFa(productCount(c.slug))} محصول
                  </TableCell>
                  <TableCell className="py-3.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`عملیات ${c.title}`}
                          className="size-8 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="z-[200] border-white/10 bg-[#1a1714]"
                      >
                        <DropdownMenuItem
                          onClick={() => {
                            openEdit(c);
                          }}
                        >
                          <Pencil />
                          ویرایش
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setDeleteTarget(c);
                          }}
                        >
                          <Trash2 />
                          حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add / edit category sheet — left side to avoid the RTL sidebar */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
        }}
      >
        <SheetContent
          side="left"
          className="z-[100] w-full overflow-y-auto border-white/5 bg-[#151311] sm:max-w-md"
        >
          <SheetHeader className="text-start">
            <SheetTitle className="text-foreground">
              {editingId ? "ویرایش دسته‌بندی" : "افزودن دسته‌بندی جدید"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              عنوان، لینک و تصویر دسته‌بندی در صفحه‌ی دسته‌بندی فروشگاه نمایش داده می‌شود.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={submitForm} className="space-y-5 px-4 pb-6 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="category-title" className="text-xs text-foreground/80">
                عنوان دسته‌بندی
              </Label>
              <Input
                id="category-title"
                value={formTitle}
                onChange={(e) => {
                  setFormTitle(e.target.value);
                }}
                placeholder="مثلا‌ً ظروف و ابزار آشپزخانه چوبی"
                className="border-white/10 bg-[#1c1916] placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-slug" className="text-xs text-foreground/80">
                لینک دسته‌بندی (اسلاگ)
              </Label>
              <Input
                id="category-slug"
                dir="ltr"
                value={formSlug}
                onChange={(e) => {
                  setFormSlug(e.target.value);
                }}
                placeholder="kitchen-tools"
                className="border-white/10 bg-[#1c1916] font-mono text-start placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
                required
              />
              <p className="text-[10px] leading-relaxed text-muted-foreground/60">
                فقط حروف کوچک انگلیسی، اعداد و خط تیره؛ مثل /category/kitchen-tools
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-foreground/80">تصویر دسته‌بندی</Label>
              <ImageUploadField
                value={formImage}
                onChange={setFormImage}
                emptyLabel="تصویر دسته‌بندی انتخاب نشده است"
              />
            </div>
            <Separator className="bg-white/5" />
            <Button
              type="submit"
              className="w-full bg-linear-to-l from-primary to-primary-soft py-6 font-bold text-primary-foreground transition-all duration-300 hover:opacity-90"
            >
              {editingId ? "ذخیره تغییرات" : "ثبت دسته‌بندی"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="border-white/10 bg-[#1a1714]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">حذف دسته‌بندی؟</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              دسته‌بندی «{deleteTarget?.title}» حذف می‌شود. این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="border-white/10 bg-transparent text-foreground hover:bg-white/5 hover:text-foreground">
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف دسته‌بندی
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
