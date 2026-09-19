import { Droplets, ShieldCheck, TreePine } from "lucide-react";

const items = [
  { icon: TreePine, title: "چوب ۱۰۰٪ طبیعی", text: "بدون رزین و چسب شیمیایی" },
  { icon: Droplets, title: "روغن جلا با قابلیت پرداخت", text: "درخشش و محافظت دست‌ساز از سطح چوب" },
  { icon: ShieldCheck, title: "ضمانت سلامت و اصالت", text: "تضمین کیفیت ساخت کارگاهی" },
];

export function TrustBar() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16">
      <div className="grid gap-x-6 gap-y-5 rounded-2xl border border-white/5 bg-[#181512]/70 p-6 backdrop-blur-md sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex min-w-0 items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/30 text-primary-soft">
              <Icon size={20} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold whitespace-nowrap text-foreground">{title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
