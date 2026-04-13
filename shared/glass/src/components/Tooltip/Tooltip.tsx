import { useState, type ReactNode } from "react";
import styles from "./Tooltip.module.css";

type TooltipSide = "top" | "right" | "bottom" | "left";

interface TooltipProps {
  readonly label: string;
  readonly side?: TooltipSide;
  readonly children: ReactNode;
}

const SIDE_CLASS = {
  top: styles.bubbleTop,
  right: undefined,
  bottom: styles.bubbleBottom,
  left: styles.bubbleLeft,
} satisfies Record<TooltipSide, string | undefined>;

/**
 * Tooltip — glass bubble with glassDropIn keyframe on mount.
 * Keep labels short and directive (EMA-VOICE).
 */
export function Tooltip({ label, side = "right", children }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={styles.wrapper}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={[styles.bubble, SIDE_CLASS[side]].filter(Boolean).join(" ")}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export type { TooltipSide };
