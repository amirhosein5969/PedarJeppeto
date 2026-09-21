import { createFileRoute } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Clock, Instagram, Loader2, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { z } from "zod";

import { toFa } from "@/lib/shop-data";
import { FaqAccordion } from "@/components/shop/FaqAccordion";
import { SectionHeader } from "@/components/shop/SectionHeader";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const subjects = [
  { value: "order", label: "پیگیری سفارش" },
  { value: "bulk", label: "همکاری عمده و سازمانی" },
  { value: "feedback", label: "انتقادات و پیشنهادات" },
  { value: "other", label: "سایر" },
];

const irPhoneRegex = /^(?:\+98|0)?9\d{9}$|^0[1-8]\d{9}$/;

const contactSchema = z.object({
  fullName: z
    .string()
    .min(2, "نام و نام خانوادگی را کامل وارد کنید")
    .max(100, "نام و نام خانوادگی بیش از حد طولانی است"),
  contact: z
    .string()
    .min(1, "ایمیل یا شماره تماس را وارد کنید")
    .refine(
      (value) => z.string().email().safeParse(value).success || irPhoneRegex.test(value),
      "لطفاً یک ایمیل معتبر یا شماره تماس ایرانی وارد کنید",
    ),
  subject: z.string().min(1, "موضوع پیام را انتخاب کنید"),
  message: z
    .string()
    .min(10, "متن پیام حداقل باید ۱۰ کاراکتر باشد")
    .max(1000, "متن پیام بیش از حد طولانی است"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

type ContactSearch = {
  subject?: string | undefined;
  product?: string | undefined;
  message?: string | undefined;
};

export const Route = createFileRoute("/contact")({
  validateSearch: (search: Record<string, unknown>): ContactSearch => ({
    subject:
      typeof search["subject"] === "string" && subjects.some((s) => s.value === search["subject"])
        ? search["subject"]
        : undefined,
    product: typeof search["product"] === "string" ? search["product"] : undefined,
    message: typeof search["message"] === "string" ? search["message"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "تماس با پدر ژپتو | پاسخگوی سفارش‌های چوبی شما" },
      {
        name: "description",
        content: "راه‌های ارتباط با کارگاه پدر ژپتو: تلفن، ایمیل، آدرس، فرم پیام و پرسش‌های متداول.",
      },
      { property: "og:title", content: "تماس با پدر ژپتو" },
      { property: "og:description", content: "برای سفارش سفارشی یا سوال، با ما در تماس باشید." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const { subject, message } = Route.useSearch();

  // Prefilled by the "bulk order" shortcut on product cards.
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      fullName: "",
      contact: "",
      subject: subject ?? "",
      message: message ?? "",
    },
  });

  const onSubmit = async (_values: ContactFormValues) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    toast.success("پیام شما با موفقیت ارسال شد", {
      description: "کارشناسان ما به زودی با شما تماس می‌گیرند.",
    });
    form.reset();
  };

  const contactCards = [
    { icon: Phone, label: toFa("021-88445566") },
    { icon: Mail, label: "info@choobkar.ir" },
    { icon: MapPin, label: `تهران، خیابان کارگر شمالی، کوچه نجاران، پلاک ${toFa(24)}` },
    {
      icon: Clock,
      label: "شنبه تا چهارشنبه: ۹:۰۰ الی ۱۸:۰۰ | پنج‌شنبه‌ها: ۹:۰۰ الی ۱۴:۰۰",
    },
  ];

  /** lucide-react has no Bale/Basalam marks, so those use styled letter badges. */
  const socialLinks: { label: string; icon?: typeof Instagram; char?: string; href: string }[] = [
    { icon: Instagram, label: "اینستاگرام", href: "#" },
    { icon: Send, label: "تلگرام", href: "#" },
    { icon: MessageCircle, label: "واتساپ", href: "#" },
    { char: "B", label: "بله", href: "#" },
    { char: "ب", label: "باسلام", href: "#" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      <SectionHeader
        as="h1"
        title="تماس با ما"
        subtitle="برای سفارش سفارشی یا هر پرسش، با کارگاه پدر ژپتو در تماس باشید"
      />
      {subject === "bulk" && (
        <p className="mt-3 rounded-xl border border-secondary/60 bg-secondary/20 p-4 text-xs leading-6">
          درخواست سفارش عمده ثبت شده است؛ کافی است نام و راه ارتباطی خود را تکمیل کنید.
        </p>
      )}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5 rounded-2xl border border-border bg-card p-6"
          >
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="contact-fullName" className="text-xs text-foreground/80">
                    نام و نام خانوادگی
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      id="contact-fullName"
                      placeholder="مثلاً مریم رضایی"
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="contact-contact" className="text-xs text-foreground/80">
                    ایمیل یا شماره موبایل
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      id="contact-contact"
                      placeholder="example@mail.com یا 09123456789"
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="contact-subject" className="text-xs text-foreground/80">
                    موضوع پیام
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger
                        id="contact-subject"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-ring [&>span]:text-muted-foreground data-[state=closed]:[&>span]:text-muted-foreground"
                      >
                        <SelectValue placeholder="انتخاب موضوع پیام" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.value} value={subject.value}>
                          {subject.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="contact-message" className="text-xs text-foreground/80">
                    متن پیام
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      id="contact-message"
                      rows={5}
                      placeholder="پیام شما برای کارگاه…"
                      className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال ارسال…
                </>
              ) : (
                "ارسال پیام"
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              معمولاً ظرف کمتر از ۲ ساعت کاری پاسخ داده می‌شود
            </p>
          </form>
        </Form>

        <div className="space-y-4">
          <ul className="space-y-4 text-sm">
            {contactCards.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary/40 text-primary">
                  <Icon size={18} />
                </span>
                <span className="min-w-0">{label}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
            <span className="text-sm text-muted-foreground">ما را دنبال کنید:</span>
            <div className="flex gap-2">
              {socialLinks.map(({ icon: Icon, label, char, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="grid size-9 place-items-center rounded-lg bg-secondary/40 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {Icon ? (
                    <Icon size={17} />
                  ) : (
                    <span className="text-xs leading-none font-extrabold">{char}</span>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-16">
        <SectionHeader title="پرسش‌های متداول" />
        <div className="mt-6">
          <FaqAccordion />
        </div>
      </section>
    </div>
  );
}
