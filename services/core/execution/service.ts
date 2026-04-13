import {
  artifactSchema,
  coreExecutionSchema,
  createArtifactFixture,
  createCoreExecutionFixture,
  type Artifact,
  type CoreExecution,
} from "@ema/shared/schemas";
import { getDb } from "../../persistence/db.js";
import { proposalService, ProposalNotFoundError, ProposalStateError } from "../proposal/service.js";
import { emitLoopEvent } from "../loop/events.js";
import { runLoopMigrations } from "../loop/migrations.js";

export interface RecordArtifactInput {
  type: Artifact["type"];
  label: string;
  content: string;
  created_by_actor_id: string;
  path?: string | null;
  mime_type?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CompleteExecutionResult {
  summary: string;
  metadata?: Record<string, unknown>;
}

export class ExecutionNotFoundError extends Error {
  public readonly code = "core_execution_not_found";

  constructor(public readonly id: string) {
    super(`Execution not found: ${id}`);
    this.name = "ExecutionNotFoundError";
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

function mapExecutionRow(row: Record<string, unknown> | undefined): CoreExecution | null {
  if (!row) return null;
  return coreExecutionSchema.parse({
    id: String(row.id),
    inserted_at: String(row.created_at),
    updated_at: String(row.updated_at),
    proposal_id: String(row.proposal_id),
    intent_id: String(row.intent_id),
    title: String(row.title),
    status: row.status,
    started_by_actor_id: String(row.started_by_actor_id),
    started_at: String(row.started_at),
    completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
    result_summary: typeof row.result_summary === "string" ? row.result_summary : null,
    error_message: typeof row.error_message === "string" ? row.error_message : null,
    metadata: decode<Record<string, unknown>>(row.metadata_json, {}),
  });
}

function mapArtifactRow(row: Record<string, unknown>): Artifact {
  return artifactSchema.parse({
    id: String(row.id),
    inserted_at: String(row.created_at),
    updated_at: String(row.updated_at),
    execution_id: String(row.execution_id),
    type: row.type,
    label: String(row.label),
    path: typeof row.path === "string" ? row.path : null,
    mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
    content: String(row.content),
    created_by_actor_id: String(row.created_by_actor_id),
    metadata: decode<Record<string, unknown>>(row.metadata_json, {}),
  });
}

export class ExecutionService {
  start(proposalId: string): CoreExecution {
    runLoopMigrations();
    const proposal = proposalService.get(proposalId);
    if (!proposal) throw new ProposalNotFoundError(proposalId);
    if (proposal.status !== "approved") {
      throw new ProposalStateError(`Proposal ${proposalId} must be approved before execution starts`);
    }

    const execution = createCoreExecutionFixture({
      proposal_id: proposal.id,
      intent_id: proposal.intent_id,
      title: proposal.title,
      started_by_actor_id: proposal.approved_by_actor_id ?? proposal.generated_by_actor_id,
      metadata: {
        proposal_revision: proposal.revision,
      },
    });

    const db = getDb();
    db.prepare(
      `INSERT INTO loop_executions (
         id, proposal_id, intent_id, title, status, started_by_actor_id,
         started_at, completed_at, result_summary, error_message, metadata_json,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      execution.id,
      execution.proposal_id,
      execution.intent_id,
      execution.title,
      execution.status,
      execution.started_by_actor_id,
      execution.started_at,
      execution.completed_at,
      execution.result_summary,
      execution.error_message,
      encode(execution.metadata),
      execution.inserted_at,
      execution.updated_at,
    );

    emitLoopEvent({
      type: "execution.started",
      entity_id: execution.id,
      entity_type: "execution",
      payload: { proposal_id: proposal.id, intent_id: proposal.intent_id },
    });

    return execution;
  }

  get(id: string): CoreExecution | null {
    runLoopMigrations();
    const db = getDb();
    const row = db.prepare("SELECT * FROM loop_executions WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return mapExecutionRow(row);
  }

  recordArtifact(executionId: string, artifact: RecordArtifactInput): void {
    runLoopMigrations();
    const execution = this.get(executionId);
    if (!execution) throw new ExecutionNotFoundError(executionId);

    const row = createArtifactFixture({
      execution_id: executionId,
      type: artifact.type,
      label: artifact.label,
      content: artifact.content,
      created_by_actor_id: artifact.created_by_actor_id,
      path: artifact.path ?? null,
      mime_type: artifact.mime_type ?? null,
      metadata: artifact.metadata ?? {},
    });

    const db = getDb();
    db.prepare(
      `INSERT INTO loop_artifacts (
         id, execution_id, type, label, path, mime_type, content,
         created_by_actor_id, metadata_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id,
      row.execution_id,
      row.type,
      row.label,
      row.path,
      row.mime_type,
      row.content,
      row.created_by_actor_id,
      encode(row.metadata),
      row.inserted_at,
      row.updated_at,
    );

    emitLoopEvent({
      type: "execution.artifact_recorded",
      entity_id: executionId,
      entity_type: "artifact",
      payload: { artifact_id: row.id, label: row.label, type: row.type },
    });
  }

  complete(id: string, result: CompleteExecutionResult): CoreExecution {
    runLoopMigrations();
    const execution = this.get(id);
    if (!execution) throw new ExecutionNotFoundError(id);

    const updatedAt = new Date().toISOString();
    const db = getDb();
    db.prepare(
      `UPDATE loop_executions
          SET status = 'completed', completed_at = ?, result_summary = ?,
              error_message = NULL, metadata_json = ?, updated_at = ?
        WHERE id = ?`,
    ).run(
      updatedAt,
      result.summary,
      encode({ ...execution.metadata, ...(result.metadata ?? {}) }),
      updatedAt,
      id,
    );

    emitLoopEvent({
      type: "execution.completed",
      entity_id: id,
      entity_type: "execution",
      payload: { summary: result.summary },
    });

    const updated = this.get(id);
    if (!updated) throw new ExecutionNotFoundError(id);
    return updated;
  }

  fail(id: string, error: string): CoreExecution {
    runLoopMigrations();
    const execution = this.get(id);
    if (!execution) throw new ExecutionNotFoundError(id);

    const updatedAt = new Date().toISOString();
    const db = getDb();
    db.prepare(
      `UPDATE loop_executions
          SET status = 'failed', completed_at = ?, error_message = ?, updated_at = ?
        WHERE id = ?`,
    ).run(updatedAt, error, updatedAt, id);

    emitLoopEvent({
      type: "execution.failed",
      entity_id: id,
      entity_type: "execution",
      payload: { error },
    });

    const updated = this.get(id);
    if (!updated) throw new ExecutionNotFoundError(id);
    return updated;
  }

  listArtifacts(executionId: string): Artifact[] {
    runLoopMigrations();
    const db = getDb();
    const rows = db.prepare(
      `SELECT * FROM loop_artifacts WHERE execution_id = ? ORDER BY created_at ASC`,
    ).all(executionId) as Array<Record<string, unknown>>;

    return rows.map((row) => mapArtifactRow(row));
  }
}

export const executionService = new ExecutionService();
