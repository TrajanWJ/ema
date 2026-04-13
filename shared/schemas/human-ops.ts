import { z } from "zod";

import { idSchema, timestampSchema } from "./common.js";

export const humanOpsDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type HumanOpsDate = z.infer<typeof humanOpsDateSchema>;

export const humanOpsDaySchema = z.object({
  date: humanOpsDateSchema,
  plan: z.string(),
  linked_goal_id: idSchema.nullable(),
  now_task_id: idSchema.nullable(),
  pinned_task_ids: z.array(idSchema),
  review_note: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});
export type HumanOpsDay = z.infer<typeof humanOpsDaySchema>;

export const humanOpsDayUpdateSchema = z.object({
  plan: z.string().optional(),
  linked_goal_id: idSchema.nullable().optional(),
  now_task_id: idSchema.nullable().optional(),
  pinned_task_ids: z.array(idSchema).optional(),
  review_note: z.string().optional(),
});
export type HumanOpsDayUpdate = z.infer<typeof humanOpsDayUpdateSchema>;
