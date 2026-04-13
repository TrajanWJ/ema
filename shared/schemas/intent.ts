import { z } from "zod";

import { baseEntitySchema } from "./common.js";

export const coreIntentPrioritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const coreIntentSourceSchema = z.enum(["human", "agent", "system"]);

export const coreIntentStatusSchema = z.enum([
  "draft",
  "active",
  "proposed",
  "executing",
  "completed",
  "rejected",
  "failed",
  "archived",
]);

export const coreIntentSchema = baseEntitySchema.extend({
  title: z.string().min(1),
  description: z.string().min(1),
  source: coreIntentSourceSchema,
  status: coreIntentStatusSchema,
  priority: coreIntentPrioritySchema,
  requested_by_actor_id: z.string().min(1),
  scope: z.array(z.string().min(1)),
  constraints: z.array(z.string().min(1)),
  metadata: z.record(z.unknown()),
});

export type CoreIntentPriority = z.infer<typeof coreIntentPrioritySchema>;
export type CoreIntentSource = z.infer<typeof coreIntentSourceSchema>;
export type CoreIntentStatus = z.infer<typeof coreIntentStatusSchema>;
export type CoreIntent = z.infer<typeof coreIntentSchema>;

export const createCoreIntentInputSchema = coreIntentSchema.omit({
  id: true,
  inserted_at: true,
  updated_at: true,
  status: true,
});

export type CreateCoreIntentInput = z.infer<typeof createCoreIntentInputSchema> & {
  id?: string;
  status?: CoreIntentStatus;
};

function mintId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createCoreIntent(overrides: Partial<CreateCoreIntentInput> = {}): CoreIntent {
  const now = nowIso();
  return coreIntentSchema.parse({
    id: overrides.id ?? mintId("intent"),
    inserted_at: now,
    updated_at: now,
    title: overrides.title ?? "Bootstrap the EMA core loop",
    description:
      overrides.description ??
      "Create a minimal but durable intent that can move through proposal and execution.",
    source: overrides.source ?? "system",
    status: overrides.status ?? "draft",
    priority: overrides.priority ?? "high",
    requested_by_actor_id: overrides.requested_by_actor_id ?? "actor_system",
    scope: overrides.scope ?? ["services/core/**", "shared/schemas/**", "docs/**"],
    constraints: overrides.constraints ?? ["local-first", "typed contracts", "sqlite persistence"],
    metadata: overrides.metadata ?? {},
  });
}

export const coreIntentExamples = [
  createCoreIntent(),
  createCoreIntent({
    title: "Review renderer/service contract drift",
    description: "Audit route/store mismatches and produce a repair intent.",
    source: "human",
    priority: "critical",
    requested_by_actor_id: "actor_human_owner",
    scope: ["apps/renderer/**", "services/core/**", "docs/**"],
  }),
  createCoreIntent({
    title: "Harvest proposal seeds from canon",
    description: "Have an agent collect actionable seeds from ema-genesis and prepare them for review.",
    source: "agent",
    priority: "medium",
    requested_by_actor_id: "actor_agent_canon",
    scope: ["ema-genesis/**", "services/core/proposals/**"],
  }),
];
