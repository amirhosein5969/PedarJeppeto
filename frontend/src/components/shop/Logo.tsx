/**
 * Brand logo — the "پدر ژپتو" mark, served from `public/pedar-logo.png`.
 *
 * The source image is 1536×1024 (3:2 landscape), so `size` is the HEIGHT in
 * pixels and the width follows the aspect ratio.
 *
 * `glow` paints a warm amber radial spotlight behind the mark and a soft
 * drop-shadow on the image itself so the wooden detail pops ("Geppetto's
 * Workshop" spotlight — used by the Header and the OTP login screen). The
 * glow halo is absolutely positioned, so it never affects layout.
 */
export function Logo({ size = 100, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <span className="relative grid shrink-0 place-items-center">
      {glow && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            // سایز هاله نور را کمی پهن‌تر کردیم
            width: size * 1.8, 
            height: size * 1.8,
            // رنگ را به طلاییِ کهربایی تغییر دادیم و شفافیت (Opacity) را از 0.15 به 0.35 رساندیم تا قشنگ دیده شود
            background:
              "radial-gradient(circle, rgba(234, 167, 74, 0.05) 0%, rgba(0,0,0,0) 75%)",
          }}
        />
      )}
      <img
        src="/pedar-logo.png"
        alt="پدر ژپتو"
        className="relative select-none object-contain"
        style={{
          // ارتفاع لوگو از طریق پراپ size کنترل می‌شود (پیش‌فرض را روی 75 گذاشتیم که بزرگتر باشد)
          height: size,
          // به جای ضرب و تقسیم، عرض را روی auto می‌گذاریم تا عکس دفرمه نشود و تناسب واقعی خودش را حفظ کند
          width: "auto", 
          // سایه‌ی مشکی زیر لوگو را قوی‌تر کردیم تا از بک‌گراند جدا شود، و سایه طلایی دورش را هم درخشان‌تر کردیم
          filter: glow
            ? "drop-shadow(0 4px 12px rgba(0,0,0,0.7)) drop-shadow(0 0 25px rgba(255, 170, 50, 0.35))"
            : undefined,
        }}
        draggable={false}
      />
    </span>
  );
}