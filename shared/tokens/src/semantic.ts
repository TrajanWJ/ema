/**
 * Semantic colors. Verbatim from Appendix A.8.
 */

import type { HexColor } from "./colors.ts";

export const semantic = {
  error: "#E24B4A",
  success: "#22C55E",
  warning: "#EAB308",
} as const satisfies Record<string, HexColor>;

export type SemanticName = keyof typeof semantic;
