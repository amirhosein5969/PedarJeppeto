import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MoreVertical, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { AdminProduct } from "@/lib/admin-products";
import { adminFinalPrice, adminUnitProfit } from "@/lib/admin-products";
import { loadWoodSettings, type WoodSettings } from "@/lib/admin-wood-types";
import { formatPrice, toFa } from "@/lib/shop-data";
import { useAdminCatalog, useSaveProduct, type ProductSaveInput } from "@/hooks/queries";
import { useTableSort } from "@/lib/use-table-sort";
import { MultiImageUploadField } from "@/components/admin/MultiImageUploadField";
import { SortHead } from "@/components/admin/SortHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
  head: () => ({
    meta: [{ title: "مدیریت محصولات | پدر ژپتو" }],
  }),
});

const formSchema = z.object({
  title: z.string().min(3, "عنوان محصول حداقل ۳ نویسه باشد."),
  description: z.string().min(10, "توضیح کوتاه حداقل ۱۰ نویسه باشد."),
  category: z.string().min(1, "دسته‌بندی را انتخاب کنید."),
  // Optional at the RHF level so the input can start empty; presence is
  // enforced by the final refine (undefined means "not filled in").
  price: z
    .number({ message: "قیمت را به عدد وارد کنید." })
    .int("قیمت به تومان، عدد صحیح باشد.")
    .min(1000, "قیمت حداقل ۱٬۰۰۰ تومان باشد.")
    .max(100000000, "قیمت حداکثر ۱۰۰٬۰۰۰٬۰۰۰ تومان باشد.")
    .optional()
    // Explicit boolean return: prevents TS 5.5 from inferring this arrow as
    // a type predicate, which would strip the optionality from the schema.
    .refine((v): boolean => v !== undefined, "قیمت اصلی را وارد کنید."),
  // Discount is fully optional: leaving it empty means no discount.
  discount: z
    .number({ message: "درصد تخفیف را به عدد وارد کنید." })
    .min(0, "تخفیف نمی‌تواند منفی باشد.")
    .max(100, "تخفیف حداکثر ۱۰۰ درصد است.")
    .optional(),
  // Cost is required at the RHF level the same way price is: the input starts
  // empty, presence is enforced by the refine below.
  costPrice: z
    .number({ message: "قیمت تمام‌شده را به عدد وارد کنید." })
    .int("قیمت تمام‌شده عدد صحیح باشد.")
    .min(0, "قیمت تمام‌شده نمی‌تواند منفی باشد.")
    .max(100000000, "قیمت تمام‌شده حداکثر ۱۰۰٬۰۰۰٬۰۰۰ تومان باشد.")
    .optional()
    .refine((v): boolean => v !== undefined, "قیمت تمام‌شده را وارد کنید."),
  dimensions: z.string().min(2, "ابعاد را وارد کنید."),
  material: z.string().min(2, "جنس را وارد کنید."),
  color: z.string().min(2, "رنگ را وارد کنید."),
  stockCount: z
    .number({ message: "تعداد موجودی را به عدد وارد کنید." })
    .int("تعداد موجودی عدد صحیح باشد.")
    .min(0, "تعداد موجودی نمی‌تواند منفی باشد.")
    .optional(),
  stock: z.enum(["in", "out"]),
});

type ProductFormValues = z.infer<typeof formSchema>;

/** Sort value per column — stable module-level fn keeps the memo cheap. */
const productSortValue = (p: AdminProduct, key: string): string | number => {
  switch (key) {
    case "title":
      return p.title;
    case "price":
      return p.price;
    case "discount":
      return p.discount;
    case "final":
      return adminFinalPrice(p);
    case "profit":
      return adminUnitProfit(p);
    case "stock":
      return p.inStock ? 1 : 0;
    default:
      return 0;
  }
};

// Price/discount/costPrice/stockCount intentionally omitted: the inputs start empty.
const emptyForm: ProductFormValues = {
  title: "",
  description: "",
  category: "",
  dimensions: "",
  material: "",
  color: "",
  stock: "in",
};

const toFormValues = (p: AdminProduct): ProductFormValues => ({
  title: p.title,
  description: p.description,
  category: p.category,
  price: p.price,
  discount: p.discount > 0 ? p.discount : undefined,
  costPrice: p.costPrice,
  dimensions: p.dimensions,
  material: p.material,
  color: p.color,
  stockCount: p.stockCount,
  stock: p.inStock ? "in" : "out",
});

function AdminProducts() {
  const { data: catalog, isPending, isError } = useAdminCatalog();
  const saveProduct = useSaveProduct();
  const items = catalog?.products ?? null;
  const categories = catalog?.categories ?? [];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  // Gallery lives outside RHF: arbitrary-length image list edited in the sheet.
  const [images, setImages] = useState<string[]>([]);
  // Global wood list + customer-selection switch (جزئیات محصولات).
  const [woodSettings, setWoodSettings] = useState<WoodSettings | null>(null);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyForm,
  });

  useEffect(() => {
    setWoodSettings(loadWoodSettings());
  }, []);

  const { sort, toggleSort, sorted } = useTableSort(items, productSortValue);

  const openNew = () => {
    setEditingId(null);
    setImages([]);
    form.reset(emptyForm);
    setSheetOpen(true);
  };

  const openEdit = (p: AdminProduct) => {
    setEditingId(p.id);
    setImages(p.images);
    form.reset(toFormValues(p));
    setSheetOpen(true);
  };

  const onSubmit = (values: ProductFormValues) => {
    if (images.length === 0) {
      toast.error("حداقل یک تصویر برای محصول انتخاب کنید.");
      return;
    }
    const input: ProductSaveInput = {
      id: editingId ? Number(editingId) : undefined,
      title: values.title.trim(),
      description: values.description.trim(),
      categorySlug: values.category,
      listPrice: values.price ?? 0,
      discount: values.discount ?? 0,
      costPrice: values.costPrice ?? 0,
      dimensions: values.dimensions.trim(),
      material: values.material.trim(),
      color: values.color.trim(),
      stockCount: values.stockCount ?? 0,
      inStock: values.stock === "in",
      images,
    };
    saveProduct.mutate(input, {
      onSuccess: () => {
        toast.success(
          editingId
            ? `محصول «${input.title}» به‌روزرسانی شد.`
            : `محصول «${input.title}» به کاتالوگ اضافه شد.`,
        );
        setSheetOpen(false);
      },
      onError: (err) => {
        toast.error(`ذخیره‌ی محصول ناموفق بود: ${err.message}`);
      },
    });
  };

  /** Soft delete: PATCH is_active=false (storefront hides the product). */
  const confirmDelete = () => {
    if (!deleteTarget) return;
    saveProduct.mutate(
      {
        id: Number(deleteTarget.id),
        title: deleteTarget.title,
        description: deleteTarget.description,
        categorySlug: deleteTarget.category,
        listPrice: deleteTarget.price,
        discount: deleteTarget.discount,
        costPrice: deleteTarget.costPrice,
        dimensions: deleteTarget.dimensions,
        material: deleteTarget.material,
        color: deleteTarget.color,
        stockCount: deleteTarget.stockCount,
        inStock: false,
        images: deleteTarget.images,
      },
      {
        onSuccess: () => {
          toast.success(`محصول «${deleteTarget.title}» از کاتالوگ حذف شد.`);
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast.error(`حذف محصول ناموفق بود: ${err.message}`);
        },
      },
    );
  };

  const watchedPrice = form.watch("price");
  const watchedDiscount = form.watch("discount");
  const watchedCost = form.watch("costPrice");
  const previewFinal = Math.round(
    ((Number(watchedPrice) || 0) *
      (100 - Math.min(100, Math.max(0, Number(watchedDiscount) || 0)))) /
      100,
  );
  const previewProfit = previewFinal - (Number(watchedCost) || 0);

  const categoryShort = (slug: string) =>
    categories.find((c) => c.slug === slug)?.short ?? slug;

  return (
    <div>
      {/* Page header + primary action */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">محصولات</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            مدیریت کاتالوگ کارگاه
            {items ? ` — ${toFa(items.length)} محصول` : ""}
          </p>
        </div>
        <Button
          onClick={openNew}
          className="h-10 bg-linear-to-l from-primary to-primary-soft font-bold text-primary-foreground shadow-soft transition-all duration-300 hover:opacity-90"
        >
          <Plus className="size-4" />
          افزودن محصول جدید
        </Button>
      </div>

      {/* Data table card */}
      <div className="mt-6 overflow-hidden rounded-xl border border-white/5 bg-[#151311]">
        {sorted === null ? (
          <div className="grid min-h-64 place-items-center text-xs text-muted-foreground">
            {isPending ? (
              "بارگذاری کاتالوگ…"
            ) : isError ? (
              "بارگذاری کاتالوگ ناموفق بود؛ اتصال به سرور فروشگاه را بررسی کنید."
            ) : (
              "—"
            )}
          </div>
        ) : sorted.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-10 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Package className="size-6" />
              </span>
              <p className="mt-4 text-sm font-bold text-foreground">کاتالوگ خالی است</p>
              <p className="mt-1 text-xs text-muted-foreground">
                با دکمه‌ی «افزودن محصول جدید» شروع کنید.
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
                  label="نام محصول"
                  sortKey="title"
                  sort={sort}
                  onSort={toggleSort}
                  className="min-w-44"
                />
                <SortHead label="قیمت اصلی" sortKey="price" sort={sort} onSort={toggleSort} />
                <SortHead label="تخفیف" sortKey="discount" sort={sort} onSort={toggleSort} />
                <SortHead label="قیمت نهایی" sortKey="final" sort={sort} onSort={toggleSort} />
                <SortHead label="سود هر عدد" sortKey="profit" sort={sort} onSort={toggleSort} />
                <SortHead label="وضعیت" sortKey="stock" sort={sort} onSort={toggleSort} />
                <TableHead className="w-14 text-right text-xs font-bold text-muted-foreground">
                  عملیات
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => (
                <TableRow key={p.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="p-3">
                    <div className="relative size-12 overflow-hidden rounded-lg border border-white/5 bg-[#1c1916]">
                      <img
                        src={p.images[0]}
                        alt={p.title}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                      {p.images.length > 1 && (
                        <span className="absolute inset-x-0 bottom-0 bg-black/65 text-center text-[9px] font-bold text-white/90">
                          {toFa(p.images.length)} تصویر
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <p className="max-w-56 truncate text-sm font-bold text-foreground">{p.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {categoryShort(p.category)}
                    </p>
                  </TableCell>
                  <TableCell className="py-3.5 text-xs text-foreground/85">
                    {formatPrice(p.price)}
                  </TableCell>
                  <TableCell className="py-3.5">
                    {p.discount > 0 ? (
                      <Badge className="border-transparent bg-primary/15 text-[11px] font-extrabold text-primary-soft hover:bg-primary/15">
                        {toFa(p.discount)}٪
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5 text-xs font-extrabold text-primary-soft">
                    {formatPrice(adminFinalPrice(p))}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span
                      className={cn(
                        "text-xs font-extrabold",
                        adminUnitProfit(p) >= 0 ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {adminUnitProfit(p) < 0 && "−"}
                      {formatPrice(Math.abs(adminUnitProfit(p)))}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5">
                    {p.inStock ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary-soft">
                        <span className="size-1.5 rounded-full bg-primary" />
                        {p.stockCount > 0 ? `موجود (${toFa(p.stockCount)} عدد)` : "موجود"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                        ناموجود
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <ProductRowActions
                      onEdit={() => {
                        openEdit(p);
                      }}
                      onDelete={() => {
                        setDeleteTarget(p);
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add / edit product sheet */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
        }}
      >
        <SheetContent
          side="left"
          className="z-[100] w-full overflow-y-auto border-white/5 bg-[#151311] sm:max-w-lg"
        >
          <SheetHeader className="text-start">
            <SheetTitle className="text-foreground">
              {editingId ? "ویرایش محصول" : "افزودن محصول جدید"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              تمام این فیلدها مستقیما‌ً در کارت و صفحه‌ی محصول فروشگاه اعمال می‌شوند.
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 px-4 pb-6 sm:px-6">
              {/* Section 1 — basic info */}
              <FormSection title="اطلاعات پایه" />
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className={labelClass}>عنوان محصول</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="مثلا‌‌ تخته سرو چوب بلوط"
                        className={inputClass}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className={labelClass}>توضیح کوتاه</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="یک یا دو جمله درباره‌ی کاربرد و حس محصول"
                        className={inputClass}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className={labelClass}>دسته‌بندی</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={cn(inputClass, "w-full")}>
                          <SelectValue placeholder="انتخاب دسته‌بندی" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="z-[200] border-white/10 bg-[#1a1714]">
                        {categories.map((c) => (
                          <SelectItem key={c.slug} value={c.slug}>
                            {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Section 2 — pricing and discount */}
              <FormSection title="قیمت‌گذاری و تخفیف" />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className={labelClass}>قیمت اصلی (تومان)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1000}
                          placeholder="مثلا‌‌ ۴۵۰۰۰۰"
                          className={inputClass}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value),
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className={labelClass}>قیمت تمام‌شده (تومان)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1000}
                          placeholder="مثلا‌‌ ۲۵۰۰۰۰"
                          className={inputClass}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value),
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className={labelClass}>تخفیف (درصد)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          placeholder="بدون تخفیف"
                          className={inputClass}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value),
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="space-y-2 rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">قیمت نهایی برای فروشگاه</span>
                  <span className="text-sm font-extrabold text-primary-soft">
                    {formatPrice(previewFinal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">سود در هر فروش</span>
                  <span
                    className={cn(
                      "text-sm font-extrabold",
                      previewProfit >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {previewProfit < 0 && "−"}
                    {formatPrice(Math.abs(previewProfit))}
                  </span>
                </div>
              </div>

              {/* Section 3 — technical specs */}
              <FormSection title="مشخصات فنی" />
              <FormField
                control={form.control}
                name="dimensions"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className={labelClass}>ابعاد</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="مثلا‌‌ ۳۰×۲۵ سانتی‌متر"
                        className={inputClass}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="material"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className={labelClass}>جنس</FormLabel>
                      {woodSettings?.customerSelectionEnabled ? (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={cn(inputClass, "w-full")}>
                              <SelectValue placeholder="انتخاب نوع چوب" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="z-[200] border-white/10 bg-[#1a1714]">
                            {woodSettings.woodTypes.map((w) => (
                              <SelectItem key={w} value={w}>
                                چوب {w}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <FormControl>
                          <Input placeholder="مثلا‌‌ چوب گردو" className={inputClass} {...field} />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className={labelClass}>رنگ</FormLabel>
                      <FormControl>
                        <Input placeholder="مثلا‌‌ عسلی روشن" className={inputClass} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Section 4 — stock and media */}
              <FormSection title="موجودی و تصویر" />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className={labelClass}>وضعیت موجودی</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={cn(inputClass, "w-full")}>
                            <SelectValue placeholder="انتخاب وضعیت" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="z-[200] border-white/10 bg-[#1a1714]">
                          <SelectItem value="in">موجود</SelectItem>
                          <SelectItem value="out">ناموجود</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stockCount"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className={labelClass}>تعداد موجودی</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="مثلا‌‌ ۱۲"
                          className={inputClass}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value),
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                {/* Plain Label: the gallery lives outside RHF, so no FormField context here. */}
                <Label className={labelClass}>تصویرهای محصول</Label>
                <MultiImageUploadField images={images} onChange={setImages} />
                <p className="text-[11px] leading-5 text-muted-foreground/70">
                  اولین تصویر، تصویر اصلی کارت و صفحه‌ی محصول است و تصویر دوم هنگام هاور روی کارت
                  نمایش داده می‌شود. با ستاره هر تصویر را اصلی و با چشم آن را تصویر هاور کنید.
                  تصاویر جدید روی سرور فروشگاه ذخیره می‌شوند.
                </p>
              </div>

              <Button
                type="submit"
                disabled={saveProduct.isPending}
                className="mt-2 w-full bg-linear-to-l from-primary to-primary-soft py-6 font-bold text-primary-foreground transition-all duration-300 hover:opacity-90"
              >
                {saveProduct.isPending
                  ? "در حال ذخیره…"
                  : editingId
                    ? "ذخیره تغییرات"
                    : "ثبت محصول در کاتالوگ"}
              </Button>
            </form>
          </Form>
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
            <AlertDialogTitle className="text-foreground">حذف محصول؟</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              محصول «{deleteTarget?.title}» از کاتالوگ فروشگاه حذف می‌شود و تا زمانی که دوباره در
              فهرست فعال شود، در صفحه‌های فروشگاه نمایش داده نمی‌شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="border-white/10 bg-transparent text-foreground hover:bg-white/5 hover:text-foreground">
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={saveProduct.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف محصول
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductRowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="عملیات محصول"
          className="size-8 text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-[200] border-white/10 bg-[#1a1714]">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil />
          ویرایش
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
          <Trash2 />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FormSection({ title }: { title: string }) {
  return (
    <div className="pt-1">
      <p className="text-xs font-extrabold text-primary-soft">{title}</p>
      <Separator className="mt-2 bg-white/5" />
    </div>
  );
}

const labelClass = "text-xs text-foreground/80";

/** Shared dark styling for every field control in the sheet. */
const inputClass =
  "border-white/10 bg-[#1c1916] text-foreground placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25";