import { execFileSync, execSync } from "node:child_process";
import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import {
  arch,
  cpus,
  freemem,
  homedir,
  hostname,
  platform,
  release,
  totalmem,
  uptime,
  userInfo,
} from "node:os";
import { basename, dirname, extname, join } from "node:path";

import type {
  ChronicleSessionDetail,
  ChronicleSourceKind,
  CreateChronicleImportInput,
} from "@ema/shared/schemas";
import { importChronicleSession } from "../chronicle/service.js";

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

export interface IngestionSessionCandidate {
  agent: string;
  path: string;
  source_kind: ChronicleSourceKind;
  source_label: string;
  project: string | null;
  timestamp: string | null;
}

export interface ImportDiscoveredSessionsInput {
  agent?: string;
  repoRoot?: string;
  limit?: number;
  offset?: number;
}

export interface ImportedSessionRecord {
  agent: string;
  path: string;
  session_id: string;
  title: string;
  source_kind: ChronicleSourceKind;
  project_hint: string | null;
}

export interface InstalledCliToolSummary {
  name: string;
  category: "agent_cli" | "support_cli";
  path: string;
  version: string | null;
}

export interface MachineSnapshotSummary {
  machine_id: string;
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  user: string | null;
  shell: string | null;
  repo_root: string;
  current_dir: string;
  node_version: string;
  uptime_seconds: number;
  cpu_model: string | null;
  cpu_count: number;
  total_memory_bytes: number;
  free_memory_bytes: number;
  git_branch: string | null;
  git_head: string | null;
  git_dirty_files: number;
  agent_configs: IngestionAgentConfigSummary[];
  installed_cli_tools: InstalledCliToolSummary[];
  session_candidates: {
    total: number;
    by_agent: Record<string, number>;
  };
  tool_versions: Record<string, string | null>;
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

export function discoverSessionCandidates(
  input: {
    agent?: string;
    repoRoot?: string;
  } = {},
): IngestionSessionCandidate[] {
  const repoRoot = input.repoRoot ?? process.cwd();
  const configs = discoverAgentConfigs(repoRoot)
    .filter((config) => input.agent === undefined || config.agent === input.agent);

  const candidates: IngestionSessionCandidate[] = [];
  for (const config of configs) {
    for (const file of walkFiles(config.path)) {
      if (!looksLikeSession(file)) continue;
      const sourceKind = inferSourceKind(file, config.agent);
      candidates.push({
        agent: config.agent,
        path: file,
        source_kind: sourceKind,
        source_label: `${sourceKind}:${projectFromPath(file) ?? basename(file)}`,
        project: projectFromPath(file),
        timestamp: fileTimestamp(file),
      });
    }
  }

  return dedupeSessionCandidates(candidates)
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
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

export function discoverInstalledCliTools(): InstalledCliToolSummary[] {
  const tools: Array<{ name: string; category: "agent_cli" | "support_cli"; versionArgs: string[] }> = [
    { name: "codex", category: "agent_cli", versionArgs: ["--version"] },
    { name: "claude", category: "agent_cli", versionArgs: ["--version"] },
    { name: "cursor", category: "agent_cli", versionArgs: ["--version"] },
    { name: "windsurf", category: "agent_cli", versionArgs: ["--version"] },
    { name: "opencode", category: "agent_cli", versionArgs: ["--version"] },
    { name: "aider", category: "agent_cli", versionArgs: ["--version"] },
    { name: "gemini", category: "agent_cli", versionArgs: ["--version"] },
    { name: "qwen", category: "agent_cli", versionArgs: ["--version"] },
    { name: "ollama", category: "agent_cli", versionArgs: ["--version"] },
    { name: "git", category: "support_cli", versionArgs: ["--version"] },
    { name: "gh", category: "support_cli", versionArgs: ["--version"] },
    { name: "node", category: "support_cli", versionArgs: ["--version"] },
    { name: "npm", category: "support_cli", versionArgs: ["--version"] },
    { name: "pnpm", category: "support_cli", versionArgs: ["--version"] },
    { name: "python3", category: "support_cli", versionArgs: ["--version"] },
  ];

  return tools
    .map((tool) => {
      const path = findExecutableOnPath(tool.name);
      if (!path) return null;
      return {
        name: tool.name,
        category: tool.category,
        path,
        version: readCommandVersion(path, tool.versionArgs),
      };
    })
    .filter((tool): tool is InstalledCliToolSummary => tool !== null);
}

export function importDiscoveredSessions(
  input: ImportDiscoveredSessionsInput = {},
): {
  imported: ImportedSessionRecord[];
  count: number;
  scanned: number;
  offset: number;
  next_offset: number | null;
  total_candidates: number;
} {
  const candidates = discoverSessionCandidates({
    ...(input.agent !== undefined ? { agent: input.agent } : {}),
    ...(input.repoRoot !== undefined ? { repoRoot: input.repoRoot } : {}),
  });
  const limit = Math.max(1, Math.min(input.limit ?? 50, 5000));
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const selected = candidates.slice(offset, offset + limit);
  const imported: ImportedSessionRecord[] = [];

  for (const candidate of selected) {
    try {
      const detail = importChronicleSession(
        buildChronicleImportFromFile({
          path: candidate.path,
          agent: candidate.agent,
          source_kind: candidate.source_kind,
          source_label: candidate.source_label,
        }),
      );
      imported.push(recordImportedSession(candidate.agent, candidate.path, detail));
    } catch {
      continue;
    }
  }

  return {
    imported,
    count: imported.length,
    scanned: selected.length,
    offset,
    next_offset: offset + selected.length < candidates.length ? offset + selected.length : null,
    total_candidates: candidates.length,
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

  const titleSource = selectPrimaryPrompt(entries) ?? entries[0]?.content ?? basename(input.path);
  const title = titleFromPrompt(titleSource);
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

export function captureMachineSnapshot(
  repoRoot: string = process.cwd(),
): {
  detail: ChronicleSessionDetail;
  snapshot: MachineSnapshotSummary;
} {
  const snapshot = machineSnapshot(repoRoot);
  const detail = importChronicleSession(buildMachineSnapshotImport(snapshot));
  return { detail, snapshot };
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
        const rawRow = safeJson(line);
        const row = isRecord(rawRow) ? normaliseEnvelopeRow(rawRow) : null;
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
    const opening = extractOpeningEvent(lines, fileTimestamp(file));
    if (!opening) continue;
    entries.push({
      timestamp: opening.timestamp,
      agent,
      session_path: file,
      project: projectFromPath(file),
      message_count: lines.length,
      opening_prompt: opening.prompt,
    });
  }
  return entries;
}

function extractOpeningEvent(
  lines: string[],
  fallbackTimestamp: string | null,
): { prompt: string; timestamp: string | null } | null {
  let fallback: { prompt: string; timestamp: string | null } | null = null;
  for (const line of lines) {
    const rawRow = safeJson(line);
    const row = isRecord(rawRow) ? normaliseEnvelopeRow(rawRow) : null;
    if (!isRecord(row)) continue;
    if (extractRole(row) !== "user") continue;
    const text = extractText(row);
    if (text.trim().length > 0) {
      const candidate = {
        prompt: text,
        timestamp: extractTimestamp(row, fallbackTimestamp),
      };
      if (isMeaningfulPrompt(text)) return candidate;
      fallback ??= candidate;
    }
  }
  return fallback;
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
  if (
    lower.includes("/cache/")
    || lower.includes("/telemetry/")
    || lower.includes("/todos/")
    || lower.includes("/facets/")
    || lower.includes("/plugins/")
    || lower.includes("/extensions/")
    || lower.endsWith("/models_cache.json")
  ) {
    return false;
  }

  if (lower.endsWith("history.jsonl")) return true;
  if (lower.includes("/sessions/") && lower.endsWith(".jsonl")) return true;
  if (lower.includes("/projects/") && lower.endsWith(".jsonl")) return true;
  if (lower.includes("/sessions/") && lower.endsWith(".json")) return true;

  if (lower.endsWith(".md")) {
    return /(?:session|transcript|conversation|chat|history|log)\.md$/u.test(lower);
  }

  return false;
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
    .filter(isRecord)
    .map(normaliseEnvelopeRow)
    .filter(isRecord);
}

function parseJsonEntries(raw: string): Record<string, unknown>[] {
  const parsed = safeJson(raw);
  if (Array.isArray(parsed)) return parsed.filter(isRecord);
  if (isRecord(parsed) && Array.isArray(parsed.mapping)) {
    return parsed.mapping.filter(isRecord);
  }
  if (isRecord(parsed) && Array.isArray(parsed.chat_messages)) {
    return parsed.chat_messages.filter(isRecord);
  }
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
  if (agent === "superpowers" || path.includes("/.superpowers/")) return "tool";
  if (agent === "superman" || path.includes("/.superman/")) return "tool";
  if (agent === "windsurf" || path.includes("/.windsurf/")) return "tool";
  if (path.includes("machine") || path.includes("system")) return "system";
  if (path.includes("shell")) return "shell";
  if (path.includes("cli")) return "cli";
  return "import";
}

function extractTimestamp(row: Record<string, unknown>, fallback: string | null): string | null {
  if (typeof row.timestamp === "string") return row.timestamp;
  if (typeof row.created_at === "string") return row.created_at;
  if (typeof row.ts === "number") return new Date(row.ts * 1000).toISOString();
  if (typeof row.occurred_at === "string") return row.occurred_at;
  if (typeof row.observed_at === "string") return row.observed_at;
  const payload = row.payload;
  if (isRecord(payload)) {
    if (typeof payload.timestamp === "string") return payload.timestamp;
    if (typeof payload.created_at === "string") return payload.created_at;
  }
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
  external_id?: string;
  occurred_at: string | null;
  role: "user" | "assistant" | "system" | "tool" | "unknown";
  kind: "message";
  content: string;
  metadata: Record<string, unknown>;
} | null {
  const content = extractText(row).trim();
  if (!content) return null;
  const externalId =
    typeof row.id === "string"
      ? row.id
      : typeof row.uuid === "string"
        ? row.uuid
        : undefined;
  return {
    ...(externalId ? { external_id: externalId } : {}),
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

function normaliseEnvelopeRow(row: Record<string, unknown>): Record<string, unknown> {
  const payload = isRecord(row.payload) ? row.payload : null;
  return payload ? { ...payload, ...row } : row;
}

function extractRole(row: Record<string, unknown>): string {
  if (typeof row.type === "string") {
    if (row.type === "user_message" || row.type === "user") return "user";
    if (
      row.type === "assistant_message"
      || row.type === "assistant"
      || row.type === "commentary"
      || row.type === "final_answer"
    ) {
      return "assistant";
    }
    if (row.type === "system" || row.type === "session_meta") return "system";
  }
  if (typeof row.role === "string") return row.role;
  if (typeof row.author === "string") return row.author;
  const payload = row.payload;
  if (isRecord(payload)) {
    if (typeof payload.role === "string") return payload.role;
    if (typeof payload.author === "string") return payload.author;
    if (typeof payload.type === "string") {
      if (payload.type === "user_message" || payload.type === "user") return "user";
      if (
        payload.type === "assistant_message"
        || payload.type === "assistant"
        || payload.type === "commentary"
        || payload.type === "final_answer"
      ) {
        return "assistant";
      }
    }
  }
  const author = row.author;
  if (isRecord(author) && typeof author.role === "string") return author.role;
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
  if (typeof row.prompt === "string") return row.prompt;
  if (typeof row.message === "string") return row.message;
  const payload = row.payload;
  if (isRecord(payload)) {
    if (typeof payload.text === "string") return payload.text;
    if (typeof payload.content === "string") return payload.content;
    if (typeof payload.prompt === "string") return payload.prompt;
    if (typeof payload.message === "string") return payload.message;
    if (Array.isArray(payload.content)) {
      const combined = payload.content
        .map((entry) => {
          if (typeof entry === "string") return entry;
          if (isRecord(entry) && typeof entry.text === "string") return entry.text;
          return "";
        })
        .filter(Boolean)
        .join("\n");
      if (combined) return combined;
    }
  }
  const parts = row.parts;
  if (Array.isArray(parts)) {
    return parts
      .map((entry) => (typeof entry === "string" ? entry : ""))
      .filter(Boolean)
      .join("\n");
  }
  const message = row.message;
  if (isRecord(message)) {
    if (typeof message.content === "string") return message.content;
    if (typeof message.text === "string") return message.text;
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
  if (typeof row.type === "string" && row.type === "response_item") {
    const responsePayload = row.payload;
    if (isRecord(responsePayload) && Array.isArray(responsePayload.content)) {
      return responsePayload.content
        .map((entry) => {
          if (!isRecord(entry)) return "";
          if (typeof entry.text === "string") return entry.text;
          if (typeof entry.input_text === "string") return entry.input_text;
          if (typeof entry.output_text === "string") return entry.output_text;
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
  }
  return "";
}

function titleFromPrompt(prompt: string): string {
  return (promptTitleLine(prompt) || "Imported agent session")
    .replace(/^#+\s*/u, "")
    .trim()
    .slice(0, 96) || "Imported agent session";
}

function promptTitleLine(prompt: string): string {
  const stripped = prompt
    .trim()
    .replace(/^<environment_context>[\s\S]*?<\/environment_context>\s*/u, "");

  return stripped
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && line !== "```") ?? "";
}

function isMeaningfulPrompt(prompt: string): boolean {
  return promptTitleLine(prompt).length > 0;
}

function selectPrimaryPrompt(
  entries: Array<{ role: string; content: string }>,
): string | null {
  let fallback: string | null = null;
  for (const entry of entries) {
    if (entry.role !== "user") continue;
    const content = entry.content.trim();
    if (!content) continue;
    if (isMeaningfulPrompt(content)) return content;
    fallback ??= content;
  }
  return fallback;
}

function dedupeSessionCandidates(
  candidates: IngestionSessionCandidate[],
): IngestionSessionCandidate[] {
  const seen = new Set<string>();
  const unique: IngestionSessionCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.path)) continue;
    seen.add(candidate.path);
    unique.push(candidate);
  }
  return unique;
}

function recordImportedSession(
  agent: string,
  path: string,
  detail: ChronicleSessionDetail,
): ImportedSessionRecord {
  return {
    agent,
    path,
    session_id: detail.session.id,
    title: detail.session.title,
    source_kind: detail.source.kind,
    project_hint: detail.session.project_hint,
  };
}

function machineSnapshot(repoRoot: string): MachineSnapshotSummary {
  const configs = discoverAgentConfigs(repoRoot);
  const candidates = discoverSessionCandidates({ repoRoot });
  const installedTools = discoverInstalledCliTools();
  const byAgent = candidates.reduce<Record<string, number>>((counts, candidate) => {
    counts[candidate.agent] = (counts[candidate.agent] ?? 0) + 1;
    return counts;
  }, {});

  const toolVersions = installedTools.reduce<Record<string, string | null>>((versions, tool) => {
    versions[tool.name] = tool.version;
    return versions;
  }, {});

  return {
    machine_id: machineIdentity(),
    hostname: hostname(),
    platform: platform(),
    release: release(),
    arch: arch(),
    user: safeUser(),
    shell: process.env.SHELL?.trim() || null,
    repo_root: repoRoot,
    current_dir: process.cwd(),
    node_version: process.version,
    uptime_seconds: Math.floor(uptime()),
    cpu_model: cpus()[0]?.model ?? null,
    cpu_count: cpus().length,
    total_memory_bytes: totalmem(),
    free_memory_bytes: freemem(),
    git_branch: gitOutput(["branch", "--show-current"], repoRoot),
    git_head: gitOutput(["rev-parse", "--short", "HEAD"], repoRoot),
    git_dirty_files: gitDirtyCount(repoRoot),
    agent_configs: configs,
    installed_cli_tools: installedTools,
    session_candidates: {
      total: candidates.length,
      by_agent: byAgent,
    },
    tool_versions: {
      ...toolVersions,
      ...(toolVersions.node ? {} : { node: process.version }),
    },
  };
}

function buildMachineSnapshotImport(snapshot: MachineSnapshotSummary): CreateChronicleImportInput {
  const capturedAt = new Date().toISOString();
  const snapshotPath = join(
    snapshot.repo_root,
    ".ema-machine-snapshots",
    `${capturedAt.replace(/[:.]/g, "-")}.json`,
  );
  const summaryLines = [
    `Machine ${snapshot.hostname} on ${snapshot.platform} ${snapshot.release} (${snapshot.arch})`,
    `User ${snapshot.user ?? "unknown"} with shell ${snapshot.shell ?? "unknown"}`,
    `Repo ${snapshot.repo_root}`,
    `Git ${snapshot.git_branch ?? "detached"} @ ${snapshot.git_head ?? "unknown"} (${snapshot.git_dirty_files} dirty files)`,
    `Discovered ${snapshot.session_candidates.total} session candidates across ${Object.keys(snapshot.session_candidates.by_agent).length} agent roots`,
  ];

  return {
    source: {
      kind: "system",
      label: `machine:${snapshot.hostname}`,
      machine_id: snapshot.machine_id,
      provenance_root: snapshot.repo_root,
    },
    session: {
      external_id: `machine-snapshot:${snapshot.machine_id}:${capturedAt}`,
      title: `Machine snapshot ${snapshot.hostname}`,
      summary: summaryLines.join(" | ").slice(0, 240),
      project_hint: basename(snapshot.repo_root),
      started_at: capturedAt,
      ended_at: capturedAt,
      provenance_path: snapshotPath,
      metadata: {
        capture_kind: "machine_snapshot",
        machine_id: snapshot.machine_id,
        hostname: snapshot.hostname,
        snapshot_path: snapshotPath,
      },
      entries: [
        {
          occurred_at: capturedAt,
          role: "system",
          kind: "event",
          content: summaryLines.join("\n"),
          metadata: snapshot as unknown as Record<string, unknown>,
        },
      ],
      artifacts: [
        {
          name: "machine-snapshot.json",
          kind: "export",
          mime_type: "application/json",
          text_content: JSON.stringify(snapshot, null, 2),
          metadata: {
            captured_at: capturedAt,
            capture_kind: "machine_snapshot",
          },
        },
      ],
      raw_payload: snapshot,
    },
  };
}

function machineIdentity(): string {
  return [hostname(), platform(), arch()].join(":").toLowerCase();
}

function safeUser(): string | null {
  try {
    return userInfo().username;
  } catch {
    return process.env.USER?.trim() || null;
  }
}

function gitOutput(args: string[], cwd: string): string | null {
  try {
    const output = execSync(`git ${args.join(" ")}`, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return output || null;
  } catch {
    return null;
  }
}

function gitDirtyCount(cwd: string): number {
  try {
    const output = execSync("git status --short", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .length;
  } catch {
    return 0;
  }
}

function shellVersion(command: string): string | null {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: "/bin/bash",
    }).trim() || null;
  } catch {
    return null;
  }
}

function findExecutableOnPath(command: string): string | null {
  const pathValue = process.env.PATH ?? "";
  for (const dir of pathValue.split(":")) {
    if (!dir) continue;
    const candidate = join(dir, command);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function readCommandVersion(commandPath: string, versionArgs: string[]): string | null {
  try {
    const output = execFileSync(commandPath, versionArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null;
  } catch {
    return null;
  }
}
