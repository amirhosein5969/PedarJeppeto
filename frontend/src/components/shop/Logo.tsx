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
export function Logo({ size = 52, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <span className="relative grid shrink-0 place-items-center">
      {glow && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: size * 2.2,
            height: size * 2.2,
            background:
              "radial-gradient(circle, rgba(212,175,55,0.15) 0%, rgba(0,0,0,0) 70%)",
          }}
        />
      )}
      <img
        src="/pedar-logo.png"
        alt="پدر ژپتو"
        className="relative select-none"
        style={{
          height: size,
          width: (size * 3) / 2,
          filter: glow
            ? "drop-shadow(0 2px 8px rgba(0,0,0,0.45)) drop-shadow(0 0 20px rgba(212,175,55,0.25))"
            : undefined,
        }}
        draggable={false}
      />
    </span>
  );
}