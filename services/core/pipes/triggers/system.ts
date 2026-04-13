/**
 * System triggers — ported from `Ema.Pipes.Registry` stock_triggers/0.
 *
 * `system:daemon_started` fires once at boot; `system:daily` and
 * `system:weekly` are cron ticks installed by the worker runtime.
 */

import { z } from "zod";
import type { TriggerDef } from "../types.js";

const systemSchema = z
  .object({
    at: z.string().optional(),
  })
  .passthrough();

export const systemTriggers: readonly TriggerDef[] = [
  {
    name: "system:daemon_started",
    context: "system",
    eventType: "daemon_started",
    label: "Daemon Started",
    description: "Daemon boot",
    payloadSchema: systemSchema,
  },
  {
    name: "system:daily",
    context: "system",
    eventType: "daily",
    label: "Daily Tick",
    description: "Fires once per day",
    payloadSchema: systemSchema,
  },
  {
    name: "system:weekly",
    context: "system",
    eventType: "weekly",
    label: "Weekly Tick",
    description: "Fires once per week",
    payloadSchema: systemSchema,
  },
];
