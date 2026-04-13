/**
 * Motion tokens. Single easing curve, a handful of timings.
 *
 * From Appendix A.8:
 *   ease       cubic-bezier(0.65, 0.05, 0, 1)
 *   tooltip    120ms
 *   glass      200ms
 *   debounce   300ms
 *   heartbeat  1000ms
 */

export const easing = {
  smooth: "cubic-bezier(0.65, 0.05, 0, 1)",
} as const;

export const duration = {
  tooltip: 120,
  glass: 200,
  debounce: 300,
  heartbeat: 1000,
} as const;

export type DurationName = keyof typeof duration;

export const keyframes = {
  glassDropIn:
    "from { opacity: 0; transform: translateY(-4px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); }",
  fadeSlideUp:
    "from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); }",
  fadeIn: "from { opacity: 0; } to { opacity: 1; }",
  pulseDot: "0%, 100% { opacity: 1; } 50% { opacity: 0.5; }",
} as const;

export type KeyframeName = keyof typeof keyframes;
