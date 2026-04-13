import { z } from "zod";

import { baseEntitySchema } from "./common.js";

/**
 * Active durable proposal contract.
 *
 * This schema backs the real `/api/proposals` lifecycle even though the
 * underlying SQLite table still carries the historical `loop_proposals` name.
 * The old plural `shared/schemas/proposals.ts` surface remains a renderer-era
 * compatibility contract and is not the durable backend source of truth.
 */
export const coreProposalStatusSchema = z.enum([
  "generated",
  "pending_approval",
  "approved",
  "rejected",
  "revised",
  "superseded",
]);

export const coreProposalSchema = baseEntitySchema.extend({
  intent_id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  rationale: z.string().min(1),
  plan_steps: z.array(z.string().min(1)).min(1),
  status: coreProposalStatusSchema,
  revision: z.number().int().positive(),
  parent_proposal_id: z.string().min(1).nullable(),
  generated_by_actor_id: z.string().min(1),
  approved_by_actor_id: z.string().min(1).nullable(),
  rejected_by_actor_id: z.string().min(1).nullable(),
  rejection_reason: z.string().min(1).nullable(),
  metadata: z.record(z.unknown()),
});

export const durableProposalStatusSchema = coreProposalStatusSchema;
export const proposalRecordSchema = coreProposalSchema;

export type CoreProposalStatus = z.infer<typeof coreProposalStatusSchema>;
export type CoreProposal = z.infer<typeof coreProposalSchema>;
export type DurableProposalStatus = CoreProposalStatus;
export type ProposalRecord = CoreProposal;

export const createProposalInputSchema = z.object({
  intent_id: z.string().min(1),
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  rationale: z.string().min(1).optional(),
  plan_steps: z.array(z.string().min(1)).min(1).optional(),
  generated_by_actor_id: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listProposalFilterSchema = z.object({
  status: coreProposalStatusSchema.optional(),
  intent_id: z.string().min(1).optional(),
});

export const approveProposalInputSchema = z.object({
  actor_id: z.string().min(1).default("actor_human_owner"),
});

export const rejectProposalInputSchema = z.object({
  actor_id: z.string().min(1),
  reason: z.string().min(1),
});

export const reviseCoreProposalInputSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  rationale: z.string().min(1).optional(),
  plan_steps: z.array(z.string().min(1)).min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const startProposalExecutionInputSchema = z.object({
  title: z.string().min(1).optional(),
  objective: z.string().nullable().optional(),
  mode: z.string().min(1).optional(),
  requires_approval: z.boolean().optional(),
  project_slug: z.string().min(1).nullable().optional(),
  space_id: z.string().min(1).nullable().optional(),
});

export type CreateProposalInput = z.infer<typeof createProposalInputSchema>;
export type ListProposalFilter = z.infer<typeof listProposalFilterSchema>;
export type ApproveProposalInput = z.infer<typeof approveProposalInputSchema>;
export type RejectProposalInput = z.infer<typeof rejectProposalInputSchema>;
export type ReviseCoreProposalInput = z.infer<typeof reviseCoreProposalInputSchema>;
export type StartProposalExecutionInput = z.infer<typeof startProposalExecutionInputSchema>;

function mintId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createCoreProposalFixture(
  overrides: Partial<CoreProposal> = {},
): CoreProposal {
  const now = nowIso();
  return coreProposalSchema.parse({
    id: overrides.id ?? mintId("proposal"),
    inserted_at: overrides.inserted_at ?? now,
    updated_at: overrides.updated_at ?? now,
    intent_id: overrides.intent_id ?? "intent_fixture",
    title: overrides.title ?? "Implement the requested outcome incrementally",
    summary:
      overrides.summary ??
      "Use the existing system seams first, then add the missing proposal and execution glue.",
    rationale:
      overrides.rationale ??
      "This keeps the rebuild incremental and avoids another rewrite branch.",
    plan_steps: overrides.plan_steps ?? [
      "create the intent record",
      "produce a reviewable proposal",
      "execute the approved change",
    ],
    status: overrides.status ?? "pending_approval",
    revision: overrides.revision ?? 1,
    parent_proposal_id: overrides.parent_proposal_id ?? null,
    generated_by_actor_id: overrides.generated_by_actor_id ?? "actor_system",
    approved_by_actor_id: overrides.approved_by_actor_id ?? null,
    rejected_by_actor_id: overrides.rejected_by_actor_id ?? null,
    rejection_reason: overrides.rejection_reason ?? null,
    metadata: overrides.metadata ?? {},
  });
}

export const coreProposalExamples = [
  createCoreProposalFixture(),
  createCoreProposalFixture({
    intent_id: "intent_renderer_repair",
    title: "Align renderer intent/execution stores with shared contracts",
    summary: "Replace legacy fields and remove drift from the Electron renderer.",
    plan_steps: [
      "catalog mismatched store fields",
      "switch stores to shared schemas",
      "verify routes against services",
    ],
    generated_by_actor_id: "actor_agent_renderer",
  }),
];
