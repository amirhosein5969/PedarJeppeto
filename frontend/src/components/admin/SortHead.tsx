import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortConfig } from "@/lib/use-table-sort";

/**
 * Clickable <th> with a direction indicator:
 * ArrowUpDown (unsorted) → ArrowUp (asc) → ArrowDown (desc).
 */
export function SortHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  sort: SortConfig;
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead className={cn("text-right text-xs font-bold text-muted-foreground", className)}>
      <button
        type="button"
        onClick={() => {
          onSort(sortKey);
        }}
        aria-label={`مرتب‌سازی بر اساس ${label}`}
        className="group inline-flex items-center gap-1.5 transition-colors duration-300 hover:text-foreground"
      >
        {label}
        <Icon
          className={cn(
            "size-3.5 shrink-0 transition-colors",
            active ? "text-primary" : "text-muted-foreground/40 group-hover:text-foreground/70",
          )}
        />
      </button>
    </TableHead>
  );
}
