/**
 * Semantic colors. Verbatim from Appendix A.8.
 */

import type { HexColor } from "./colors.ts";

export const semantic = {
  error: "#E24B4A",
  success: "#22C55E",
  warning: "#EAB308",
  info: "#06b6d4",
  focus: "#6366f1",
  discovery: "#a78bfa",
  neutral: "#64748b",
} as const satisfies Record<string, HexColor>;

export type SemanticName = keyof typeof semantic;
