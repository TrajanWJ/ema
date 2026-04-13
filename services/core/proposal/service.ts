import {
  coreProposalSchema,
  createCoreProposalFixture,
  reviseCoreProposalInputSchema,
  type CoreProposal,
  type ReviseCoreProposalInput,
} from "@ema/shared/schemas";
import { getDb } from "../../persistence/db.js";
import { intentService, CoreIntentNotFoundError } from "../intent/service.js";
import { emitLoopEvent } from "../loop/events.js";
import { runLoopMigrations } from "../loop/migrations.js";
import { pipeBus } from "../pipes/bus.js";

export class ProposalNotFoundError extends Error {
  public readonly code = "proposal_not_found";

  constructor(public readonly id: string) {
    super(`Proposal not found: ${id}`);
    this.name = "ProposalNotFoundError";
  }
}

export class ProposalStateError extends Error {
  public readonly code = "proposal_invalid_state";

  constructor(message: string) {
    super(message);
    this.name = "ProposalStateError";
  }
}

function encode(value: unknown): string {
  return JSON.stringify(value);
}

function decode<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapRow(row: Record<string, unknown> | undefined): CoreProposal | null {
  if (!row) return null;
  return coreProposalSchema.parse({
    id: String(row.id),
    inserted_at: String(row.created_at),
    updated_at: String(row.updated_at),
    intent_id: String(row.intent_id),
    title: String(row.title),
    summary: String(row.summary),
    rationale: String(row.rationale),
    plan_steps: decode<string[]>(row.plan_steps_json, []),
    status: row.status,
    revision: Number(row.revision),
    parent_proposal_id: typeof row.parent_proposal_id === "string" ? row.parent_proposal_id : null,
    generated_by_actor_id: String(row.generated_by_actor_id),
    approved_by_actor_id: typeof row.approved_by_actor_id === "string" ? row.approved_by_actor_id : null,
    rejected_by_actor_id: typeof row.rejected_by_actor_id === "string" ? row.rejected_by_actor_id : null,
    rejection_reason: typeof row.rejection_reason === "string" ? row.rejection_reason : null,
    metadata: decode<Record<string, unknown>>(row.metadata_json, {}),
  });
}

function defaultPlanSteps(scope: string[]): string[] {
  if (scope.length === 0) {
    return [
      "clarify the smallest shippable change",
      "implement the change with tests",
      "verify the system state and write artifacts",
    ];
  }

  return [
    `inspect the permitted scope: ${scope.join(", ")}`,
    "implement the requested change inside that scope",
    "run verification and capture artifacts",
  ];
}

export class ProposalService {
  generate(intentId: string): CoreProposal {
    runLoopMigrations();
    const intent = intentService.get(intentId);
    if (!intent) throw new CoreIntentNotFoundError(intentId);

    const proposal = createCoreProposalFixture({
      intent_id: intent.id,
      title: `Proposal: ${intent.title}`,
      summary: `Actionable plan for intent ${intent.id}`,
      rationale: `Derived from intent scope and constraints for ${intent.title}.`,
      plan_steps: defaultPlanSteps(intent.scope),
      generated_by_actor_id: intent.requested_by_actor_id,
      metadata: {
        intent_priority: intent.priority,
        constraints: intent.constraints,
      },
    });

    const db = getDb();
    db.prepare(
      `INSERT INTO loop_proposals (
         id, intent_id, title, summary, rationale, plan_steps_json, status,
         revision, parent_proposal_id, generated_by_actor_id, approved_by_actor_id,
         rejected_by_actor_id, rejection_reason, metadata_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      proposal.id,
      proposal.intent_id,
      proposal.title,
      proposal.summary,
      proposal.rationale,
      encode(proposal.plan_steps),
      proposal.status,
      proposal.revision,
      proposal.parent_proposal_id,
      proposal.generated_by_actor_id,
      proposal.approved_by_actor_id,
      proposal.rejected_by_actor_id,
      proposal.rejection_reason,
      encode(proposal.metadata),
      proposal.inserted_at,
      proposal.updated_at,
    );

    emitLoopEvent({
      type: "proposal.generated",
      entity_id: proposal.id,
      entity_type: "proposal",
      payload: { intent_id: proposal.intent_id, revision: proposal.revision },
    });
    pipeBus.trigger("proposals:generated", {
      proposal_id: proposal.id,
      intent_id: proposal.intent_id,
      revision: proposal.revision,
    });

    return proposal;
  }

  get(id: string): CoreProposal | null {
    runLoopMigrations();
    const db = getDb();
    const row = db.prepare("SELECT * FROM loop_proposals WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return mapRow(row);
  }

  approve(id: string, actorId: string): CoreProposal {
    runLoopMigrations();
    const existing = this.get(id);
    if (!existing) throw new ProposalNotFoundError(id);
    if (!["generated", "pending_approval", "revised"].includes(existing.status)) {
      throw new ProposalStateError(`Proposal ${id} cannot be approved from ${existing.status}`);
    }

    const updatedAt = new Date().toISOString();
    const db = getDb();
    db.prepare(
      `UPDATE loop_proposals
          SET status = 'approved', approved_by_actor_id = ?, rejected_by_actor_id = NULL,
              rejection_reason = NULL, updated_at = ?
        WHERE id = ?`,
    ).run(actorId, updatedAt, id);

    emitLoopEvent({
      type: "proposal.approved",
      entity_id: id,
      entity_type: "proposal",
      payload: { actor_id: actorId },
    });
    pipeBus.trigger("proposals:approved", {
      proposal_id: id,
      actor_id: actorId,
    });

    const updated = this.get(id);
    if (!updated) throw new ProposalNotFoundError(id);
    return updated;
  }

  reject(id: string, actorId: string, reason: string): CoreProposal {
    runLoopMigrations();
    const existing = this.get(id);
    if (!existing) throw new ProposalNotFoundError(id);
    if (existing.status === "approved" || existing.status === "superseded") {
      throw new ProposalStateError(`Proposal ${id} cannot be rejected from ${existing.status}`);
    }

    const updatedAt = new Date().toISOString();
    const db = getDb();
    db.prepare(
      `UPDATE loop_proposals
          SET status = 'rejected', rejected_by_actor_id = ?, rejection_reason = ?, updated_at = ?
        WHERE id = ?`,
    ).run(actorId, reason, updatedAt, id);

    emitLoopEvent({
      type: "proposal.rejected",
      entity_id: id,
      entity_type: "proposal",
      payload: { actor_id: actorId, reason },
    });
    pipeBus.trigger("proposals:killed", {
      proposal_id: id,
      actor_id: actorId,
      reason,
    });

    const updated = this.get(id);
    if (!updated) throw new ProposalNotFoundError(id);
    return updated;
  }

  revise(id: string, changes: ReviseCoreProposalInput): CoreProposal {
    runLoopMigrations();
    const existing = this.get(id);
    if (!existing) throw new ProposalNotFoundError(id);
    const parsed = reviseCoreProposalInputSchema.parse(changes);
    const db = getDb();
    const updatedAt = new Date().toISOString();

    db.prepare(
      `UPDATE loop_proposals SET status = 'superseded', updated_at = ? WHERE id = ?`,
    ).run(updatedAt, id);

    const revised = createCoreProposalFixture({
      intent_id: existing.intent_id,
      title: parsed.title ?? existing.title,
      summary: parsed.summary ?? existing.summary,
      rationale: parsed.rationale ?? existing.rationale,
      plan_steps: parsed.plan_steps ?? existing.plan_steps,
      status: "revised",
      revision: existing.revision + 1,
      parent_proposal_id: existing.id,
      generated_by_actor_id: existing.generated_by_actor_id,
      metadata: {
        ...existing.metadata,
        ...(parsed.metadata ?? {}),
        revised_from: existing.id,
      },
    });

    db.prepare(
      `INSERT INTO loop_proposals (
         id, intent_id, title, summary, rationale, plan_steps_json, status,
         revision, parent_proposal_id, generated_by_actor_id, approved_by_actor_id,
         rejected_by_actor_id, rejection_reason, metadata_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      revised.id,
      revised.intent_id,
      revised.title,
      revised.summary,
      revised.rationale,
      encode(revised.plan_steps),
      revised.status,
      revised.revision,
      revised.parent_proposal_id,
      revised.generated_by_actor_id,
      revised.approved_by_actor_id,
      revised.rejected_by_actor_id,
      revised.rejection_reason,
      encode(revised.metadata),
      revised.inserted_at,
      revised.updated_at,
    );

    emitLoopEvent({
      type: "proposal.revised",
      entity_id: revised.id,
      entity_type: "proposal",
      payload: { parent_proposal_id: existing.id, revision: revised.revision },
    });
    pipeBus.trigger("proposals:redirected", {
      proposal_id: revised.id,
      parent_proposal_id: existing.id,
      revision: revised.revision,
    });

    return revised;
  }
}

export const proposalService = new ProposalService();
