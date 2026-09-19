import { Leaf } from "lucide-react";

export function Logo({ size = 52 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full border border-primary/50 bg-secondary/40 shadow-glow"
      style={{ width: size, height: size }}
    >
      <Leaf className="text-primary" size={size * 0.45} strokeWidth={1.6} />
    </span>
  );
}
