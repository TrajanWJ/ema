/**
 * Project triggers — ported from `Ema.Pipes.Registry` stock_triggers/0.
 */

import { z } from "zod";
import type { TriggerDef } from "../types.js";

const projectSchema = z
  .object({
    project_id: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const projectTriggers: readonly TriggerDef[] = [
  {
    name: "projects:created",
    context: "projects",
    eventType: "created",
    label: "Project Created",
    description: "New project",
    payloadSchema: projectSchema,
  },
  {
    name: "projects:status_changed",
    context: "projects",
    eventType: "status_changed",
    label: "Project Status Changed",
    description: "Project lifecycle transition",
    payloadSchema: projectSchema,
  },
];
