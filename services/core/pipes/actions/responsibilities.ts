/**
 * Responsibilities actions — contract stub.
 * TODO(stream-4): integrate with `services/core/responsibilities/`.
 */

import { z } from "zod";
import type { ActionDef } from "../types.js";
import { emitPipeActionEvent, pipeLog } from "../voice.js";

const input = z.object({}).passthrough();

const output = z.object({
  ok: z.literal(true),
  generated: z.number().int().nonnegative(),
  stub: z.literal(true),
});

export const responsibilityActions: readonly ActionDef[] = [
  {
    name: "responsibilities:generate_due_tasks",
    context: "responsibilities",
    label: "Generate Due Tasks",
    description: "Generate tasks from due responsibilities",
    inputSchema: input,
    outputSchema: output,
    handler: async (_raw, ctx) => {
      emitPipeActionEvent(ctx, "responsibilities:generate_due_tasks", {});
      pipeLog(`action responsibilities:generate_due_tasks stub fired`);
      return { ok: true as const, generated: 0, stub: true as const };
    },
  },
];
