import { Flame } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  as = "h2",
}: {
  title: string;
  subtitle?: ReactNode;
  badge?: string;
  /** Heading level: "h1" for page titles, "h2" for in-page sections. */
  as?: "h1" | "h2";
}) {
  const Tag = as;
  const { ref, visible } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        "relative",
        visible
          ? "animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out motion-reduce:animate-none"
          : "opacity-0 motion-reduce:opacity-100",
      )}
    >
      {/* Extremely subtle ambient glow behind the title. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-primary/[0.07] blur-[80px]"
      />

      {/* Ultra-thin hairline accent, bright at the start (right in RTL), fading away. */}
      <div className="mb-4 h-[1px] w-24 rounded-full bg-linear-to-l from-primary/80 to-transparent" />

      <div className="flex flex-wrap items-center gap-2">
        <Tag className="text-3xl font-extrabold tracking-tight text-foreground drop-shadow-sm md:text-4xl">
          {title}
        </Tag>
        {badge && (
          <span className="deal-badge flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold">
            <Flame size={13} strokeWidth={2.5} />
            {badge}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-3 text-sm font-light tracking-wide text-muted-foreground md:text-base">
          {subtitle}
        </p>
      )}
    </div>
  );
}
