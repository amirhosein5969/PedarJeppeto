import { useNavigate, Link } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  Loader2,
  Package,
  PackageOpen,
  Tag,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNotifications } from "@/hooks/queries";
import type { AppNotification, NotificationKind } from "@/lib/notifications";
import type { ApiNotification } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<NotificationKind, typeof Package> = {
  order: Package,
  promo: Tag,
  stock: PackageOpen,
  system: BellRing,
};

/** Persian (Solar-Hijri) timestamp for a feed row, e.g. "۱۴۰۴/۰۷/۰۲ ۱۴:۳۰". */
function formatNotifTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** API row → popover view-model (icon kind falls back to "system"). */
function toAppNotification(n: ApiNotification): AppNotification {
  const kind: NotificationKind =
    n.kind === "order" || n.kind === "promo" || n.kind === "stock" ? n.kind : "system";
  return {
    id: n.id,
    kind,
    title: n.title,
    body: n.body,
    time: formatNotifTime(n.created_at),
    read: n.read,
    ...(kind === "order" ? { to: "/profile/orders" } : {}),
  };
}

/**
 * Header bell + click-to-open notification popover, fed by the REAL
 * backend feed (`GET /notifications`) — the old dummy list is gone and an
 * empty feed renders "هیچ اعلانی ندارید". Unread rows get an amber dot +
 * badge on the bell; opening a row marks it read (locally — the server
 * read-state lands with the notification producers). A full click-away
 * layer keeps the popover honest without a portal.
 */
export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const [locallyRead, setLocallyRead] = useState<Record<string, true>>({});
  const { data, isPending, isFetching, isError } = useNotifications();
  const navigate = useNavigate();

  // Guests (query disabled) and settled requests both render the feed or
  // the empty state — only a genuine first fetch shows the spinner.
  const loading = isPending && isFetching && !isError;

  const items = useMemo<AppNotification[]>(
    () =>
      (data ?? [])
        .map(toAppNotification)
        .map((n) => ({ ...n, read: n.read || Boolean(locallyRead[n.id]) })),
    [data, locallyRead],
  );

  const unread = items.filter((n) => !n.read).length;

  const markAll = () => setLocallyRead(Object.fromEntries(items.map((n) => [n.id, true as const])));
  const openItem = (n: AppNotification) => {
    setLocallyRead((prev) => ({ ...prev, [n.id]: true }));
    setOpen(false);
    if (n.to) navigate({ to: n.to as never });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative grid size-10 place-items-center rounded-full border bg-card transition-colors duration-300",
          open
            ? "border-primary/50 text-primary-soft"
            : "border-primary/15 text-foreground/85 hover:border-primary/40",
        )}
        aria-label="اعلان‌ها"
        aria-expanded={open}
      >
        <Bell size={18} strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -left-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-extrabold leading-none text-primary-foreground shadow-glow ring-2 ring-background">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away layer (below the panel) */}
          <div
            className="fixed inset-0 z-[150]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-full z-[160] mt-3 w-80 overflow-hidden rounded-2xl border border-primary/15 bg-[#1a1714]/95 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-primary/10 bg-primary/5 px-4 py-3">
              <span className="text-sm font-extrabold text-foreground">اعلان‌ها</span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary-soft transition-colors hover:text-foreground"
                >
                  <CheckCheck size={13} />
                  خواندن همه
                </button>
              )}
            </div>

            {loading ? (
              <div className="grid min-h-24 place-items-center py-8">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : items.length === 0 ? (
              <div className="grid gap-2.5 px-4 py-10 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-full border border-dashed border-primary/30 text-primary/50">
                  <BellOff size={22} />
                </span>
                <p className="text-xs font-bold text-foreground">هیچ اعلانی ندارید</p>
                <p className="mx-auto max-w-55 text-[11px] leading-5 text-muted-foreground">
                  خبر جدیدی از کارگاه برای شما نیست؛ هر اطلاع‌رسانی مهم همین‌جا نمایش داده می‌شود.
                </p>
              </div>
            ) : (
              <ul className="max-h-80 divide-y divide-primary/10 overflow-y-auto">
                {items.map((n) => {
                  const Icon = KIND_ICONS[n.kind] ?? BellRing;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3.5 text-right transition-colors duration-200 hover:bg-primary/5",
                          !n.read && "bg-primary/[0.04]",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
                            n.read
                              ? "bg-white/5 text-muted-foreground"
                              : "bg-primary/15 text-primary-soft",
                          )}
                        >
                          <Icon size={16} strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "truncate text-xs",
                                n.read
                                  ? "font-semibold text-foreground/75"
                                  : "font-extrabold text-foreground",
                              )}
                            >
                              {n.title}
                            </span>
                            {!n.read && (
                              <span
                                aria-label="نمایش‌داده‌نشده"
                                className="size-1.5 shrink-0 rounded-full bg-primary shadow-glow"
                              />
                            )}
                          </span>
                          <span className="mt-1 block truncate text-[11px] leading-5 text-muted-foreground">
                            {n.body}
                          </span>
                          <span className="mt-1 block text-[10px] text-muted-foreground/70">
                            {n.time}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <Link
              to="/profile/orders"
              onClick={() => setOpen(false)}
              className="block border-t border-primary/10 px-4 py-3 text-center text-[11px] font-bold text-primary-soft transition-colors hover:bg-primary/5 hover:text-foreground"
            >
              مشاهده‌ی سفارش‌های من
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
