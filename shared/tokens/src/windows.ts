/**
 * Window layer alphas. Values from Appendix A.8 and the old globals.css.
 *
 *   wash   0.46  rgba(6, 8, 18, …)
 *   core   0.66  rgba(7, 9, 20, …)
 *   deep   0.72  rgba(5, 6, 22, …)
 *   panel  0.50  rgba(10, 14, 28, …)
 *   header 0.48  rgba(10, 14, 28, …)
 */

export const windowLayers = {
  wash: "rgba(6, 8, 18, 0.46)",
  core: "rgba(7, 9, 20, 0.66)",
  deep: "rgba(5, 6, 22, 0.72)",
  panel: "rgba(10, 14, 28, 0.50)",
  header: "rgba(10, 14, 28, 0.48)",
} as const;

export type WindowLayer = keyof typeof windowLayers;
