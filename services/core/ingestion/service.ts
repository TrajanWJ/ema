import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join } from "node:path";

import type {
  ChronicleSourceKind,
  CreateChronicleImportInput,
} from "@ema/shared/schemas";

export interface IngestionAgentConfigSummary {
  agent: string;
  path: string;
  sessions: number;
  projects: string[];
  first_activity: string | null;
  last_activity: string | null;
}

export interface IngestionTimelineEntry {
  timestamp: string | null;
  agent: string;
  session_path: string;
  project: string | null;
  message_count: number;
  opening_prompt: string;
}

export interface IngestionBackfeedProposal {
  title: string;
  summary: string;
  source_session: string;
  source: "agent_session_import";
}

export interface BuildChronicleImportFromFileInput {
  path: string;
  agent?: string;
  source_kind?: ChronicleSourceKind;
  source_label?: string;
}

function candidateRoots(repoRoot: string): Array<{ agent: string; path: string }> {
  return [
    { agent: "claude", path: join(homedir(), ".claude") },
    { agent: "codex", path: join(homedir(), ".codex") },
    { agent: "cursor", path: join(homedir(), ".cursor") },
    { agent: "superpowers", path: join(homedir(), ".superpowers") },
    { agent: "superman", path: join(homedir(), ".superman") },
    { agent: "windsurf", path: join(homedir(), ".windsurf") },
    { agent: "claude", path: join(repoRoot, ".claude") },
    { agent: "superpowers", path: join(repoRoot, ".superpowers") },
    { agent: "superman", path: join(repoRoot, ".superman") },
  ];
}

export function discoverAgentConfigs(
  repoRoot: string = process.cwd(),
): IngestionAgentConfigSummary[] {
  return candidateRoots(repoRoot)
    .filter((candidate) => existsSync(candidate.path))
    .map((candidate) => summariseAgentConfig(candidate.agent, candidate.path));
}

export function parseSessionTimeline(input: {
  agent?: string;
  repoRoot?: string;
} = {}): IngestionTimelineEntry[] {
  const configs = discoverAgentConfigs(input.repoRoot)
    .filter((config) => input.agent === undefined || config.agent === input.agent);
  const entries: IngestionTimelineEntry[] = [];

  for (const config of configs) {
    if (config.agent === "codex") {
      entries.push(...parseJsonlSessions(config.path, "codex"));
    } else if (config.agent === "claude") {
      entries.push(...parseJsonlSessions(config.path, "claude"));
    }
  }

  return entries.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
}

export function generateBackfeed(input: {
  agent?: string;
  repoRoot?: string;
} = {}): {
  timeline: IngestionTimelineEntry[];
  proposals: IngestionBackfeedProposal[];
  counts: {
    sessions: number;
    proposals: number;
  };
} {
  const timeline = parseSessionTimeline(input).slice(0, 200);
  const proposals = timeline
    .filter((entry) => entry.opening_prompt.trim().length > 20)
    .slice(0, 10)
    .map((entry) => ({
      title: titleFromPrompt(entry.opening_prompt),
      summary: entry.opening_prompt,
      source_session: entry.session_path,
      source: "agent_session_import" as const,
    }));

  return {
    timeline,
    proposals,
    counts: {
      sessions: timeline.length,
      proposals: proposals.length,
    },
  };
}

export function getIngestionStatus(repoRoot: string = process.cwd()): {
  configs: IngestionAgentConfigSummary[];
  session_count: number;
  latest_session: IngestionTimelineEntry | null;
} {
  const configs = discoverAgentConfigs(repoRoot);
  const timeline = parseSessionTimeline({ repoRoot });
  return {
    configs,
    session_count: timeline.length,
    latest_session: timeline[0] ?? null,
  };
}

export function buildChronicleImportFromFile(
  input: BuildChronicleImportFromFileInput,
): CreateChronicleImportInput {
  const raw = safeRead(input.path);
  if (!raw) {
    throw new Error(`ingestion_source_not_found ${input.path}`);
  }

  const sourceKind = input.source_kind ?? inferSourceKind(input.path, input.agent);
  const sourceLabel = input.source_label ?? `${sourceKind}:${projectFromPath(input.path) ?? basename(input.path)}`;
  const stamp = fileTimestamp(input.path);
  const format = extname(input.path).toLowerCase();

  if (format === ".md") {
    const content = raw.trim();
    return {
      source: {
        kind: sourceKind,
        label: sourceLabel,
        provenance_root: dirname(input.path),
      },
      session: {
        title: titleFromPrompt(content || basename(input.path)),
        summary: content.slice(0, 240) || null,
        project_hint: projectFromPath(input.path),
        started_at: stamp,
        ended_at: stamp,
        provenance_path: input.path,
        metadata: {},
        entries: [
          {
            occurred_at: stamp,
            role: "user",
            kind: "note",
            content,
            metadata: { imported_from: input.path, format: "markdown" },
          },
        ],
        raw_payload: {
          path: input.path,
          format: "markdown",
        },
        artifacts: [],
      },
    };
  }

  const rows = format === ".json"
    ? parseJsonEntries(raw)
    : parseJsonlEntries(raw);
  const entries = rows
    .map((row) => recordToChronicleEntry(row, stamp))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const title = titleFromPrompt(
    entries.find((entry) => entry.role === "user")?.content
    ?? entries[0]?.content
    ?? basename(input.path),
  );
  const startedAt = entries.find((entry) => entry.occurred_at)?.occurred_at ?? stamp;
  const endedAt = [...entries].reverse().find((entry) => entry.occurred_at)?.occurred_at ?? stamp;

  return {
    source: {
      kind: sourceKind,
      label: sourceLabel,
      provenance_root: dirname(input.path),
    },
    session: {
      title,
      summary: entries[0]?.content.slice(0, 240) ?? null,
      project_hint: projectFromPath(input.path),
      started_at: startedAt,
      ended_at: endedAt,
      provenance_path: input.path,
      metadata: {},
      entries,
      artifacts: [],
      raw_payload: {
        path: input.path,
        format: format === ".json" ? "json" : "jsonl",
      },
    },
  };
}

function summariseAgentConfig(
  agent: string,
  path: string,
): IngestionAgentConfigSummary {
  const timestamps: string[] = [];
  const projects = new Set<string>();
  let sessions = 0;

  for (const file of walkFiles(path)) {
    if (!looksLikeSession(file)) continue;
    sessions += 1;
    const stamp = fileTimestamp(file);
    if (stamp) timestamps.push(stamp);
    const project = projectFromPath(file);
    if (project) projects.add(project);
  }

  timestamps.sort();
  return {
    agent,
    path,
    sessions,
    projects: [...projects],
    first_activity: timestamps[0] ?? null,
    last_activity: timestamps[timestamps.length - 1] ?? null,
  };
}

function parseJsonlSessions(
  root: string,
  agent: "claude" | "codex",
): IngestionTimelineEntry[] {
  const entries: IngestionTimelineEntry[] = [];
  for (const file of walkFiles(root)) {
    if (!file.endsWith(".jsonl")) continue;
    const raw = safeRead(file);
    if (!raw) continue;
    const lines = raw.split("\n").filter(Boolean);
    if (agent === "codex" && basename(file) === "history.jsonl") {
      const firstBySession = new Map<string, Record<string, unknown>>();
      for (const line of lines) {
        const row = safeJson(line);
        if (!isRecord(row)) continue;
        const sessionId = typeof row.session_id === "string" ? row.session_id : "";
        if (!sessionId || firstBySession.has(sessionId)) continue;
        firstBySession.set(sessionId, row);
      }
      for (const row of firstBySession.values()) {
        const openingPrompt = extractText(row);
        if (!openingPrompt) continue;
        entries.push({
          timestamp:
            typeof row.ts === "number"
              ? new Date(row.ts * 1000).toISOString()
              : fileTimestamp(file),
          agent,
          session_path: file,
          project: projectFromPath(file),
          message_count: lines.length,
          opening_prompt: openingPrompt,
        });
      }
      continue;
    }
    const openingPrompt = extractOpeningPrompt(lines);
    if (!openingPrompt) continue;
    entries.push({
      timestamp: fileTimestamp(file),
      agent,
      session_path: file,
      project: projectFromPath(file),
      message_count: lines.length,
      opening_prompt: openingPrompt,
    });
  }
  return entries;
}

function extractOpeningPrompt(lines: string[]): string | null {
  for (const line of lines) {
    const row = safeJson(line);
    if (!isRecord(row)) continue;
    if (extractRole(row) !== "user") continue;
    const text = extractText(row);
    if (text.trim().length > 0) return text;
  }
  return null;
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".codex" && entry.name !== ".claude") {
      continue;
    }
    const abs = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(abs));
    } else if (entry.isFile()) {
      files.push(abs);
    }
  }
  return files;
}

function looksLikeSession(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".jsonl") || lower.endsWith(".json") || lower.endsWith(".md");
}

function fileTimestamp(path: string): string | null {
  try {
    return statSync(path).mtime.toISOString();
  } catch {
    return null;
  }
}

function projectFromPath(path: string): string | null {
  const parts = path.split("/");
  const projectsIndex = parts.indexOf("projects");
  if (projectsIndex >= 0) {
    return parts[projectsIndex + 1] ?? null;
  }
  return basename(dirname(path)) || null;
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function parseJsonlEntries(raw: string): Record<string, unknown>[] {
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => safeJson(line))
    .filter(isRecord);
}

function parseJsonEntries(raw: string): Record<string, unknown>[] {
  const parsed = safeJson(raw);
  if (Array.isArray(parsed)) return parsed.filter(isRecord);
  if (isRecord(parsed) && Array.isArray(parsed.messages)) {
    return parsed.messages.filter(isRecord);
  }
  if (isRecord(parsed)) return [parsed];
  return [];
}

function inferSourceKind(path: string, agent?: string): ChronicleSourceKind {
  if (agent === "claude" || path.includes("/.claude/")) return "claude";
  if (agent === "codex" || path.includes("/.codex/")) return "codex";
  if (agent === "cursor" || path.includes("/.cursor/")) return "cursor";
  if (path.includes("shell")) return "shell";
  if (path.includes("cli")) return "cli";
  return "import";
}

function extractTimestamp(row: Record<string, unknown>, fallback: string | null): string | null {
  if (typeof row.timestamp === "string") return row.timestamp;
  if (typeof row.created_at === "string") return row.created_at;
  if (typeof row.ts === "number") return new Date(row.ts * 1000).toISOString();
  const message = row.message;
  if (isRecord(message) && typeof message.created_at === "string") {
    return message.created_at;
  }
  return fallback;
}

function normaliseRole(value: string): "user" | "assistant" | "system" | "tool" | "unknown" {
  if (value === "user" || value === "assistant" || value === "system" || value === "tool") {
    return value;
  }
  return "unknown";
}

function recordToChronicleEntry(
  row: Record<string, unknown>,
  fallbackTimestamp: string | null,
): {
  occurred_at: string | null;
  role: "user" | "assistant" | "system" | "tool" | "unknown";
  kind: "message";
  content: string;
  metadata: Record<string, unknown>;
} | null {
  const content = extractText(row).trim();
  if (!content) return null;
  return {
    occurred_at: extractTimestamp(row, fallbackTimestamp),
    role: normaliseRole(extractRole(row)),
    kind: "message",
    content,
    metadata: row,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractRole(row: Record<string, unknown>): string {
  if (typeof row.role === "string") return row.role;
  if (typeof row.text === "string" && typeof row.session_id === "string") {
    return "user";
  }
  const message = row.message;
  if (isRecord(message) && typeof message.role === "string") {
    return message.role;
  }
  return "";
}

function extractText(row: Record<string, unknown>): string {
  if (typeof row.text === "string") return row.text;
  if (typeof row.content === "string") return row.content;
  const message = row.message;
  if (isRecord(message)) {
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .map((entry) => {
          if (!isRecord(entry)) return "";
          return typeof entry.text === "string" ? entry.text : "";
        })
        .filter(Boolean)
        .join("\n");
    }
  }
  return "";
}

function titleFromPrompt(prompt: string): string {
  return (
    prompt.split("\n")[0] ?? "Imported agent session"
  )
    .replace(/^#+\s*/u, "")
    .trim()
    .slice(0, 96) || "Imported agent session";
}
