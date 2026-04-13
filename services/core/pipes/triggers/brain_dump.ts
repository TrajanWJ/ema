/**
 * Brain Dump triggers — ported from `Ema.Pipes.Registry` stock_triggers/0.
 */

import { z } from "zod";
import type { TriggerDef } from "../types.js";

const brainDumpItemSchema = z.object({
  id: z.string().optional(),
  content: z.string().optional(),
  source: z.string().optional(),
}).passthrough();

export const brainDumpTriggers: readonly TriggerDef[] = [
  {
    name: "brain_dump:item_created",
    context: "brain_dump",
    eventType: "item_created",
    label: "Brain Dump Item Created",
    description: "New capture added",
    payloadSchema: brainDumpItemSchema,
  },
  {
    name: "brain_dump:item_processed",
    context: "brain_dump",
    eventType: "item_processed",
    label: "Brain Dump Item Processed",
    description: "Item routed to task/journal/note/archive",
    payloadSchema: brainDumpItemSchema,
  },
];
