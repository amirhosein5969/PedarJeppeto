import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, MoreVertical, Search, Users, Wallet, ReceiptText } from "lucide-react";

import { toFa, formatPrice } from "@/lib/shop-data";
import { useUsers } from "@/hooks/queries";
import type { AdminUser } from "@/lib/admin-users";
import { useTableSort } from "@/lib/use-table-sort";
import { SortHead } from "@/components/admin/SortHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
  head: () => ({
    meta: [{ title: "مدیریت کاربران | چوب‌کار" }],
  }),
});

const roleBadgeClass = (role: AdminUser["role"]) =>
  role === "admin"
    ? "border-primary/25 bg-primary/15 text-primary-soft"
    : "border-white/10 bg-white/5 text-muted-foreground";

/** Sort value per column — stable module-level fn keeps the memo cheap. */
const userSortValue = (u: AdminUser, key: string): string | number => {
  switch (key) {
    case "name":
      return u.name;
    case "phone":
      return u.phone;
    case "role":
      return u.role === "admin" ? 1 : 0;
    case "joinDate":
      return u.joinDate;
    case "orders":
      return u.orderCount;
    case "total":
      return u.totalSpent;
    default:
      return 0;
  }
};

function AdminUsers() {
  const { data: users, isPending } = useUsers();
  const [query, setQuery] = useState("");
  const [details, setDetails] = useState<AdminUser | null>(null);

  const list = users ?? null;

  const { sort, toggleSort, sorted } = useTableSort(list, userSortValue);

  const filtered = useMemo(() => {
    if (!sorted) return null;
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((u) => u.name.toLowerCase().includes(q) || u.phone.includes(q));
  }, [sorted, query]);

  return (
    <div>
      {/* Page header + search */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">مدیریت کاربران</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            مشتریان ثبت‌شده در فروشگاه — کاربران با اولین سفارش خود به‌صورت خودکار ساخته می‌شوند
            {list ? ` — ${toFa(list.length)} کاربر` : ""}
          </p>
        </div>
        <div className="w-full sm:w-72">
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="جستجو با نام یا شماره موبایل…"
              className="h-10 border-white/10 bg-[#1c1916] ps-9 placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/25"
            />
          </div>
        </div>
      </div>

      {/* Users table card */}
      <div className="mt-6 overflow-hidden rounded-xl border border-white/5 bg-[#151311]">
        {filtered === null ? (
          <div className="grid min-h-64 place-items-center text-xs text-muted-foreground">
            {isPending ? (
              "بارگذاری کاربران…"
            ) : (
              <div className="text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Users className="size-6" />
                </span>
                <p className="mt-4 text-sm font-bold text-foreground">هنوز کاربری ثبت نشده است</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  با اولین سفارش از صفحه‌ی پرداخت، مشتری به‌صورت خودکار ایجاد می‌شود.
                </p>
              </div>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-10 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Users className="size-6" />
              </span>
              <p className="mt-4 text-sm font-bold text-foreground">کاربری یافت نشد</p>
              <p className="mt-1 text-xs text-muted-foreground">
                نام یا شماره موبایل را دقیق‌تر وارد کنید.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <SortHead
                  label="کاربر"
                  sortKey="name"
                  sort={sort}
                  onSort={toggleSort}
                  className="min-w-40"
                />
                <SortHead
                  label="شماره موبایل"
                  sortKey="phone"
                  sort={sort}
                  onSort={toggleSort}
                  className="min-w-36"
                />
                <SortHead label="نقش" sortKey="role" sort={sort} onSort={toggleSort} />
                <SortHead label="تاریخ عضویت" sortKey="joinDate" sort={sort} onSort={toggleSort} />
                <SortHead
                  label="تعداد سفارش"
                  sortKey="orders"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortHead label="مجموع خرید" sortKey="total" sort={sort} onSort={toggleSort} />
                <TableHead className="w-14 text-right text-xs font-bold text-muted-foreground">
                  عملیات
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full text-sm font-extrabold",
                          u.role === "admin"
                            ? "bg-linear-to-br from-primary to-primary-soft text-primary-foreground"
                            : "border border-white/10 bg-white/5 text-muted-foreground",
                        )}
                      >
                        {u.name.trim().charAt(0)}
                      </span>
                      <span className="truncate text-sm font-bold text-foreground">{u.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span
                      dir="ltr"
                      className="block truncate font-mono text-xs text-muted-foreground"
                    >
                      {u.phone}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span
                      className={cn(
                        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold",
                        roleBadgeClass(u.role),
                      )}
                    >
                      {u.role === "admin" ? "مدیر" : "مشتری"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 text-xs text-foreground/85">
                    <span dir="ltr">{u.joinDate}</span>
                  </TableCell>
                  <TableCell className="py-3.5 text-xs font-bold text-foreground/85">
                    {toFa(u.orderCount)} سفارش
                  </TableCell>
                  <TableCell className="py-3.5 text-xs font-extrabold text-primary-soft">
                    {u.totalSpent > 0 ? formatPrice(u.totalSpent) : "—"}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`عملیات کاربر ${u.name}`}
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
                            setDetails(u);
                          }}
                        >
                          <Eye />
                          مشاهده جزئیات
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

      {/* User details sheet — full profile + shipping info from checkout */}
      <Sheet
        open={details !== null}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      >
        <SheetContent
          side="left"
          className="z-[100] w-full overflow-y-auto border-white/5 bg-[#151311] sm:max-w-md"
        >
          {details && (
            <>
              <SheetHeader className="text-start">
                <SheetTitle className="text-foreground">جزئیات کاربر</SheetTitle>
                <SheetDescription className="text-xs">
                  پروفایل کامل کاربر — نشانی ذخیره‌شده از آخرین سفارش
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-6 sm:px-6">
                {/* Profile summary */}
                <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#1c1916] p-4">
                  <span
                    className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-full text-base font-extrabold",
                      details.role === "admin"
                        ? "bg-linear-to-br from-primary to-primary-soft text-primary-foreground"
                        : "border border-white/10 bg-white/5 text-muted-foreground",
                    )}
                  >
                    {details.name.trim().charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-foreground">
                      {details.name}
                    </p>
                    <p
                      dir="ltr"
                      className="mt-0.5 text-right font-mono text-[11px] text-muted-foreground"
                    >
                      {details.phone}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold",
                        roleBadgeClass(details.role),
                      )}
                    >
                      {details.role === "admin" ? "مدیر" : "مشتری"}
                    </span>
                    {details.active ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500/25 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        فعال
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-rose-500/25 bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-400">
                        <span className="size-1.5 rounded-full bg-rose-400" />
                        غیرفعال
                      </span>
                    )}
                  </div>
                </div>

                {/* Purchase stats — live from the API */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ReceiptText className="size-3.5" />
                      تعداد سفارش
                    </span>
                    <p className="mt-1.5 text-sm font-extrabold text-foreground">
                      {toFa(details.orderCount)} سفارش
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Wallet className="size-3.5" />
                      مجموع خرید
                    </span>
                    <p className="mt-1.5 text-sm font-extrabold text-primary-soft">
                      {details.totalSpent > 0 ? formatPrice(details.totalSpent) : "—"}
                    </p>
                  </div>
                </div>

                {/* Saved profile address — auto-updated by each checkout */}
                <div>
                  <p className="text-xs font-extrabold text-primary-soft">
                    نشانی ذخیره‌شده در پروفایل
                  </p>
                  <Separator className="mt-2 bg-white/5" />
                  <div className="mt-3 space-y-2.5">
                    <InfoRow label="استان" value={details.address.province || "—"} />
                    <InfoRow label="شهر" value={details.address.city || "—"} />
                    <InfoRow label="کد پستی" value={details.address.zipCode || "—"} ltr />
                    <div className="rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3">
                      <span className="text-xs text-muted-foreground">نشانی کامل</span>
                      <p className="mt-1.5 text-xs leading-6 font-bold text-foreground">
                        {details.address.address || "—"}
                      </p>
                    </div>
                    {!details.address.address && !details.address.province && (
                      <p className="text-[10px] leading-5 text-muted-foreground/70">
                        هنوز نشانی‌ای ثبت نشده؛ با اولین سفارش کاربر به‌صورت خودکار ذخیره می‌شود.
                      </p>
                    )}
                    <InfoRow label="تاریخ عضویت" value={details.joinDate} />
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Read-only label/value row used in the user details sheet. */
function InfoRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-[#1c1916] px-4 py-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className={cn("truncate text-xs font-bold text-foreground", ltr && "font-mono")}
      >
        {value}
      </span>
    </div>
  );
}