import { z } from "zod";
import { baseEntitySchema } from "./common.js";

export const brainDumpSourceSchema = z.enum([
  "text",
  "shortcut",
  "clipboard",
  "voice",
  "agent",
]);

export const brainDumpStatusSchema = z.enum([
  "pending",
  "processed",
  "dismissed",
]);

export const inboxItemSchema = baseEntitySchema.extend({
  content: z.string(),
  source: brainDumpSourceSchema,
  status: brainDumpStatusSchema,
  processed_as: z.string().nullable(),
  processed_id: z.string().nullable(),
});
