/**
 * Typography tokens.
 *
 * From Appendix A.8 and the old globals.css:
 *   --font-sans: system-ui, -apple-system, "Segoe UI", sans-serif
 *   --font-mono: "JetBrains Mono", "Cascadia Code", "Fira Code", ui-monospace, monospace
 */

export const fontFamily = {
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", "Cascadia Code", "Fira Code", ui-monospace, monospace',
} as const;

// Text layer alphas from A.8 (0.87 / 0.60 / 0.40 / 0.25).
export const textAlpha = {
  primary: 0.87,
  secondary: 0.6,
  tertiary: 0.4,
  muted: 0.25,
} as const;

export type TextLayer = keyof typeof textAlpha;

export const textColor = {
  primary: "rgba(255, 255, 255, 0.87)",
  secondary: "rgba(255, 255, 255, 0.60)",
  tertiary: "rgba(255, 255, 255, 0.40)",
  muted: "rgba(255, 255, 255, 0.25)",
} as const satisfies Record<TextLayer, string>;
