import type { HTMLAttributes, ReactNode } from "react";
import styles from "./GlassCard.module.css";

type CardSize = "sm" | "md";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  readonly title?: string;
  readonly onNavigate?: () => void;
  readonly size?: CardSize;
  readonly children: ReactNode;
}

const SIZE_CLASS = {
  sm: styles["size-sm"],
  md: styles["size-md"],
} satisfies Record<CardSize, string | undefined>;

/**
 * GlassCard — the .glass-surface tier with an optional title row and
 * navigation affordance. Ports the old shared/GlassCard behavior but
 * consumes only tokens.
 */
export function GlassCard({
  title,
  onNavigate,
  size = "md",
  className,
  children,
  ...rest
}: GlassCardProps) {
  const cls = [styles.root, SIZE_CLASS[size], className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {title && (
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          {onNavigate && (
            <button
              type="button"
              className={styles.navButton}
              onClick={onNavigate}
              aria-label={`Open ${title}`}
            >
              &rarr;
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export type { CardSize };
