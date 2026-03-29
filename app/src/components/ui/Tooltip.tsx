import { useState } from "react";

interface TooltipProps {
  readonly label: string;
  readonly children: React.ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className="absolute left-full top-1/2 -translate-y-1/2 ml-2 glass-surface rounded px-2 py-1 text-[0.65rem] whitespace-nowrap pointer-events-none z-50"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
