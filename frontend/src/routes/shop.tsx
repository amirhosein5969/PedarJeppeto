import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { ProductCard } from "@/components/shop/ProductCard";
import { SectionHeader } from "@/components/shop/SectionHeader";
import { useCatalog } from "@/hooks/queries";

type ShopSearch = { q?: string | undefined; cat?: string | undefined };

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    cat: typeof search["cat"] === "string" ? search["cat"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "فروشگاه محصولات چوبی دست‌ساز | پدر ژپتو" },
      {
        name: "description",
        content: "همه‌ی محصولات چوبی دست‌ساز پدر ژپتو در چهار دسته‌بندی، با فیلتر و جستجو.",
      },
      { property: "og:title", content: "فروشگاه محصولات چوبی دست‌ساز | پدر ژپتو" },
      { property: "og:description", content: "ظروف، دکوری، لوازم دیجیتال و کادویی چوبی." },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { q, cat } = Route.useSearch();
  const { data, isPending } = useCatalog(true);

  const products = data?.products ?? [];
  const categories = data?.categories ?? [];

  const list = products.filter(
    (p) => (!cat || p.category === cat) && (!q || p.name.includes(q) || p.summary.includes(q)),
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <SectionHeader
        as="h1"
        title="فروشگاه"
        subtitle={q ? `نتیجه جستجو برای «${q}»` : "همه‌ی محصولات دست‌ساز کارگاه پدر ژپتو"}
      />

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto border-b border-border pb-3">
        <Link
          to="/shop"
          search={{ q }}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-300 ${
            !cat
              ? "bg-primary text-primary-foreground"
              : "border border-border hover:border-primary"
          }`}
        >
          همه
        </Link>
        {categories.map((c) => (
          <Link
            key={c.slug}
            to="/shop"
            search={{ q, cat: c.slug }}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-300 ${
              cat === c.slug
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:border-primary"
            }`}
          >
            {c.short}
          </Link>
        ))}
      </div>

      {isPending ? (
        <div className="grid min-h-64 place-items-center py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : list.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted-foreground">محصولی پیدا نشد.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
