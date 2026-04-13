import { z } from "zod";
import { baseEntitySchema } from "./common.js";

export const projectStatusSchema = z.enum([
  "active",
  "paused",
  "completed",
  "archived",
]);

export const projectSchema = baseEntitySchema.extend({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  icon: z.string().nullable(),
  color: z.string().nullable(),
  path: z.string().nullable(),
  context_docs: z.array(z.string()).nullable(),
});
