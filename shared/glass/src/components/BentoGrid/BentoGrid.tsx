import type { ReactNode } from "react";

interface BentoGridProps {
  readonly children: ReactNode;
  readonly minColumnWidth?: number;
}

export function BentoGrid({
  children,
  minColumnWidth = 260,
}: BentoGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minColumnWidth}px, 1fr))`,
        gap: "var(--pn-space-4)",
      }}
    >
      {children}
    </div>
  );
}
