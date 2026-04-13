import { z } from "zod";

import { actorPhaseSchema } from "./actor-phase.js";
import { goalOwnerKindSchema } from "./goals.js";

export const calendarEntryKindSchema = z.enum([
  "human_commitment",
  "human_focus_block",
  "agent_virtual_block",
  "milestone",
]);

export const calendarEntryStatusSchema = z.enum([
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

export const calendarEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  entry_kind: calendarEntryKindSchema,
  status: calendarEntryStatusSchema,
  owner_kind: goalOwnerKindSchema,
  owner_id: z.string().min(1),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().nullable(),
  phase: actorPhaseSchema.nullable(),
  buildout_id: z.string().nullable(),
  goal_id: z.string().nullable(),
  task_id: z.string().nullable(),
  project_id: z.string().nullable(),
  space_id: z.string().nullable(),
  intent_slug: z.string().nullable(),
  execution_id: z.string().nullable(),
  location: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type CalendarEntryKind = z.infer<typeof calendarEntryKindSchema>;
export type CalendarEntryStatus = z.infer<typeof calendarEntryStatusSchema>;
export type CalendarEntry = z.infer<typeof calendarEntrySchema>;
