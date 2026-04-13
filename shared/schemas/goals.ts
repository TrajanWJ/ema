import { z } from "zod";

export const goalTimeframeSchema = z.enum([
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "3year",
]);

export const goalStatusSchema = z.enum([
  "active",
  "completed",
  "archived",
]);

export const goalOwnerKindSchema = z.enum([
  "human",
  "agent",
]);

export const goalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  timeframe: goalTimeframeSchema,
  status: goalStatusSchema,
  owner_kind: goalOwnerKindSchema,
  owner_id: z.string().min(1),
  parent_id: z.string().nullable(),
  project_id: z.string().nullable(),
  space_id: z.string().nullable(),
  intent_slug: z.string().nullable(),
  target_date: z.string().datetime().nullable(),
  success_criteria: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type GoalTimeframe = z.infer<typeof goalTimeframeSchema>;
export type GoalStatus = z.infer<typeof goalStatusSchema>;
export type GoalOwnerKind = z.infer<typeof goalOwnerKindSchema>;
export type Goal = z.infer<typeof goalSchema>;
