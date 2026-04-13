import type { CSSProperties } from "react";

interface GridPatternProps {
  readonly opacity?: number;
  readonly size?: number;
  readonly style?: CSSProperties;
}

export function GridPattern({
  opacity = 0.2,
  size = 22,
  style,
}: GridPatternProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundImage: [
          `linear-gradient(rgba(255,255,255,${opacity * 0.5}) 1px, transparent 1px)`,
          `linear-gradient(90deg, rgba(255,255,255,${opacity}) 1px, transparent 1px)`,
        ].join(", "),
        backgroundSize: `${size}px ${size}px`,
        maskImage: "linear-gradient(180deg, rgba(0,0,0,0.6), transparent 85%)",
        WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0.6), transparent 85%)",
        ...style,
      }}
    />
  );
}
