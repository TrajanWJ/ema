/**
 * Border radii. Values observed in the old globals.css:
 *   glass-input    0.5rem
 *   pn-select      0.7rem
 *
 * Scale extended with small / md / lg / xl / full for general use.
 */

export const radii = {
  none: "0rem",
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.7rem",
  xl: "1rem",
  "2xl": "1.25rem",
  full: "9999px",
} as const;

export type RadiusKey = keyof typeof radii;
