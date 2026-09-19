import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

export type SortConfig = { key: string; direction: SortDirection };

/**
 * Shared client-side table sorting for the admin data tables.
 *
 * `items === null` is the SSR/loading sentinel and passes through untouched;
 * an empty `sort.key` means "keep the source order" (which pages may apply
 * their own default priority sort to).
 *
 * `valueOf` must be a module-level (stable) function so the memo does not
 * churn on every render.
 */
export function useTableSort<T>(
  items: T[] | null,
  valueOf: (item: T, key: string) => string | number,
) {
  const [sort, setSort] = useState<SortConfig>({ key: "", direction: "asc" });

  const toggleSort = (key: string) =>
    setSort((s) =>
      s.key === key
        ? { key, direction: s.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );

  const sorted = useMemo(() => {
    if (!items || !sort.key) return items;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = valueOf(a, sort.key);
      const bv = valueOf(b, sort.key);
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      // "fa" gives correct Persian (and Jalali digit) string ordering.
      return String(av).localeCompare(String(bv), "fa") * dir;
    });
  }, [items, sort, valueOf]);

  return { sort, toggleSort, sorted };
}
