import type { LucideIcon } from "lucide-react";

export function AdminPlaceholder({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
}) {
  return (
    <div>
      <div>
        <h1 className="text-lg font-extrabold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="mt-6 grid min-h-80 place-items-center rounded-2xl border border-dashed border-white/10 bg-[#1a1714]/40 p-10 text-center">
        <div>
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-6" />
          </span>
          <p className="mt-4 text-sm font-bold text-foreground">ساختار صفحه آماده است</p>
          <p className="mt-1 text-xs text-muted-foreground">
            محتوای این بخش در گام‌های بعدی اضافه می‌شود.
          </p>
        </div>
      </div>
    </div>
  );
}
