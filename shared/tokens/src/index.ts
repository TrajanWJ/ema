/**
 * @ema/tokens — EMA design tokens.
 *
 * Source of truth: SELF-POLLINATION-FINDINGS Appendix A.8 and A.10, plus the
 * old build's globals.css. Hex values and alphas are NON-NEGOTIABLE. See each
 * module for per-token provenance.
 */

export * from "./colors.ts";
export * from "./glass.ts";
export * from "./windows.ts";
export * from "./motion.ts";
export * from "./typography.ts";
export * from "./semantic.ts";
export * from "./spacing.ts";
export * from "./radii.ts";
export * from "./shadows.ts";

import { base, ramps } from "./colors.ts";
import { glass } from "./glass.ts";
import { windowLayers } from "./windows.ts";
import { easing, duration, keyframes } from "./motion.ts";
import { fontFamily, textAlpha, textColor } from "./typography.ts";
import { semantic } from "./semantic.ts";
import { spacing } from "./spacing.ts";
import { radii } from "./radii.ts";
import { shadows, borders, fieldBg, dropdown } from "./shadows.ts";

/**
 * Aggregated token tree. Used by the build script to emit tokens.css /
 * tokens.json / tokens.ts without needing to import each module separately.
 */
export const tokens = {
  base,
  ramps,
  glass,
  windowLayers,
  easing,
  duration,
  keyframes,
  fontFamily,
  textAlpha,
  textColor,
  semantic,
  spacing,
  radii,
  shadows,
  borders,
  fieldBg,
  dropdown,
} as const;

export type Tokens = typeof tokens;
