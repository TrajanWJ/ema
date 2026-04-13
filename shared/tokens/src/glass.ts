/**
 * Glass surface tiers.
 *
 * Original (A.8) tiers:
 *   glass-ambient   rgba(10,14,28,0.38)  blur 6px  saturate 120%
 *   glass-surface   rgba(10,14,28,0.52)  blur 20px saturate 150%  border rgba(255,255,255,0.06)
 *   glass-elevated  rgba(10,14,28,0.62)  blur 28px saturate 180%  border rgba(255,255,255,0.08)
 *
 * Added in-between tiers (approved expansion):
 *   glass-wash    lighter than ambient  (alpha 0.26, blur 4px,  sat 110%)
 *   glass-panel   between surface and elevated (alpha 0.57, blur 24px, sat 165%)
 *   glass-peak    heavier than elevated (alpha 0.74, blur 36px, sat 200%)
 *
 * All glass layers share the same base color channel (10, 14, 28) so they
 * stack predictably.
 */

export type GlassTier = {
  name: string;
  background: string;
  blur: number; // px
  saturate: number; // percent
  border?: string;
};

const base = "10, 14, 28";

export const glass = {
  wash: {
    name: "glass-wash",
    background: `rgba(${base}, 0.26)`,
    blur: 4,
    saturate: 110,
  },
  ambient: {
    name: "glass-ambient",
    background: `rgba(${base}, 0.38)`,
    blur: 6,
    saturate: 120,
  },
  surface: {
    name: "glass-surface",
    background: `rgba(${base}, 0.52)`,
    blur: 20,
    saturate: 150,
    border: "rgba(255, 255, 255, 0.06)",
  },
  panel: {
    name: "glass-panel",
    background: `rgba(${base}, 0.57)`,
    blur: 24,
    saturate: 165,
    border: "rgba(255, 255, 255, 0.07)",
  },
  elevated: {
    name: "glass-elevated",
    background: `rgba(${base}, 0.62)`,
    blur: 28,
    saturate: 180,
    border: "rgba(255, 255, 255, 0.08)",
  },
  peak: {
    name: "glass-peak",
    background: `rgba(${base}, 0.74)`,
    blur: 36,
    saturate: 200,
    border: "rgba(255, 255, 255, 0.10)",
  },
} as const satisfies Record<string, GlassTier>;

export type GlassName = keyof typeof glass;
