import type { CSSProperties } from "react";

interface SignalOrbProps {
  readonly tone?: string;
  readonly size?: number;
  readonly style?: CSSProperties;
}

export function SignalOrb({
  tone = "var(--color-pn-teal-400)",
  size = 180,
  style,
}: SignalOrbProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: [
          `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${tone} 82%, white), transparent 18%)`,
          `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${tone} 46%, transparent), transparent 62%)`,
          `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${tone} 20%, transparent), transparent 70%)`,
        ].join(", "),
        filter: "blur(0.4px)",
        opacity: 0.94,
        ...style,
      }}
    />
  );
}
