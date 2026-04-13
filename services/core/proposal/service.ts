import {
  coreProposalSchema,
  createCoreProposalFixture,
  type CreateProposalInput,
  reviseCoreProposalInputSchema,
  type CoreIntent,
  type CoreProposal,
  type Intent,
  type ListProposalFilter,
  type ReviseCoreProposalInput,
  type StartProposalExecutionInput,
} from "@ema/shared/schemas";
import { getDb } from "../../persistence/db.js";
import {
  createExecutionFromProposal,
  type ExecutionRecord,
} from "../executions/executions.service.js";
import { getIntent as getRuntimeIntent } from "../intents/service.js";
import { intentService as bootstrapIntentService } from "../intent/service.js";
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

export class ProposalIntentNotFoundError extends Error {
  public readonly code = "proposal_intent_not_found";

  constructor(public readonly intentId: string) {
    super(`Proposal intent not found: ${intentId}`);
    this.name = "ProposalIntentNotFoundError";
  }
}

export class ProposalIntentNotRunnableError extends Error {
  public readonly code = "proposal_intent_not_runnable";

  constructor(public readonly intentId: string) {
    super(`Proposal intent is not available in the active runtime: ${intentId}`);
    this.name = "ProposalIntentNotRunnableError";
  }
}

interface ResolvedProposalIntent {
  id: string;
  title: string;
  description: string;
  scope: string[];
  generatedByActorId: string;
  spaceId: string | null;
  source: "runtime" | "bootstrap";
  metadata: Record<string, unknown>;
  insertedAt: string;
  updatedAt: string;
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
    parent_proposal_id:
      typeof row.parent_proposal_id === "string" ? row.parent_proposal_id : null,
    generated_by_actor_id: String(row.generated_by_actor_id),
    approved_by_actor_id:
      typeof row.approved_by_actor_id === "string" ? row.approved_by_actor_id : null,
    rejected_by_actor_id:
      typeof row.rejected_by_actor_id === "string" ? row.rejected_by_actor_id : null,
    rejection_reason:
      typeof row.rejection_reason === "string" ? row.rejection_reason : null,
    metadata: decode<Record<string, unknown>>(row.metadata_json, {}),
  });
}

function buildSearchText(intent: Pick<ResolvedProposalIntent, "title" | "description" | "scope">): string {
  return [intent.title, intent.description, ...intent.scope].join(" ").toLowerCase();
}

function mapRuntimeIntentStatusToLoop(status: Intent["status"]): CoreIntent["status"] {
  switch (status) {
    case "draft":
      return "draft";
    case "completed":
      return "completed";
    case "abandoned":
      return "archived";
    case "paused":
    case "active":
    default:
      return "active";
  }
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

function resolveRuntimeIntent(intent: Intent): ResolvedProposalIntent {
  return {
    id: intent.id,
    title: intent.title,
    description: intent.description ?? "",
    scope: intent.scope ?? [],
    generatedByActorId: intent.actor_id ?? "actor_system",
    spaceId: intent.space_id ?? null,
    source: "runtime",
    metadata: {
      intent_level: intent.level,
      intent_kind: intent.kind ?? null,
      intent_status: intent.status,
    },
    insertedAt: intent.inserted_at,
    updatedAt: intent.updated_at,
  };
}

function resolveBootstrapIntent(intent: CoreIntent): ResolvedProposalIntent {
  return {
    id: intent.id,
    title: intent.title,
    description: intent.description,
    scope: intent.scope,
    generatedByActorId: intent.requested_by_actor_id,
    spaceId: null,
    source: "bootstrap",
    metadata: {
      intent_priority: intent.priority,
      intent_source: intent.source,
      constraints: intent.constraints,
    },
    insertedAt: intent.inserted_at,
    updatedAt: intent.updated_at,
  };
}

function ensureLoopIntentMirror(intent: ResolvedProposalIntent): void {
  if (intent.source !== "runtime") return;

  const db = getDb();
  const existing = db.prepare("SELECT id FROM loop_intents WHERE id = ?").get(intent.id) as
    | { id: string }
    | undefined;
  if (existing) return;

  db.prepare(
    `INSERT INTO loop_intents (
       id, title, description, source, status, priority,
       requested_by_actor_id, scope_json, constraints_json, search_text,
       metadata_json, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    intent.id,
    intent.title,
    intent.description,
    "system",
    mapRuntimeIntentStatusToLoop(intent.metadata.intent_status as Intent["status"] ?? "active"),
    "medium",
    intent.generatedByActorId,
    encode(intent.scope),
    encode([]),
    buildSearchText(intent),
    encode({ ...intent.metadata, mirrored_from_runtime_intents: true }),
    intent.insertedAt,
    intent.updatedAt,
  );
}

function resolveIntent(intentId: string): ResolvedProposalIntent {
  const runtimeIntent = getRuntimeIntent(intentId);
  if (runtimeIntent) {
    return resolveRuntimeIntent(runtimeIntent);
  }

  const bootstrapIntent = bootstrapIntentService.get(intentId);
  if (bootstrapIntent) {
    return resolveBootstrapIntent(bootstrapIntent);
  }

  throw new ProposalIntentNotFoundError(intentId);
}

export class ProposalService {
  generate(
    intentId: string,
    options: Omit<CreateProposalInput, "intent_id"> = {},
  ): CoreProposal {
    runLoopMigrations();
    const intent = resolveIntent(intentId);
    ensureLoopIntentMirror(intent);

    const proposal = createCoreProposalFixture({
      intent_id: intent.id,
      title: options.title ?? `Proposal: ${intent.title}`,
      summary: options.summary ?? `Actionable plan for intent ${intent.id}`,
      rationale:
        options.rationale ??
        `Derived from intent scope and constraints for ${intent.title}.`,
      plan_steps: options.plan_steps ?? defaultPlanSteps(intent.scope),
      generated_by_actor_id:
        options.generated_by_actor_id ?? intent.generatedByActorId,
      metadata: {
        ...intent.metadata,
        ...(options.metadata ?? {}),
        proposal_source: intent.source,
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
      payload: {
        intent_id: proposal.intent_id,
        revision: proposal.revision,
        source: intent.source,
      },
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

  list(filter: ListProposalFilter = {}): CoreProposal[] {
    runLoopMigrations();
    const db = getDb();
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filter.status) {
      clauses.push("status = ?");
      params.push(filter.status);
    }
    if (filter.intent_id) {
      clauses.push("intent_id = ?");
      params.push(filter.intent_id);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db.prepare(
      `SELECT * FROM loop_proposals ${whereSql} ORDER BY created_at DESC, updated_at DESC`,
    ).all(...params) as Array<Record<string, unknown>>;

    return rows.map((row) => mapRow(row)).filter((row): row is CoreProposal => row !== null);
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

  startExecution(id: string, input: StartProposalExecutionInput = {}): ExecutionRecord {
    runLoopMigrations();
    const proposal = this.get(id);
    if (!proposal) throw new ProposalNotFoundError(id);
    if (proposal.status !== "approved") {
      throw new ProposalStateError(`Proposal ${id} must be approved before execution starts`);
    }

    const runtimeIntent = getRuntimeIntent(proposal.intent_id);
    if (!runtimeIntent) {
      throw new ProposalIntentNotRunnableError(proposal.intent_id);
    }

    const execution = createExecutionFromProposal({
      proposal_id: proposal.id,
      intent_slug: runtimeIntent.id,
      title: input.title ?? proposal.title,
      objective: input.objective ?? proposal.summary,
      mode: input.mode ?? "implement",
      requires_approval: input.requires_approval ?? false,
      project_slug: input.project_slug ?? null,
      space_id: input.space_id ?? (runtimeIntent.space_id ?? null),
    });

    emitLoopEvent({
      type: "execution.started",
      entity_id: execution.id,
      entity_type: "execution",
      payload: {
        proposal_id: proposal.id,
        intent_id: proposal.intent_id,
        source: "proposal_service",
      },
    });

    return execution;
  }
}

export const proposalService = new ProposalService();
