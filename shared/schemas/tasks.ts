import { z } from "zod";
import { baseEntitySchema, idSchema } from "./common.js";

export const taskStatusSchema = z.enum([
  "proposed",
  "planned",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
]);

export const taskPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const taskEffortSchema = z.enum([
  "trivial",
  "small",
  "medium",
  "large",
  "epic",
]);

export const taskSchema = baseEntitySchema.extend({
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  effort: taskEffortSchema.nullable(),
  project_id: idSchema.nullable(),
  actor_id: idSchema.nullable(),
  source: z.string().nullable(),
  source_id: z.string().nullable(),
  due_date: z.string().nullable(),
  tags: z.array(z.string()),
});
