import { EventEmitter } from "node:events";

import {
  createEventFixture,
  emaEventSchema,
} from "@ema/shared/schemas";
import type { LoopEvent, LoopEventType } from "@ema/shared/schemas/events";
import { getDb } from "../../persistence/db.js";
import { runLoopMigrations } from "./migrations.js";

export const loopEvents = new EventEmitter();

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

export function emitLoopEvent(input: {
  type: LoopEventType;
  entity_id: string;
  entity_type: LoopEvent["entity_type"];
  payload: Record<string, unknown>;
}): LoopEvent {
  runLoopMigrations();
  const db = getDb();
  const event = emaEventSchema.parse(
    createEventFixture({
      type: input.type,
      entity_id: input.entity_id,
      entity_type: input.entity_type,
      payload: input.payload,
    }),
  );

  db.prepare(
    `INSERT INTO loop_events (
       id, event_type, entity_id, entity_type, occurred_at, payload_json
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    event.id,
    event.type,
    event.entity_id,
    event.entity_type,
    event.occurred_at,
    encode(event.payload),
  );

  loopEvents.emit(event.type, event);
  loopEvents.emit("event", event);
  return event;
}

export function listLoopEvents(): LoopEvent[] {
  runLoopMigrations();
  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM loop_events ORDER BY occurred_at ASC`,
  ).all() as Array<Record<string, unknown>>;

  return rows.map((row) =>
    emaEventSchema.parse({
      id: String(row.id),
      type: row.event_type,
      entity_id: String(row.entity_id),
      entity_type: row.entity_type,
      occurred_at: String(row.occurred_at),
      payload: decode<Record<string, unknown>>(row.payload_json, {}),
    }),
  );
}
