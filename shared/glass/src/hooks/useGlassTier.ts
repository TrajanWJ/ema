import { useMemo } from "react";
import type { GlassTier } from "../components/GlassSurface/GlassSurface.tsx";

export interface GlassTierStyle {
  readonly background: string;
  readonly backdropFilter: string;
  readonly WebkitBackdropFilter: string;
  readonly border: string;
}

const TIER_VARS = {
  wash: {
    bg: "var(--pn-glass-wash-bg)",
    blur: "var(--pn-glass-wash-blur)",
    sat: "var(--pn-glass-wash-saturate)",
    border: "transparent",
  },
  ambient: {
    bg: "var(--pn-glass-ambient-bg)",
    blur: "var(--pn-glass-ambient-blur)",
    sat: "var(--pn-glass-ambient-saturate)",
    border: "transparent",
  },
  surface: {
    bg: "var(--pn-glass-surface-bg)",
    blur: "var(--pn-glass-surface-blur)",
    sat: "var(--pn-glass-surface-saturate)",
    border: "var(--pn-glass-surface-border)",
  },
  panel: {
    bg: "var(--pn-glass-panel-bg)",
    blur: "var(--pn-glass-panel-blur)",
    sat: "var(--pn-glass-panel-saturate)",
    border: "var(--pn-glass-panel-border)",
  },
  elevated: {
    bg: "var(--pn-glass-elevated-bg)",
    blur: "var(--pn-glass-elevated-blur)",
    sat: "var(--pn-glass-elevated-saturate)",
    border: "var(--pn-glass-elevated-border)",
  },
  peak: {
    bg: "var(--pn-glass-peak-bg)",
    blur: "var(--pn-glass-peak-blur)",
    sat: "var(--pn-glass-peak-saturate)",
    border: "var(--pn-glass-peak-border)",
  },
} as const satisfies Record<
  GlassTier,
  { bg: string; blur: string; sat: string; border: string }
>;

/**
 * useGlassTier — returns a ready-to-spread inline style that applies a glass
 * tier without needing the .module.css class. Useful when a component must
 * inline-style (e.g. a Portal-rendered menu, a Canvas overlay) and can't
 * scope a class.
 *
 * Prefer GlassSurface when you can. This is the escape hatch.
 */
export function useGlassTier(tier: GlassTier): GlassTierStyle {
  return useMemo(() => {
    const v = TIER_VARS[tier];
    const filter = `blur(${v.blur}) saturate(${v.sat})`;
    return {
      background: v.bg,
      backdropFilter: filter,
      WebkitBackdropFilter: filter,
      border: `1px solid ${v.border}`,
    };
  }, [tier]);
}
