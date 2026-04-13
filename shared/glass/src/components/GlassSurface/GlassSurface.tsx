import type { HTMLAttributes, ReactNode } from "react";
import styles from "./GlassSurface.module.css";

export type GlassTier =
  | "wash"
  | "ambient"
  | "surface"
  | "panel"
  | "elevated"
  | "peak";

export type GlassPadding = "none" | "sm" | "md" | "lg";

interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  readonly tier?: GlassTier;
  readonly padding?: GlassPadding;
  readonly children?: ReactNode;
}

const TIER_CLASS = {
  wash: styles["tier-wash"],
  ambient: styles["tier-ambient"],
  surface: styles["tier-surface"],
  panel: styles["tier-panel"],
  elevated: styles["tier-elevated"],
  peak: styles["tier-peak"],
} satisfies Record<GlassTier, string | undefined>;

const PAD_CLASS = {
  none: styles["padding-none"],
  sm: styles["padding-sm"],
  md: styles["padding-md"],
  lg: styles["padding-lg"],
} satisfies Record<GlassPadding, string | undefined>;

/**
 * GlassSurface — select a glass tier from @ema/tokens and wrap content.
 *
 * Use this as the lowest-level building block. GlassCard, CommandBar, Dock,
 * and others compose on top of it. If you find yourself reaching for
 * backdrop-filter in a vApp, reach for GlassSurface instead.
 */
export function GlassSurface({
  tier = "surface",
  padding = "md",
  className,
  children,
  ...rest
}: GlassSurfaceProps) {
  const cls = [styles.root, TIER_CLASS[tier], PAD_CLASS[padding], className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
