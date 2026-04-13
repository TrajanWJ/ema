/**
 * `branch` action — conditional branching on a payload field.
 *
 * Evaluates a simple condition (eq / neq / gt / lt / present) and records
 * which branch was taken. v1 does not dispatch the branch targets — that is
 * the executor's job in a future iteration. For now the action returns the
 * taken branch id so downstream logic can inspect it.
 */

import { z } from "zod";
import type { ActionDef } from "../types.js";
import { emitPipeActionEvent, pipeLog } from "../voice.js";

const conditionSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("eq"), key: z.string(), value: z.unknown() }),
  z.object({ op: z.literal("neq"), key: z.string(), value: z.unknown() }),
  z.object({ op: z.literal("gt"), key: z.string(), value: z.number() }),
  z.object({ op: z.literal("lt"), key: z.string(), value: z.number() }),
  z.object({ op: z.literal("present"), key: z.string() }),
]);

const input = z.object({
  condition: conditionSchema,
  if_true: z.string().optional(),
  if_false: z.string().optional(),
}).passthrough();

const output = z.object({
  ok: z.literal(true),
  branch: z.enum(["if_true", "if_false"]),
  next: z.string().nullable(),
});

function evaluate(
  condition: z.infer<typeof conditionSchema>,
  payload: Record<string, unknown>,
): boolean {
  const actual = payload[condition.key];
  switch (condition.op) {
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "gt":
      return typeof actual === "number" && actual > condition.value;
    case "lt":
      return typeof actual === "number" && actual < condition.value;
    case "present":
      return actual !== undefined && actual !== null;
  }
}

export const branchActions: readonly ActionDef[] = [
  {
    name: "branch",
    context: "branch",
    label: "Branch",
    description: "Conditional branching based on payload field value",
    inputSchema: input,
    outputSchema: output,
    handler: async (raw, ctx) => {
      const parsed = input.parse(raw);
      const payload = (raw && typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : {});
      const truthy = evaluate(parsed.condition, payload);
      const branch = truthy ? "if_true" : "if_false";
      const next = (truthy ? parsed.if_true : parsed.if_false) ?? null;

      emitPipeActionEvent(ctx, "branch", { branch, next });
      pipeLog(`branch stub took ${branch} -> ${next ?? "null"}`);
      return { ok: true as const, branch, next };
    },
  },
];
