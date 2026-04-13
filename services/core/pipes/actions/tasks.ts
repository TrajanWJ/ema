/**
 * Task actions — contract stubs.
 * TODO(stream-4): integrate with `services/core/tasks/`.
 */

import { z } from "zod";
import type { ActionDef } from "../types.js";
import { emitPipeActionEvent, pipeLog } from "../voice.js";

const createInput = z.object({
  title: z.string().min(1),
  project_id: z.string().optional(),
  priority: z.number().int().optional(),
  source_type: z.string().default("pipe"),
  source_id: z.string().optional(),
});

const createOutput = z.object({
  ok: z.literal(true),
  task_id: z.string(),
  title: z.string(),
  stub: z.literal(true),
});

const transitionInput = z.object({
  task_id: z.string().min(1),
  status: z.string().min(1),
});

const transitionOutput = z.object({
  ok: z.literal(true),
  task_id: z.string(),
  status: z.string(),
  stub: z.literal(true),
});

export const taskActions: readonly ActionDef[] = [
  {
    name: "tasks:create",
    context: "tasks",
    label: "Create Task",
    description: "Create a new task",
    inputSchema: createInput,
    outputSchema: createOutput,
    handler: async (raw, ctx) => {
      const input = createInput.parse(raw);
      const task_id = `task-stub-${ctx.runId.slice(-8)}`;
      emitPipeActionEvent(ctx, "tasks:create", { task_id, title: input.title });
      pipeLog(`action tasks:create stub minted ${task_id}`);
      return {
        ok: true as const,
        task_id,
        title: input.title,
        stub: true as const,
      };
    },
  },
  {
    name: "tasks:transition",
    context: "tasks",
    label: "Transition Task Status",
    description: "Change task status",
    inputSchema: transitionInput,
    outputSchema: transitionOutput,
    handler: async (raw, ctx) => {
      const input = transitionInput.parse(raw);
      emitPipeActionEvent(ctx, "tasks:transition", input);
      pipeLog(
        `action tasks:transition stub moved ${input.task_id} to ${input.status}`,
      );
      return {
        ok: true as const,
        task_id: input.task_id,
        status: input.status,
        stub: true as const,
      };
    },
  },
];
