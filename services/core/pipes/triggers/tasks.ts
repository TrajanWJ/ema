/**
 * Task triggers — ported from `Ema.Pipes.Registry` stock_triggers/0.
 */

import { z } from "zod";
import type { TriggerDef } from "../types.js";

const taskSchema = z
  .object({
    task_id: z.string().optional(),
    title: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const taskTriggers: readonly TriggerDef[] = [
  {
    name: "tasks:created",
    context: "tasks",
    eventType: "created",
    label: "Task Created",
    description: "New task from any source",
    payloadSchema: taskSchema,
  },
  {
    name: "tasks:status_changed",
    context: "tasks",
    eventType: "status_changed",
    label: "Task Status Changed",
    description: "Task status transition",
    payloadSchema: taskSchema,
  },
  {
    name: "tasks:completed",
    context: "tasks",
    eventType: "completed",
    label: "Task Completed",
    description: "Task marked done",
    payloadSchema: taskSchema,
  },
];
