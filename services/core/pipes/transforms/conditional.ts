/**
 * `conditional` transform — if/then/else halts the pipe when the condition
 * fails. Unlike `filter` (which is a boolean drop), `conditional` can also
 * stamp the payload with the branch taken so actions can behave on it.
 */

import { z } from "zod";
import type { TransformDef, TransformResult } from "../types.js";

const configSchema = z.object({
  key: z.string(),
  op: z.enum(["eq", "neq", "present", "gt", "lt"]).default("present"),
  value: z.unknown().optional(),
  halt_on_false: z.boolean().default(true),
  stamp_key: z.string().default("conditional_branch"),
});

function evaluate(
  op: z.infer<typeof configSchema>["op"],
  actual: unknown,
  expected: unknown,
): boolean {
  switch (op) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "present":
      return actual !== undefined && actual !== null;
    case "gt":
      return (
        typeof actual === "number" &&
        typeof expected === "number" &&
        actual > expected
      );
    case "lt":
      return (
        typeof actual === "number" &&
        typeof expected === "number" &&
        actual < expected
      );
  }
}

export const conditionalTransform: TransformDef = {
  name: "conditional",
  label: "Conditional",
  description: "Branch logic — if/then/else",
  apply: async (payload, rawConfig): Promise<TransformResult> => {
    const config = configSchema.parse(rawConfig ?? {});
    const map =
      payload && typeof payload === "object"
        ? { ...(payload as Record<string, unknown>) }
        : {};
    const passed = evaluate(config.op, map[config.key], config.value);
    map[config.stamp_key] = passed ? "then" : "else";
    if (!passed && config.halt_on_false) {
      return {
        payload: map,
        halted: true,
        reason: `conditional (${config.key} ${config.op}) failed`,
      };
    }
    return { payload: map, halted: false };
  },
};
