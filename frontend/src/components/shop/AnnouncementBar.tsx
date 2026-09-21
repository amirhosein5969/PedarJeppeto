import { Fragment } from "react";
import { Leaf, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tier 1 — the slim announcement bar at the very top of the header.
 *
 * Content is fully prop-driven so the Admin Panel (FastAPI) can later serve
 * custom text/icon pairs — the Header will pass the stored values through
 * `items` (the shape mirrors the future `/settings` payload). On mobile only
 * the first item renders, keeping the bar a single elegant line.
 */
export type AnnouncementItem = {
  id: string;
  text: string;
  /** Built-in mark; unknown values render without an icon. */
  icon?: "truck" | "leaf";
};

export const DEFAULT_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: "free-shipping",
    text: "ارسال رایگان برای خریدهای بالای ۱ میلیون تومان",
    icon: "truck",
  },
  { id: "handmade", text: "ساخت دست‌ساز با چوب طبیعی", icon: "leaf" },
];

const itemIcons = { truck: Truck, leaf: Leaf } as const;

export function AnnouncementBar({
  items = DEFAULT_ANNOUNCEMENTS,
}: {
  items?: AnnouncementItem[];
}) {
  return (
    <div className="border-b border-primary/10 bg-linear-to-l from-[#241b0f] via-[#2a2013] to-[#241b0f]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-x-4 px-3 py-1.5 sm:px-4">
        {items.map((item, i) => {
          const Icon = item.icon ? itemIcons[item.icon] : undefined;
          return (
            <Fragment key={item.id}>
              {i > 0 && (
                <span aria-hidden="true" className="hidden h-3 w-px bg-primary/25 sm:block" />
              )}
              <span
                className={cn("flex items-center gap-1.5", i > 0 && "hidden sm:flex")}
              >
                {Icon && (
                  <Icon size={13} strokeWidth={1.5} className="shrink-0 text-primary-soft/70" />
                )}
                <span className="text-[11px] font-medium leading-4 text-primary-soft/75">
                  {item.text}
                </span>
              </span>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}