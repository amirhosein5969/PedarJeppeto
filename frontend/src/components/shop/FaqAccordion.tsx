import { HelpCircle, Plus } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    value: "shipping",
    title: "ارسال سفارش‌ها چگونه انجام می‌شود؟",
    content:
      "سفارش‌ها با بسته‌بندی ایمن چوبی و ضدضربه ارسال می‌شوند. برای تهران معمولاً ۱ تا ۲ روز کاری و برای شهرستان‌ها ۳ تا ۵ روز کاری زمان می‌برد. ارسال برای خرید بالای ۵ میلیون تومان رایگان است.",
  },
  {
    value: "care",
    title: "نگهداری از محصولات چوبی دست‌ساز چگونه است؟",
    content:
      "از قرار دادن محصول در نور مستقیم خورشید و مجاورت طولانی با رطوبت خودداری کنید. تمیز کردن با دستمال نرم و کمی روغن بادام یا روغن مخصوص چوب هر چند ماه یکبار، درخشش و عمر آن را بیشتر می‌کند.",
  },
  {
    value: "tracking",
    title: "سفارش ثبت‌شده را چطور پیگیری کنم؟",
    content:
      "پس از ثبت سفارش، کد رهگیری از طریق پیامک و ایمیل ارسال می‌شود. همچنین می‌توانید از طریق فرم تماس با موضوع «پیگیری سفارش» و اعلام شماره سفارش، با کارشناسان ما در ارتباط باشید.",
  },
];

export function FaqAccordion() {
  return (
    <Accordion type="single" collapsible className="w-full">
      {faqItems.map((item) => (
        <AccordionItem
          key={item.value}
          value={item.value}
          className="mb-3 overflow-hidden rounded-xl border border-white/5 border-b-0 bg-[#1a1714] transition-all duration-300 hover:border-primary/30"
        >
          <AccordionTrigger className="group/acc gap-3 px-5 text-start text-sm font-bold text-foreground no-underline hover:no-underline hover:text-primary-soft [&>svg:last-child]:hidden">
            <span className="flex flex-1 items-center gap-3">
              <HelpCircle
                size={18}
                className="shrink-0 text-primary-soft drop-shadow-[0_0_8px_var(--color-primary)]"
              />
              {item.title}
            </span>
            <Plus className="size-4 shrink-0 text-primary-soft transition-transform duration-300 group-data-[state=open]/acc:rotate-45" />
          </AccordionTrigger>
          <AccordionContent className="mx-3 mb-3 rounded-lg bg-primary/5 px-4 py-3 leading-8 text-foreground/80">
            {item.content}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
