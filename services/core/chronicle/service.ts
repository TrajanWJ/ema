import {
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";

import { nanoid } from "nanoid";

import type {
  ChronicleArtifact,
  ChronicleEntry,
  ChronicleSession,
  ChronicleSessionDetail,
  ChronicleSessionSummary,
  ChronicleSource,
  CreateChronicleImportInput,
} from "@ema/shared/schemas";
import {
  chronicleArtifactSchema,
  chronicleEntrySchema,
  chronicleSessionDetailSchema,
  chronicleSessionSchema,
  chronicleSessionSummarySchema,
  chronicleSourceSchema,
  createChronicleImportInputSchema,
} from "@ema/shared/schemas";

import { getDb } from "../../persistence/db.js";
import { applyChronicleDdl } from "./schema.js";

type DbRow = Record<string, unknown>;

let initialised = false;

export interface ListChronicleSessionsFilter {
  source_kind?: string | undefined;
  source_id?: string | undefined;
  limit?: number | undefined;
}

export class ChronicleSessionNotFoundError extends Error {
  public readonly code = "chronicle_session_not_found";
  constructor(public readonly sessionId: string) {
    super(`Chronicle session not found: ${sessionId}`);
    this.name = "ChronicleSessionNotFoundError";
  }
}

export class ChronicleImportError extends Error {
  public readonly code = "chronicle_import_error";
  constructor(message: string) {
    super(message);
    this.name = "ChronicleImportError";
  }
}

export function initChronicle(): void {
  if (initialised) return;
  applyChronicleDdl(getDb());
  mkdirSync(getChronicleRoot(), { recursive: true });
  initialised = true;
}

export function __resetChronicleForTests(): void {
  initialised = false;
}

export function getChronicleRoot(): string {
  const override = process.env.EMA_CHRONICLE_DIR?.trim();
  if (override) return override;
  return join(homedir(), ".local", "share", "ema", "chronicle");
}

function db() {
  initChronicle();
  return getDb();
}

function nowIso(): string {
  return new Date().toISOString();
}

function encode(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function decode<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "source";
}

function chronicleSessionDir(sessionId: string): string {
  return join(getChronicleRoot(), "sessions", sessionId);
}

function ensureChronicleSessionDir(sessionId: string): string {
  const dir = chronicleSessionDir(sessionId);
  mkdirSync(join(dir, "artifacts"), { recursive: true });
  return dir;
}

function storedArtifactName(artifactId: string, name: string, sourcePath?: string | null): string {
  const preferredExt = extname(name) || extname(sourcePath ?? "") || ".txt";
  return `${artifactId}${preferredExt}`;
}

function mapSourceRow(row: DbRow | undefined): ChronicleSource | null {
  if (!row) return null;
  const candidate = {
    id: String(row.id),
    kind: String(row.kind),
    label: String(row.label),
    machine_id: typeof row.machine_id === "string" ? row.machine_id : null,
    provenance_root: typeof row.provenance_root === "string" ? row.provenance_root : null,
    inserted_at: String(row.inserted_at),
    updated_at: String(row.updated_at),
  };
  const parsed = chronicleSourceSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function mapSessionRow(row: DbRow | undefined): ChronicleSession | null {
  if (!row) return null;
  const candidate = {
    id: String(row.id),
    source_id: String(row.source_id),
    external_id: typeof row.external_id === "string" ? row.external_id : null,
    title: String(row.title),
    summary: typeof row.summary === "string" ? row.summary : null,
    project_hint: typeof row.project_hint === "string" ? row.project_hint : null,
    status: String(row.status),
    imported_at: String(row.imported_at),
    started_at: typeof row.started_at === "string" ? row.started_at : null,
    ended_at: typeof row.ended_at === "string" ? row.ended_at : null,
    provenance_path: typeof row.provenance_path === "string" ? row.provenance_path : null,
    raw_path: String(row.raw_path),
    entry_count: typeof row.entry_count === "number" ? row.entry_count : Number(row.entry_count ?? 0),
    artifact_count:
      typeof row.artifact_count === "number" ? row.artifact_count : Number(row.artifact_count ?? 0),
    metadata: decode<Record<string, unknown>>(row.metadata, {}),
    inserted_at: String(row.inserted_at),
    updated_at: String(row.updated_at),
  };
  const parsed = chronicleSessionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function mapEntryRow(row: DbRow | undefined): ChronicleEntry | null {
  if (!row) return null;
  const candidate = {
    id: String(row.id),
    session_id: String(row.session_id),
    external_id: typeof row.external_id === "string" ? row.external_id : null,
    ordinal: typeof row.ordinal === "number" ? row.ordinal : Number(row.ordinal ?? 0),
    occurred_at: typeof row.occurred_at === "string" ? row.occurred_at : null,
    role: String(row.role),
    kind: String(row.kind),
    content: String(row.content),
    metadata: decode<Record<string, unknown>>(row.metadata, {}),
    inserted_at: String(row.inserted_at),
  };
  const parsed = chronicleEntrySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function mapArtifactRow(row: DbRow | undefined): ChronicleArtifact | null {
  if (!row) return null;
  const candidate = {
    id: String(row.id),
    session_id: String(row.session_id),
    entry_id: typeof row.entry_id === "string" ? row.entry_id : null,
    kind: String(row.kind),
    name: String(row.name),
    mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
    stored_path: String(row.stored_path),
    original_path: typeof row.original_path === "string" ? row.original_path : null,
    size_bytes: typeof row.size_bytes === "number" ? row.size_bytes : Number(row.size_bytes ?? 0),
    metadata: decode<Record<string, unknown>>(row.metadata, {}),
    inserted_at: String(row.inserted_at),
  };
  const parsed = chronicleArtifactSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function listChronicleSessions(
  filter: ListChronicleSessionsFilter = {},
): ChronicleSessionSummary[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filter.source_kind) {
    clauses.push("s.kind = ?");
    params.push(filter.source_kind);
  }
  if (filter.source_id) {
    clauses.push("cs.source_id = ?");
    params.push(filter.source_id);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(filter.limit ?? 50, 200));
  const rows = db().prepare(`
    SELECT
      cs.*,
      s.kind AS source_kind,
      s.label AS source_label
    FROM chronicle_sessions cs
    JOIN chronicle_sources s ON s.id = cs.source_id
    ${where}
    ORDER BY COALESCE(cs.started_at, cs.imported_at) DESC, cs.inserted_at DESC
    LIMIT ${limit}
  `).all(...params) as DbRow[];

  return rows.map((row) => chronicleSessionSummarySchema.parse({
    ...(mapSessionRow(row) ?? {}),
    source_kind: String(row.source_kind),
    source_label: String(row.source_label),
  }));
}

export function getChronicleSessionDetail(sessionId: string): ChronicleSessionDetail {
  const row = db().prepare(`
    SELECT
      cs.*,
      s.id AS source_row_id,
      s.kind AS source_kind,
      s.label AS source_label,
      s.machine_id AS source_machine_id,
      s.provenance_root AS source_provenance_root,
      s.inserted_at AS source_inserted_at,
      s.updated_at AS source_updated_at
    FROM chronicle_sessions cs
    JOIN chronicle_sources s ON s.id = cs.source_id
    WHERE cs.id = ?
  `).get(sessionId) as DbRow | undefined;

  if (!row) throw new ChronicleSessionNotFoundError(sessionId);

  const session = mapSessionRow(row);
  const source = mapSourceRow({
    id: row.source_row_id,
    kind: row.source_kind,
    label: row.source_label,
    machine_id: row.source_machine_id,
    provenance_root: row.source_provenance_root,
    inserted_at: row.source_inserted_at,
    updated_at: row.source_updated_at,
  });

  if (!session || !source) {
    throw new ChronicleImportError(`chronicle_corrupt_row ${sessionId}`);
  }

  const entries = db().prepare(`
    SELECT * FROM chronicle_entries
    WHERE session_id = ?
    ORDER BY ordinal ASC, occurred_at ASC, inserted_at ASC
  `).all(sessionId)
    .map((entry) => mapEntryRow(entry as DbRow))
    .filter((entry): entry is ChronicleEntry => entry !== null);

  const artifacts = db().prepare(`
    SELECT * FROM chronicle_artifacts
    WHERE session_id = ?
    ORDER BY inserted_at ASC
  `).all(sessionId)
    .map((artifact) => mapArtifactRow(artifact as DbRow))
    .filter((artifact): artifact is ChronicleArtifact => artifact !== null);

  return chronicleSessionDetailSchema.parse({
    source,
    session,
    entries,
    artifacts,
  });
}

export function importChronicleSession(rawInput: CreateChronicleImportInput): ChronicleSessionDetail {
  const input = createChronicleImportInputSchema.parse(rawInput);
  const handle = db();
  const importedAt = nowIso();
  const sourceId = input.source.id ?? `source_${input.source.kind}_${slugify(input.source.label)}`;
  const sessionId = nanoid();
  const sessionDir = ensureChronicleSessionDir(sessionId);
  const rawPath = join(sessionDir, "raw.json");
  const normalizedPath = join(sessionDir, "normalized.json");
  const status =
    input.session.entries.length > 0 || input.session.artifacts.length > 0
      ? "normalized"
      : "imported";

  writeFileSync(
    rawPath,
    JSON.stringify(
      input.session.raw_payload ?? {
        source: input.source,
        session: input.session,
      },
      null,
      2,
    ),
    "utf8",
  );

  const entries = input.session.entries.map((entry, index) => ({
    id: nanoid(),
    external_id: entry.external_id ?? null,
    ordinal: index,
    occurred_at: entry.occurred_at ?? null,
    role: entry.role,
    kind: entry.kind,
    content: entry.content,
    metadata: entry.metadata ?? {},
    inserted_at: importedAt,
  }));

  const artifacts = input.session.artifacts.map((artifact) => {
    const artifactId = nanoid();
    const filename = storedArtifactName(artifactId, artifact.name, artifact.source_path);
    const storedPath = join(sessionDir, "artifacts", filename);
    if (artifact.source_path) {
      if (!existsSync(artifact.source_path)) {
        throw new ChronicleImportError(`artifact_source_not_found ${artifact.source_path}`);
      }
      copyFileSync(artifact.source_path, storedPath);
    } else {
      writeFileSync(storedPath, artifact.text_content ?? "", "utf8");
    }
    const sizeBytes = statSync(storedPath).size;
    return {
      id: artifactId,
      entry_id:
        typeof artifact.entry_index === "number"
        && artifact.entry_index >= 0
        && artifact.entry_index < entries.length
          ? entries[artifact.entry_index]?.id ?? null
          : null,
      kind: artifact.kind,
      name: artifact.name,
      mime_type: artifact.mime_type ?? null,
      stored_path: storedPath,
      original_path: artifact.source_path ?? null,
      size_bytes: sizeBytes,
      metadata: artifact.metadata ?? {},
      inserted_at: importedAt,
    };
  });

  writeFileSync(
    normalizedPath,
    JSON.stringify(
      {
        source_id: sourceId,
        session_id: sessionId,
        status,
        entries: entries.map((entry) => ({
          external_id: entry.external_id,
          ordinal: entry.ordinal,
          occurred_at: entry.occurred_at,
          role: entry.role,
          kind: entry.kind,
          content: entry.content,
        })),
        artifacts: artifacts.map((artifact) => ({
          kind: artifact.kind,
          name: artifact.name,
          stored_path: artifact.stored_path,
          original_path: artifact.original_path,
          size_bytes: artifact.size_bytes,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );

  const transaction = handle.transaction(() => {
    handle.prepare(`
      INSERT INTO chronicle_sources (
        id, kind, label, machine_id, provenance_root, inserted_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        label = excluded.label,
        machine_id = excluded.machine_id,
        provenance_root = excluded.provenance_root,
        updated_at = excluded.updated_at
    `).run(
      sourceId,
      input.source.kind,
      input.source.label,
      input.source.machine_id ?? null,
      input.source.provenance_root ?? null,
      importedAt,
      importedAt,
    );

    handle.prepare(`
      INSERT INTO chronicle_sessions (
        id, source_id, external_id, title, summary, project_hint, status,
        imported_at, started_at, ended_at, provenance_path, raw_path,
        entry_count, artifact_count, metadata, inserted_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      sourceId,
      input.session.external_id ?? null,
      input.session.title ?? basename(input.session.provenance_path ?? rawPath),
      input.session.summary ?? null,
      input.session.project_hint ?? null,
      status,
      importedAt,
      input.session.started_at ?? null,
      input.session.ended_at ?? null,
      input.session.provenance_path ?? null,
      rawPath,
      entries.length,
      artifacts.length,
      encode(input.session.metadata),
      importedAt,
      importedAt,
    );

    const insertEntry = handle.prepare(`
      INSERT INTO chronicle_entries (
        id, session_id, external_id, ordinal, occurred_at, role, kind, content, metadata, inserted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    entries.forEach((entry) => {
      insertEntry.run(
        entry.id,
        sessionId,
        entry.external_id,
        entry.ordinal,
        entry.occurred_at,
        entry.role,
        entry.kind,
        entry.content,
        encode(entry.metadata),
        entry.inserted_at,
      );
    });

    const insertArtifact = handle.prepare(`
      INSERT INTO chronicle_artifacts (
        id, session_id, entry_id, kind, name, mime_type, stored_path,
        original_path, size_bytes, metadata, inserted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    artifacts.forEach((artifact) => {
      insertArtifact.run(
        artifact.id,
        sessionId,
        artifact.entry_id,
        artifact.kind,
        artifact.name,
        artifact.mime_type,
        artifact.stored_path,
        artifact.original_path,
        artifact.size_bytes,
        encode(artifact.metadata),
        artifact.inserted_at,
      );
    });
  });

  transaction();
  return getChronicleSessionDetail(sessionId);
}
