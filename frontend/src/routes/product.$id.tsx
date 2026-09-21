import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductGallery } from "@/components/shop/ProductGallery";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { loadWoodSettings, type WoodSettings } from "@/lib/admin-wood-types";
import { Droplet, Loader2 } from "lucide-react";
import { finalPrice, formatPrice, toFa } from "@/lib/shop-data";
import { useCatalog, useSettings } from "@/hooks/queries";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "محصول | پدر ژپتو" },
      { name: "description", content: "جزئیات محصول چوبی دست‌ساز." },
      { property: "og:title", content: "محصول | پدر ژپتو" },
      { property: "og:description", content: "جزئیات محصول چوبی دست‌ساز." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data: catalog, isPending, isError } = useCatalog(true);
  const { data: store } = useSettings();

  // Wood selector state: hydrate from the admin wood settings on the client.
  const [wood, setWood] = useState<WoodSettings | null>(null);
  const [selectedWood, setSelectedWood] = useState("");
  const [woodNote, setWoodNote] = useState("");
  const [withOil, setWithOil] = useState(false);

  const product = catalog?.products.find((p) => p.id === id);

  useEffect(() => {
    setWithOil(false);
    if (!product) return;
    const settings = loadWoodSettings();
    setWood(settings);
    const material = product.specs.find((s) => s.label.startsWith("جنس"))?.value ?? "";
    setWoodNote(material);
    setSelectedWood(settings.woodTypes.find((w) => material.includes(w)) ?? "");
  }, [product]);

  if (isPending) {
    return (
      <div className="grid min-h-72 place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (isError || !product) throw notFound();

  const category = catalog?.categories.find((c) => c.slug === product.category);
  const related = (catalog?.products ?? []).filter(
    (p) => p.category === product.category && p.id !== product.id,
  );

  const visibleSpecs = wood
    ? product.specs.filter((s) => !s.label.startsWith("جنس"))
    : product.specs;

  const oilEnabled = store?.careOilEnabled ?? false;
  const oilPrice = store?.careOilPrice ?? 0;
  const oilOn = oilEnabled && withOil;
  // The oil add-on rides with the cart line and lands on the invoice.
  const unitOilCharge = oilOn ? oilPrice : 0;
  const payable = finalPrice(product) + unitOilCharge;

  // Phase 7 variant selections carried onto the cart line: the customer's
  // chosen wood (from the dropdown, or the free note) and the product color.
  const effectiveWood = wood?.customerSelectionEnabled ? selectedWood : woodNote;
  const productColor = product.specs.find((s) => s.label === "رنگ")?.value ?? "";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary-soft">
          خانه
        </Link>
        <span>/</span>
        <Link to="/shop" className="hover:text-primary-soft">
          فروشگاه
        </Link>
        {category && (
          <>
            <span>/</span>
            <Link
              to="/category/$slug"
              params={{ slug: category.slug }}
              className="hover:text-primary-soft"
            >
              {category.title}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-border self-start">
          <ProductGallery
            images={product.images}
            alt={product.name}
            eager
            className="aspect-[4/3] w-full"
            badge={
              <span className="deal-badge absolute top-4 right-4 w-fit rounded-full px-3 py-1.5 text-xs font-extrabold">
                ٪{toFa(product.discount)} تخفیف
              </span>
            }
          />
        </div>

        <div className="space-y-6">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{product.name}</h1>
          <p className="text-sm leading-8 text-muted-foreground">{product.summary}</p>

          <ul className="grid gap-3 rounded-2xl border border-border bg-card p-5 text-sm">
            {visibleSpecs.map((s) => (
              <li key={s.label} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-semibold">{s.value}</span>
              </li>
            ))}
          </ul>

          {wood !== null && (
            <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-bold">جنس چوب</p>
                {wood.customerSelectionEnabled && selectedWood && (
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary-soft">
                    چوب {selectedWood}
                  </span>
                )}
              </div>
              {wood.customerSelectionEnabled && wood.woodTypes.length > 0 ? (
                <>
                  <p className="text-xs leading-6 text-muted-foreground">
                    نوع چوب دلخواه خود را از فهرست انتخاب کنید؛ کارگاه همان چوب را برایتان آماده
                    می‌کند.
                  </p>
                  <Select value={selectedWood} onValueChange={setSelectedWood}>
                    <SelectTrigger className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-ring [&>span]:text-muted-foreground data-[state=closed]:[&>span]:text-muted-foreground">
                      <SelectValue placeholder="انتخاب نوع چوب" />
                    </SelectTrigger>
                    <SelectContent>
                      {wood.woodTypes.map((w) => (
                        <SelectItem key={w} value={w}>
                          چوب {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
                  <p className="text-xs leading-6 text-muted-foreground">
                    توضیح چوب مورد نظر خود را بنویسید؛ کارشناس ما قبل از ساخت با شما هماهنگ می‌کند.
                  </p>
                  <Input
                    value={woodNote}
                    onChange={(e) => {
                      setWoodNote(e.target.value);
                    }}
                    placeholder="مثلاً چوب گردوی یکسره با رگه‌های روشن"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </>
              )}
            </section>
          )}

          {oilEnabled && (
            <section className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Droplet size={18} strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-bold">روغن جلا با قابلیت پرداخت</p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    پرداخت نهایی با روغن مخصوص چوب؛ درخشش و مقاومت بیشتر در برابر رطوبت.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs font-bold text-primary-soft">
                  + {formatPrice(oilPrice)}
                </span>
                <Switch
                  checked={withOil}
                  onCheckedChange={setWithOil}
                  aria-label="افزودن روغن جلا با قابلیت پرداخت"
                />
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <div>
              <div className="text-sm text-muted-foreground line-through">
                {formatPrice(product.price)}
              </div>
              <div className="text-xl font-extrabold text-primary-soft">{formatPrice(payable)}</div>
              {unitOilCharge > 0 && (
                <div className="mt-1 text-[11px] font-bold text-primary-soft/80">
                  شامل روغن جلا (+ {formatPrice(unitOilCharge)})
                </div>
              )}
            </div>
            <AddToCartButton
              product={product}
              oil={oilOn}
              woodType={effectiveWood}
              color={productColor}
              className="sm:mr-auto"
            />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-extrabold">محصولات مشابه</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
