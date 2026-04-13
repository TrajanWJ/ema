/**
 * `transform` action — payload manipulation at action tier.
 *
 * Supported operations (mirrors the Elixir TransformAction):
 *   - set:      { op: "set", key, value }
 *   - copy:     { op: "copy", from, to }
 *   - delete:   { op: "delete", key }
 *   - rename:   { op: "rename", from, to }
 *   - template: { op: "template", key, template } — renders `{{x}}` tokens
 */

import { z } from "zod";
import type { ActionDef } from "../types.js";
import { emitPipeActionEvent, pipeLog } from "../voice.js";

const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set"), key: z.string(), value: z.unknown() }),
  z.object({ op: z.literal("copy"), from: z.string(), to: z.string() }),
  z.object({ op: z.literal("delete"), key: z.string() }),
  z.object({ op: z.literal("rename"), from: z.string(), to: z.string() }),
  z.object({ op: z.literal("template"), key: z.string(), template: z.string() }),
]);

const input = z.object({
  operations: z.array(operationSchema).default([]),
}).passthrough();

const output = z.object({
  ok: z.literal(true),
  payload: z.record(z.unknown()),
});

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function renderTemplate(
  template: string,
  map: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/gu, (_m, key: string) => {
    const v = map[key];
    if (v === undefined || v === null) return "";
    return typeof v === "string" ? v : JSON.stringify(v);
  });
}

export const transformActions: readonly ActionDef[] = [
  {
    name: "transform",
    context: "transform",
    label: "Transform Payload",
    description:
      "Manipulate pipe payload fields (set/copy/delete/rename/template)",
    inputSchema: input,
    outputSchema: output,
    handler: async (raw, ctx) => {
      const parsed = input.parse(raw);
      const working = asRecord(raw);
      delete working.operations;

      for (const op of parsed.operations) {
        switch (op.op) {
          case "set": {
            working[op.key] = op.value;
            break;
          }
          case "copy": {
            working[op.to] = working[op.from];
            break;
          }
          case "delete": {
            delete working[op.key];
            break;
          }
          case "rename": {
            working[op.to] = working[op.from];
            delete working[op.from];
            break;
          }
          case "template": {
            working[op.key] = renderTemplate(op.template, working);
            break;
          }
        }
      }

      emitPipeActionEvent(ctx, "transform", {
        ops: parsed.operations.length,
      });
      pipeLog(`transform stub applied ${parsed.operations.length} ops`);
      return { ok: true as const, payload: working };
    },
  },
];
