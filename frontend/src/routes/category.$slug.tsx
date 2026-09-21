import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { ProductCard } from "@/components/shop/ProductCard";
import { useCatalog } from "@/hooks/queries";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => {
    return {
      meta: [
        { title: `دسته‌بندی ${params.slug} | پدر ژپتو` },
        { name: "description", content: "دسته‌بندی محصولات چوبی دست‌ساز." },
        { property: "og:title", content: "دسته‌بندی محصولات چوبی دست‌ساز | پدر ژپتو" },
        { property: "og:description", content: "دسته‌بندی محصولات چوبی دست‌ساز." },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data, isPending, isError } = useCatalog(true);

  if (isPending) {
    return (
      <div className="grid min-h-72 place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (isError) throw notFound();

  const category = data?.categories.find((c) => c.slug === slug);
  if (!category) throw notFound();

  const list = (data?.products ?? []).filter((p) => p.category === category.slug);

  return (
    <div>
      <div className="relative h-64 overflow-hidden">
        {category.image && (
          <img
            src={category.image}
            alt={category.title}
            width={900}
            height={1100}
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/70 to-background/30" />
        <div className="absolute inset-0 mx-auto flex w-full max-w-7xl flex-col justify-end gap-2 px-4 pb-8">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{category.title}</h1>
          <p className="text-sm text-muted-foreground">دست‌ساز، از چوب طبیعی</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-border pb-3">
          {data?.categories.map((c) => (
            <Link
              key={c.slug}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-300 ${
                c.slug === category.slug
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:border-primary"
              }`}
            >
              {c.short}
            </Link>
          ))}
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}