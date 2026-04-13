import { z } from "zod";

import { baseEntitySchema, timestampSchema } from "./common.js";

export const coreExecutionStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const coreExecutionSchema = baseEntitySchema.extend({
  proposal_id: z.string().min(1),
  intent_id: z.string().min(1),
  title: z.string().min(1),
  status: coreExecutionStatusSchema,
  started_by_actor_id: z.string().min(1),
  started_at: timestampSchema,
  completed_at: timestampSchema.nullable(),
  result_summary: z.string().min(1).nullable(),
  error_message: z.string().min(1).nullable(),
  metadata: z.record(z.unknown()),
});

export type CoreExecutionStatus = z.infer<typeof coreExecutionStatusSchema>;
export type CoreExecution = z.infer<typeof coreExecutionSchema>;

function mintId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createCoreExecutionFixture(
  overrides: Partial<CoreExecution> = {},
): CoreExecution {
  const now = nowIso();
  return coreExecutionSchema.parse({
    id: overrides.id ?? mintId("execution"),
    inserted_at: overrides.inserted_at ?? now,
    updated_at: overrides.updated_at ?? now,
    proposal_id: overrides.proposal_id ?? "proposal_fixture",
    intent_id: overrides.intent_id ?? "intent_fixture",
    title: overrides.title ?? "Execute the approved proposal",
    status: overrides.status ?? "running",
    started_by_actor_id: overrides.started_by_actor_id ?? "actor_system",
    started_at: overrides.started_at ?? now,
    completed_at: overrides.completed_at ?? null,
    result_summary: overrides.result_summary ?? null,
    error_message: overrides.error_message ?? null,
    metadata: overrides.metadata ?? {},
  });
}

export const coreExecutionExamples = [
  createCoreExecutionFixture(),
  createCoreExecutionFixture({
    intent_id: "intent_audit",
    proposal_id: "proposal_audit",
    title: "Run the EMA repo audit",
    status: "completed",
    completed_at: new Date().toISOString(),
    result_summary: "Ground truth and blueprint documents written.",
  }),
];
