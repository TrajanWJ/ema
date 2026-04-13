/**
 * `filter` transform — pass/drop events based on conditions.
 *
 * Config shape:
 *   { conditions: Array<{ op: "eq"|"neq"|"present", key, value? }>,
 *     mode: "all" | "any" (default "all") }
 *
 * When the conditions fail, the transform halts the pipe run.
 */

import { z } from "zod";
import type { TransformDef, TransformResult } from "../types.js";

const conditionSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("eq"), key: z.string(), value: z.unknown() }),
  z.object({ op: z.literal("neq"), key: z.string(), value: z.unknown() }),
  z.object({ op: z.literal("present"), key: z.string() }),
]);

const configSchema = z.object({
  conditions: z.array(conditionSchema).default([]),
  mode: z.enum(["all", "any"]).default("all"),
});

function evaluate(
  cond: z.infer<typeof conditionSchema>,
  payload: Record<string, unknown>,
): boolean {
  const actual = payload[cond.key];
  switch (cond.op) {
    case "eq":
      return actual === cond.value;
    case "neq":
      return actual !== cond.value;
    case "present":
      return actual !== undefined && actual !== null;
  }
}

export const filterTransform: TransformDef = {
  name: "filter",
  label: "Filter",
  description: "Pass/drop events based on conditions",
  apply: async (payload, rawConfig): Promise<TransformResult> => {
    const config = configSchema.parse(rawConfig ?? {});
    const map =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    if (config.conditions.length === 0) {
      return { payload, halted: false };
    }
    const results = config.conditions.map((c) => evaluate(c, map));
    const passed =
      config.mode === "all" ? results.every(Boolean) : results.some(Boolean);
    if (passed) return { payload, halted: false };
    return {
      payload,
      halted: true,
      reason: `filter dropped event (mode=${config.mode})`,
    };
  },
};
