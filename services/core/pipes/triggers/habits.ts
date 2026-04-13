/**
 * Habit triggers — ported from `Ema.Pipes.Registry` stock_triggers/0.
 */

import { z } from "zod";
import type { TriggerDef } from "../types.js";

const habitSchema = z
  .object({
    habit_id: z.string().optional(),
    streak: z.number().optional(),
  })
  .passthrough();

export const habitTriggers: readonly TriggerDef[] = [
  {
    name: "habits:completed",
    context: "habits",
    eventType: "completed",
    label: "Habit Completed",
    description: "Habit checked off",
    payloadSchema: habitSchema,
  },
  {
    name: "habits:streak_milestone",
    context: "habits",
    eventType: "streak_milestone",
    label: "Habit Streak Milestone",
    description: "Streak hit 7/30/100",
    payloadSchema: habitSchema,
  },
];
