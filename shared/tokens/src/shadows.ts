/**
 * Shadows and focus rings. Values observed in the old globals.css.
 *
 *   dropdown     0 18px 48px rgba(0,0,0,0.48), 0 6px 18px rgba(0,0,0,0.26)
 *   focusRing    0 0 0 2px rgba(45, 212, 168, 0.10)   (teal-400 @ 10% alpha)
 *
 * Border token set (subtle / default / strong) comes from :root in globals.css.
 */

export const shadows = {
  dropdown:
    "0 18px 48px rgba(0, 0, 0, 0.48), 0 6px 18px rgba(0, 0, 0, 0.26)",
  focusRing: "0 0 0 2px rgba(45, 212, 168, 0.10)",
  insetHairline: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
} as const;

export const borders = {
  subtle: "rgba(255, 255, 255, 0.04)",
  default: "rgba(255, 255, 255, 0.08)",
  strong: "rgba(255, 255, 255, 0.15)",
} as const;

export const fieldBg = {
  base: "rgba(255, 255, 255, 0.04)",
  hover: "rgba(255, 255, 255, 0.055)",
  active: "rgba(255, 255, 255, 0.07)",
} as const;

export const dropdown = {
  bg: "rgba(10, 12, 20, 0.94)",
  bgSolid: "#0f1320",
} as const;

export type ShadowName = keyof typeof shadows;
