/**
 * Brand logo — the "پدر ژپتو" mark, served from `public/pedar-logo.png`.
 *
 * The source image is 1536×1024 (3:2 landscape), so `size` is the HEIGHT in
 * pixels and the width follows the aspect ratio. Used by the storefront
 * Header/Footer, the OTP login screen, and the admin panel.
 */
export function Logo({ size = 52 }: { size?: number }) {
  return (
    <img
      src="/pedar-logo.png"
      alt="پدر ژپتو"
      className="shrink-0 select-none"
      style={{ height: size, width: (size * 3) / 2 }}
      draggable={false}
    />
  );
}