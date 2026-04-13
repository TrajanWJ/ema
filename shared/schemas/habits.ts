import { z } from "zod";
import { baseEntitySchema, idSchema, timestampSchema } from "./common.js";

export const habitCadenceSchema = z.enum(["daily", "weekly"]);

export const habitSchema = baseEntitySchema.extend({
  name: z.string(),
  description: z.string().nullable(),
  cadence: habitCadenceSchema,
  color: z.string().nullable(),
  archived: z.boolean().default(false),
});

export const habitLogSchema = z.object({
  id: idSchema,
  habit_id: idSchema,
  logged_at: timestampSchema,
  note: z.string().nullable(),
});
