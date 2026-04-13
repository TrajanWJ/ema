import {
  coreIntentSchema,
  createCoreIntent,
  type CoreIntent,
  type CoreIntentPriority,
  type CoreIntentSource,
  type CoreIntentStatus,
  type CreateCoreIntentInput,
} from "@ema/shared/schemas";
import { getDb } from "../../persistence/db.js";
import { emitLoopEvent } from "../loop/events.js";
import { runLoopMigrations } from "../loop/migrations.js";

export interface ListIntentFilter {
  status?: CoreIntentStatus;
  priority?: CoreIntentPriority;
  source?: CoreIntentSource;
  requested_by_actor_id?: string;
}

export class CoreIntentNotFoundError extends Error {
  public readonly code = "core_intent_not_found";

  constructor(public readonly id: string) {
    super(`Core intent not found: ${id}`);
    this.name = "CoreIntentNotFoundError";
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

function buildSearchText(intent: Pick<CoreIntent, "title" | "description" | "scope" | "constraints">): string {
  return [intent.title, intent.description, ...intent.scope, ...intent.constraints]
    .join(" ")
    .toLowerCase();
}

function mapRow(row: Record<string, unknown> | undefined): CoreIntent | null {
  if (!row) return null;
  return coreIntentSchema.parse({
    id: String(row.id),
    inserted_at: String(row.created_at),
    updated_at: String(row.updated_at),
    title: String(row.title),
    description: String(row.description),
    source: row.source,
    status: row.status,
    priority: row.priority,
    requested_by_actor_id: String(row.requested_by_actor_id),
    scope: decode<string[]>(row.scope_json, []),
    constraints: decode<string[]>(row.constraints_json, []),
    metadata: decode<Record<string, unknown>>(row.metadata_json, {}),
  });
}

export class IntentService {
  create(input: CreateCoreIntentInput): CoreIntent {
    runLoopMigrations();
    const db = getDb();
    const intent = createCoreIntent(input);
    const searchText = buildSearchText(intent);

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
      intent.source,
      intent.status,
      intent.priority,
      intent.requested_by_actor_id,
      encode(intent.scope),
      encode(intent.constraints),
      searchText,
      encode(intent.metadata),
      intent.inserted_at,
      intent.updated_at,
    );

    emitLoopEvent({
      type: "intent.created",
      entity_id: intent.id,
      entity_type: "intent",
      payload: { status: intent.status, priority: intent.priority },
    });

    return intent;
  }

  get(id: string): CoreIntent | null {
    runLoopMigrations();
    const db = getDb();
    const row = db.prepare("SELECT * FROM loop_intents WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return mapRow(row);
  }

  list(filter: ListIntentFilter = {}): CoreIntent[] {
    runLoopMigrations();
    const db = getDb();
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filter.status) {
      clauses.push("status = ?");
      params.push(filter.status);
    }
    if (filter.priority) {
      clauses.push("priority = ?");
      params.push(filter.priority);
    }
    if (filter.source) {
      clauses.push("source = ?");
      params.push(filter.source);
    }
    if (filter.requested_by_actor_id) {
      clauses.push("requested_by_actor_id = ?");
      params.push(filter.requested_by_actor_id);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db.prepare(
      `SELECT * FROM loop_intents ${whereSql} ORDER BY created_at DESC`,
    ).all(...params) as Array<Record<string, unknown>>;

    return rows.map((row) => mapRow(row)).filter((row): row is CoreIntent => row !== null);
  }

  updateStatus(id: string, status: CoreIntentStatus): CoreIntent {
    runLoopMigrations();
    const existing = this.get(id);
    if (!existing) throw new CoreIntentNotFoundError(id);

    const updatedAt = new Date().toISOString();
    const db = getDb();
    db.prepare(
      `UPDATE loop_intents SET status = ?, updated_at = ? WHERE id = ?`,
    ).run(status, updatedAt, id);

    emitLoopEvent({
      type: "intent.status_updated",
      entity_id: id,
      entity_type: "intent",
      payload: { from: existing.status, to: status },
    });

    const updated = this.get(id);
    if (!updated) throw new CoreIntentNotFoundError(id);
    return updated;
  }

  index(): void {
    runLoopMigrations();
    const db = getDb();
    const intents = this.list();

    for (const intent of intents) {
      db.prepare(
        `UPDATE loop_intents SET search_text = ? WHERE id = ?`,
      ).run(buildSearchText(intent), intent.id);
      emitLoopEvent({
        type: "intent.indexed",
        entity_id: intent.id,
        entity_type: "intent",
        payload: { search_text_length: buildSearchText(intent).length },
      });
    }
  }
}

export const intentService = new IntentService();
