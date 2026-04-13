import { z } from "zod";

import { baseEntitySchema } from "./common.js";

export const actorRoleSchema = z.enum([
  "owner",
  "operator",
  "reviewer",
  "planner",
  "executor",
]);

const actorBaseSchema = baseEntitySchema.extend({
  name: z.string().min(1),
  role: actorRoleSchema,
  metadata: z.record(z.unknown()),
});

export const humanActorSchema = actorBaseSchema.extend({
  kind: z.literal("human"),
  email: z.string().email().nullable(),
});

export const agentActorSchema = actorBaseSchema.extend({
  kind: z.literal("agent"),
  runtime: z.enum(["codex", "claude", "local", "system"]),
  model: z.string().min(1),
  capability_scopes: z.array(z.string().min(1)),
});

export const actorSchema = z.discriminatedUnion("kind", [
  humanActorSchema,
  agentActorSchema,
]);

export type ActorRole = z.infer<typeof actorRoleSchema>;
export type HumanActor = z.infer<typeof humanActorSchema>;
export type AgentActor = z.infer<typeof agentActorSchema>;
export type Actor = z.infer<typeof actorSchema>;

function mintId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createHumanActorFixture(
  overrides: Partial<HumanActor> = {},
): HumanActor {
  const now = nowIso();
  return humanActorSchema.parse({
    id: overrides.id ?? mintId("actor"),
    inserted_at: overrides.inserted_at ?? now,
    updated_at: overrides.updated_at ?? now,
    kind: "human",
    name: overrides.name ?? "EMA Owner",
    role: overrides.role ?? "owner",
    email: overrides.email ?? "owner@example.com",
    metadata: overrides.metadata ?? {},
  });
}

export function createAgentActorFixture(
  overrides: Partial<AgentActor> = {},
): AgentActor {
  const now = nowIso();
  return agentActorSchema.parse({
    id: overrides.id ?? mintId("actor"),
    inserted_at: overrides.inserted_at ?? now,
    updated_at: overrides.updated_at ?? now,
    kind: "agent",
    name: overrides.name ?? "EMA Bootstrap Agent",
    role: overrides.role ?? "executor",
    runtime: overrides.runtime ?? "system",
    model: overrides.model ?? "gpt-5.4",
    capability_scopes: overrides.capability_scopes ?? ["code", "docs", "tests"],
    metadata: overrides.metadata ?? {},
  });
}

export const actorExamples = [
  createHumanActorFixture(),
  createAgentActorFixture(),
];
