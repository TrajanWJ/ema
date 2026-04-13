import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import type {
  AgentRuntimeState,
} from "@ema/shared/schemas";

import { classifyRuntimeState } from "../actors/runtime-classifier.js";
import { getDb } from "../../persistence/db.js";
import { applyRuntimeFabricDdl } from "./schema.js";

type RuntimeToolKind =
  | "shell"
  | "claude"
  | "codex"
  | "gemini"
  | "aider"
  | "cursor"
  | "unknown";

type RuntimeToolAuthState = "configured" | "detected" | "unknown";
type RuntimeSessionStatus = "detected" | "starting" | "running" | "idle" | "stopped" | "failed";
type RuntimeInputMode = "paste" | "type" | "key";
type RuntimeSessionEventKind =
  | "session_started"
  | "prompt_dispatched"
  | "input_sent"
  | "key_sent"
  | "state_changed"
  | "session_stopped";

interface RuntimeTool {
  id: string;
  kind: RuntimeToolKind;
  name: string;
  binary_path: string | null;
  version: string | null;
  config_dir: string | null;
  auth_state: RuntimeToolAuthState;
  available: boolean;
  launch_command: string;
  source: "builtin" | "path";
  detected_at: string;
}

interface RuntimeSession {
  id: string;
  session_name: string;
  source: "managed" | "external";
  tool_kind: RuntimeToolKind;
  tool_name: string;
  status: RuntimeSessionStatus;
  runtime_state: AgentRuntimeState | null;
  cwd: string | null;
  command: string;
  pane_id: string | null;
  pid: number | null;
  started_at: string;
  last_seen_at: string;
  last_output_at: string | null;
  last_transition_at: string | null;
  tail_preview: string | null;
  summary: string | null;
}

interface RuntimeSessionScreen {
  session_id: string;
  session_name: string;
  pane_id: string | null;
  captured_at: string;
  line_count: number;
  tail: string;
}

interface RuntimeSessionEvent {
  id: string;
  session_id: string;
  event_kind: RuntimeSessionEventKind;
  summary: string;
  payload_json: string | null;
  inserted_at: string;
}

interface ToolDefinition {
  kind: RuntimeToolKind;
  name: string;
  binaries: readonly string[];
  config_dirs: readonly string[];
}

interface ManagedSessionRow {
  id: string;
  session_name: string;
  source: "managed";
  tool_kind: RuntimeToolKind;
  tool_name: string;
  status: RuntimeSessionStatus;
  runtime_state: AgentRuntimeState | null;
  cwd: string | null;
  command: string;
  pane_id: string | null;
  pid: number | null;
  started_at: string;
  last_seen_at: string;
  last_output_at: string | null;
  last_transition_at: string | null;
  tail_preview: string | null;
  tail_hash: string | null;
  summary: string | null;
}

type PersistedRuntimeSession = RuntimeSession & {
  tail_hash: string | null;
};

interface TmuxPane {
  sessionName: string;
  paneId: string;
  currentCommand: string;
  currentPath: string | null;
  pid: number | null;
  startedAt: string;
}

interface CreateRuntimeSessionInput {
  tool_kind: RuntimeToolKind;
  cwd?: string;
  session_name?: string;
  startup_options?: string[];
  command?: string;
  initial_input?: string;
  simulate_typing?: boolean;
}

interface DispatchPromptInput extends CreateRuntimeSessionInput {
  session_id?: string;
  prompt: string;
}

const BUILTIN_SHELL = process.env["SHELL"] || "/bin/bash";
const SESSION_PREFIX = "ema-runtime";
const SCREEN_LINE_LIMIT = 240;

const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    kind: "shell",
    name: "Shell",
    binaries: [BUILTIN_SHELL],
    config_dirs: [],
  },
  {
    kind: "claude",
    name: "Claude Code",
    binaries: [
      "claude",
      join(homedir(), ".local", "bin", "claude"),
      join(homedir(), ".claude", "bin", "claude"),
    ],
    config_dirs: [
      join(homedir(), ".claude"),
    ],
  },
  {
    kind: "codex",
    name: "Codex",
    binaries: [
      "codex",
      join(homedir(), ".local", "bin", "codex"),
    ],
    config_dirs: [
      join(homedir(), ".codex"),
    ],
  },
  {
    kind: "gemini",
    name: "Gemini CLI",
    binaries: [
      "gemini",
    ],
    config_dirs: [
      join(homedir(), ".gemini"),
    ],
  },
  {
    kind: "aider",
    name: "Aider",
    binaries: [
      "aider",
    ],
    config_dirs: [
      join(homedir(), ".aider"),
    ],
  },
  {
    kind: "cursor",
    name: "Cursor Agent",
    binaries: [
      "cursor-agent",
      "cursor",
    ],
    config_dirs: [
      join(homedir(), ".cursor"),
    ],
  },
] as const;

let initialized = false;

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function ensureInitialized(): void {
  if (initialized) return;
  applyRuntimeFabricDdl(getDb());
  initialized = true;
}

export function __resetRuntimeFabricInit(): void {
  initialized = false;
}

function isCommandPath(candidate: string): boolean {
  return candidate.includes("/") || candidate.includes("\\");
}

function detectBinary(candidate: string): string | null {
  if (isCommandPath(candidate)) {
    return existsSync(candidate) ? candidate : null;
  }

  const result = spawnSync("which", [candidate], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  const found = result.stdout.trim();
  return found.length > 0 ? found : null;
}

function detectVersion(binaryPath: string | null): string | null {
  if (!binaryPath) return null;
  const result = spawnSync(binaryPath, ["--version"], {
    encoding: "utf8",
    timeout: 1_500,
  });
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (!text) return null;
  return text.split(/\r?\n/, 1)[0] ?? null;
}

function firstExistingDir(candidates: readonly string[]): string | null {
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function deriveAuthState(configDir: string | null, available: boolean): RuntimeToolAuthState {
  if (configDir && existsSync(configDir)) {
    try {
      return readdirSync(configDir).length > 0 ? "configured" : "detected";
    } catch {
      return "detected";
    }
  }
  return available ? "detected" : "unknown";
}

function detectTool(definition: ToolDefinition, detectedAt: string): RuntimeTool {
  const binaryPath = definition.binaries
    .map((candidate) => detectBinary(candidate))
    .find((candidate): candidate is string => Boolean(candidate)) ?? null;
  const available = definition.kind === "shell" ? existsSync(BUILTIN_SHELL) : binaryPath !== null;
  const configDir = firstExistingDir(definition.config_dirs);

  return {
    id: `runtime_tool:${definition.kind}`,
    kind: definition.kind,
    name: definition.name,
    binary_path: binaryPath ?? (definition.kind === "shell" ? BUILTIN_SHELL : null),
    version: detectVersion(binaryPath),
    config_dir: configDir,
    auth_state: deriveAuthState(configDir, available),
    available,
    launch_command: binaryPath ?? (definition.kind === "shell" ? BUILTIN_SHELL : definition.binaries[0] ?? definition.kind),
    source: definition.kind === "shell" ? "builtin" : "path",
    detected_at: detectedAt,
  };
}

function persistTools(tools: readonly RuntimeTool[]): void {
  ensureInitialized();
  const db = getDb();
  const statement = db.prepare(`
    INSERT INTO runtime_fabric_tools (
      id, kind, name, binary_path, version, config_dir, auth_state,
      available, launch_command, source, detected_at
    ) VALUES (
      @id, @kind, @name, @binary_path, @version, @config_dir, @auth_state,
      @available, @launch_command, @source, @detected_at
    )
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind,
      name = excluded.name,
      binary_path = excluded.binary_path,
      version = excluded.version,
      config_dir = excluded.config_dir,
      auth_state = excluded.auth_state,
      available = excluded.available,
      launch_command = excluded.launch_command,
      source = excluded.source,
      detected_at = excluded.detected_at
  `);

  const transaction = db.transaction((rows: readonly RuntimeTool[]) => {
    for (const row of rows) {
      statement.run({
        ...row,
        available: row.available ? 1 : 0,
      });
    }
  });
  transaction(tools);
}

export function scanRuntimeTools(): RuntimeTool[] {
  const detectedAt = nowIso();
  const tools = TOOL_DEFINITIONS.map((definition) => detectTool(definition, detectedAt));
  persistTools(tools);
  return tools;
}

export function listRuntimeTools(): RuntimeTool[] {
  ensureInitialized();
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      id, kind, name, binary_path, version, config_dir, auth_state,
      available, launch_command, source, detected_at
    FROM runtime_fabric_tools
    ORDER BY kind ASC
  `).all() as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    return scanRuntimeTools();
  }

  return rows.map((row) => ({
    id: String(row.id),
    kind: row.kind as RuntimeToolKind,
    name: String(row.name),
    binary_path: typeof row.binary_path === "string" ? row.binary_path : null,
    version: typeof row.version === "string" ? row.version : null,
    config_dir: typeof row.config_dir === "string" ? row.config_dir : null,
    auth_state: row.auth_state as RuntimeToolAuthState,
    available: Number(row.available) === 1,
    launch_command: String(row.launch_command),
    source: row.source === "builtin" ? "builtin" : "path",
    detected_at: String(row.detected_at),
  }));
}

function tmuxResult(args: string[], input?: string): ReturnType<typeof spawnSync> {
  return spawnSync("tmux", args, {
    encoding: "utf8",
    input,
  });
}

function resultText(value: string | NodeJS.ArrayBufferView | null | undefined): string {
  if (typeof value === "string") return value;
  if (!value) return "";
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("utf8");
}

function listTmuxPanes(): TmuxPane[] {
  const result = tmuxResult([
    "list-panes",
    "-a",
    "-F",
    "#{session_name}\t#{pane_id}\t#{pane_current_command}\t#{pane_current_path}\t#{pane_pid}\t#{session_created}",
  ]);

  if (result.status !== 0) {
    return [];
  }

  return resultText(result.stdout)
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .map((line) => {
      const [sessionName, paneId, currentCommand, currentPath, pid, created] = line.split("\t");
      const createdMs = Number.parseInt(created ?? "0", 10) * 1000;
      return {
        sessionName: sessionName ?? "",
        paneId: paneId ?? "",
        currentCommand: currentCommand ?? "",
        currentPath: currentPath && currentPath.length > 0 ? currentPath : null,
        pid: Number.isFinite(Number(pid)) ? Number(pid) : null,
        startedAt: createdMs > 0 ? new Date(createdMs).toISOString() : nowIso(),
      } satisfies TmuxPane;
    });
}

function inferToolKind(command: string): RuntimeToolKind {
  const normalized = basename(command).toLowerCase();
  if (normalized.includes("claude")) return "claude";
  if (normalized.includes("codex")) return "codex";
  if (normalized.includes("gemini")) return "gemini";
  if (normalized.includes("aider")) return "aider";
  if (normalized.includes("cursor")) return "cursor";
  if (normalized.includes("bash") || normalized.includes("zsh") || normalized.includes("fish") || normalized.includes("sh")) {
    return "shell";
  }
  return "unknown";
}

function displayToolName(kind: RuntimeToolKind): string {
  return TOOL_DEFINITIONS.find((definition) => definition.kind === kind)?.name ?? "Unknown";
}

function managedRows(): ManagedSessionRow[] {
  ensureInitialized();
  const db = getDb();
  return db.prepare(`
    SELECT
      id, session_name, source, tool_kind, tool_name, status, cwd, command, pane_id,
      pid, started_at, last_seen_at, last_output_at, last_transition_at, runtime_state,
      tail_preview, tail_hash, summary
    FROM runtime_fabric_sessions
    ORDER BY started_at DESC
  `).all() as ManagedSessionRow[];
}

function persistManagedSession(session: PersistedRuntimeSession): void {
  ensureInitialized();
  const db = getDb();
  db.prepare(`
    INSERT INTO runtime_fabric_sessions (
      id, session_name, source, tool_kind, tool_name, status, cwd, command, pane_id,
      pid, started_at, last_seen_at, last_output_at, last_transition_at, runtime_state,
      tail_preview, tail_hash, summary
    ) VALUES (
      @id, @session_name, @source, @tool_kind, @tool_name, @status, @cwd, @command, @pane_id,
      @pid, @started_at, @last_seen_at, @last_output_at, @last_transition_at, @runtime_state,
      @tail_preview, @tail_hash, @summary
    )
    ON CONFLICT(id) DO UPDATE SET
      session_name = excluded.session_name,
      source = excluded.source,
      tool_kind = excluded.tool_kind,
      tool_name = excluded.tool_name,
      status = excluded.status,
      cwd = excluded.cwd,
      command = excluded.command,
      pane_id = excluded.pane_id,
      pid = excluded.pid,
      started_at = excluded.started_at,
      last_seen_at = excluded.last_seen_at,
      last_output_at = excluded.last_output_at,
      last_transition_at = excluded.last_transition_at,
      runtime_state = excluded.runtime_state,
      tail_preview = excluded.tail_preview,
      tail_hash = excluded.tail_hash,
      summary = excluded.summary
  `).run(session);
}

function updateManagedSessionState(
  id: string,
  patch: Partial<Pick<RuntimeSession, "status" | "runtime_state" | "pane_id" | "pid" | "last_seen_at" | "last_output_at" | "last_transition_at" | "tail_preview" | "summary">> & { tail_hash?: string | null },
): void {
  ensureInitialized();
  const db = getDb();
  const current = db.prepare(`
    SELECT
      id, session_name, source, tool_kind, tool_name, status, cwd, command, pane_id,
      pid, started_at, last_seen_at, last_output_at, last_transition_at, runtime_state,
      tail_preview, tail_hash, summary
    FROM runtime_fabric_sessions
    WHERE id = ?
  `).get(id) as ManagedSessionRow | undefined;
  if (!current) return;
  persistManagedSession({
    ...current,
    ...patch,
  });
}

function deleteManagedSession(id: string): void {
  ensureInitialized();
  getDb().prepare(`
    DELETE FROM runtime_fabric_sessions
    WHERE id = ?
  `).run(id);
}

function logRuntimeEvent(input: {
  session_id: string;
  event_kind: RuntimeSessionEventKind;
  summary: string;
  payload?: Record<string, unknown>;
}): RuntimeSessionEvent {
  ensureInitialized();
  const event: RuntimeSessionEvent = {
    id: createId("rte"),
    session_id: input.session_id,
    event_kind: input.event_kind,
    summary: input.summary,
    payload_json: input.payload ? JSON.stringify(input.payload) : null,
    inserted_at: nowIso(),
  };
  getDb().prepare(`
    INSERT INTO runtime_fabric_session_events (
      id, session_id, event_kind, summary, payload_json, inserted_at
    ) VALUES (
      @id, @session_id, @event_kind, @summary, @payload_json, @inserted_at
    )
  `).run(event);
  return event;
}

export function listRuntimeSessionEvents(sessionId: string, limit = 50): RuntimeSessionEvent[] {
  ensureInitialized();
  return getDb().prepare(`
    SELECT
      id, session_id, event_kind, summary, payload_json, inserted_at
    FROM runtime_fabric_session_events
    WHERE session_id = ?
    ORDER BY inserted_at DESC
    LIMIT ?
  `).all(sessionId, Math.max(1, Math.min(limit, 500))) as RuntimeSessionEvent[];
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function sessionNameFor(input: CreateRuntimeSessionInput, id: string): string {
  const requested = input.session_name?.trim();
  const base = requested && requested.length > 0
    ? requested
    : `${SESSION_PREFIX}-${input.tool_kind}-${id.slice(-8)}`;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function resolveTool(kind: RuntimeToolKind): RuntimeTool {
  const tools = listRuntimeTools();
  const tool = tools.find((candidate) => candidate.kind === kind);
  if (!tool) {
    throw new Error(`runtime_tool_unknown ${kind}`);
  }
  if (!tool.available) {
    throw new Error(`runtime_tool_unavailable ${kind}`);
  }
  return tool;
}

function buildCommand(tool: RuntimeTool, input: CreateRuntimeSessionInput): string {
  if (input.command?.trim()) {
    return input.command.trim();
  }

  const launchCommand = /\s/.test(tool.launch_command)
    ? shellEscape(tool.launch_command)
    : tool.launch_command;
  const options = (input.startup_options ?? [])
    .filter((entry) => entry.trim().length > 0)
    .map((entry) => shellEscape(entry))
    .join(" ");

  return [launchCommand, options].filter((part) => part.length > 0).join(" ");
}

function paneForSessionName(sessionName: string): TmuxPane | null {
  return listTmuxPanes().find((pane) => pane.sessionName === sessionName) ?? null;
}

function materializeManagedSession(row: ManagedSessionRow, pane: TmuxPane | null): RuntimeSession {
  const running = pane !== null;
  return {
    id: row.id,
    session_name: row.session_name,
    source: "managed",
    tool_kind: row.tool_kind,
    tool_name: row.tool_name,
    status: running ? "running" : row.status === "failed" ? "failed" : "stopped",
    runtime_state: row.runtime_state,
    cwd: pane?.currentPath ?? row.cwd,
    command: row.command,
    pane_id: pane?.paneId ?? row.pane_id,
    pid: pane?.pid ?? row.pid,
    started_at: row.started_at,
    last_seen_at: running ? nowIso() : row.last_seen_at,
    last_output_at: row.last_output_at,
    last_transition_at: row.last_transition_at,
    tail_preview: row.tail_preview,
    summary: row.summary,
  };
}

function externalId(sessionName: string, paneId: string): string {
  return `external:${sessionName}:${paneId.replace(/^%/, "")}`;
}

function materializeExternalSession(pane: TmuxPane): RuntimeSession {
  const toolKind = inferToolKind(pane.currentCommand);
  const runtimeState = classifySessionState("", pane.startedAt, null);
  return {
    id: externalId(pane.sessionName, pane.paneId),
    session_name: pane.sessionName,
    source: "external",
    tool_kind: toolKind,
    tool_name: displayToolName(toolKind),
    status: "running",
    runtime_state: runtimeState,
    cwd: pane.currentPath,
    command: pane.currentCommand,
    pane_id: pane.paneId,
    pid: pane.pid,
    started_at: pane.startedAt,
    last_seen_at: nowIso(),
    last_output_at: null,
    last_transition_at: null,
    tail_preview: null,
    summary: "Attached to an externally managed tmux session.",
  };
}

function capturePaneTail(target: string, lines = 120): string {
  const result = tmuxResult([
    "capture-pane",
    "-p",
    "-J",
    "-S",
    `-${Math.max(1, Math.min(lines, 1_000))}`,
    "-t",
    target,
  ]);
  if (result.status !== 0) {
    return "";
  }
  return resultText(result.stdout);
}

function hashTail(tail: string): string {
  return createHash("sha1").update(tail).digest("hex");
}

function summarizeTail(tail: string): string | null {
  const preview = tail
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(-3)
    .join(" ")
    .slice(0, 280);
  return preview.length > 0 ? preview : null;
}

function classifySessionState(
  tail: string,
  startedAt: string,
  lastOutputAt: string | null,
): AgentRuntimeState {
  return classifyRuntimeState({
    paneTail: tail,
    processAlive: true,
    lastByteAt: Date.parse(lastOutputAt ?? startedAt),
    now: Date.now(),
    userPaused: false,
  });
}

function statusFromRuntimeState(runtimeState: AgentRuntimeState): RuntimeSessionStatus {
  if (runtimeState === "idle" || runtimeState === "paused") return "idle";
  if (runtimeState === "error" || runtimeState === "crashed") return "failed";
  return "running";
}

function refreshManagedSession(row: ManagedSessionRow, pane: TmuxPane | null): RuntimeSession {
  if (!pane) {
    const stopped = materializeManagedSession(row, null);
    persistManagedSession({
      ...stopped,
      tail_hash: row.tail_hash,
    });
    return stopped;
  }

  const observedAt = nowIso();
  const tail = capturePaneTail(pane.paneId);
  const nextTailHash = hashTail(tail);
  const outputChanged = row.tail_hash !== nextTailHash;
  const nextLastOutputAt = outputChanged ? observedAt : row.last_output_at;
  const nextRuntimeState = classifySessionState(tail, row.started_at, nextLastOutputAt);
  const nextStatus = statusFromRuntimeState(nextRuntimeState);
  const runtimeChanged = row.runtime_state !== nextRuntimeState;
  const nextSession: PersistedRuntimeSession = {
    id: row.id,
    session_name: row.session_name,
    source: "managed",
    tool_kind: row.tool_kind,
    tool_name: row.tool_name,
    status: nextStatus,
    runtime_state: nextRuntimeState,
    cwd: pane.currentPath ?? row.cwd,
    command: row.command,
    pane_id: pane.paneId,
    pid: pane.pid,
    started_at: row.started_at,
    last_seen_at: observedAt,
    last_output_at: nextLastOutputAt,
    last_transition_at: runtimeChanged ? observedAt : row.last_transition_at,
    tail_preview: summarizeTail(tail),
    tail_hash: nextTailHash,
    summary: summarizeTail(tail) ?? row.summary,
  };

  persistManagedSession(nextSession);
  if (runtimeChanged) {
    logRuntimeEvent({
      session_id: row.id,
      event_kind: "state_changed",
      summary: `${row.runtime_state ?? "unknown"} -> ${nextRuntimeState}`,
      payload: {
        from_state: row.runtime_state,
        to_state: nextRuntimeState,
      },
    });
  }

  return nextSession;
}

export function listRuntimeSessions(): RuntimeSession[] {
  ensureInitialized();
  const panes = listTmuxPanes();
  const managed = managedRows();
  const managedByName = new Map(managed.map((row) => [row.session_name, row]));

  const sessions = managed.map((row) => {
    const pane = panes.find((candidate) => candidate.sessionName === row.session_name) ?? null;
    return refreshManagedSession(row, pane);
  });

  for (const pane of panes) {
    if (managedByName.has(pane.sessionName)) {
      continue;
    }
    const toolKind = inferToolKind(pane.currentCommand);
    if (toolKind === "unknown") {
      continue;
    }
    sessions.push(materializeExternalSession(pane));
  }

  return sessions.sort((left, right) =>
    right.last_seen_at.localeCompare(left.last_seen_at),
  );
}

function resolveSession(id: string): RuntimeSession {
  const session = listRuntimeSessions().find((candidate) => candidate.id === id);
  if (!session) {
    throw new Error(`runtime_session_not_found ${id}`);
  }
  return session;
}

function tmuxTargetFor(session: RuntimeSession): string {
  return session.pane_id ?? session.session_name;
}

function tmuxExists(sessionName: string): boolean {
  return paneForSessionName(sessionName) !== null;
}

function lineCount(text: string): number {
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

export function readRuntimeSessionScreen(id: string, lines = SCREEN_LINE_LIMIT): RuntimeSessionScreen {
  const session = resolveSession(id);
  const capturedAt = nowIso();
  const tail = capturePaneTail(tmuxTargetFor(session), lines);
  if (!tail && session.source === "managed" && session.status !== "stopped") {
    throw new Error(`runtime_capture_failed ${session.session_name}`);
  }
  if (session.source === "managed") {
    const currentRow = managedRows().find((row) => row.id === session.id);
    const nextTailHash = hashTail(tail);
    const outputChanged = currentRow?.tail_hash !== nextTailHash;
    const nextLastOutputAt = outputChanged ? capturedAt : (currentRow?.last_output_at ?? session.last_output_at);
    const nextRuntimeState = classifySessionState(tail, session.started_at, nextLastOutputAt);
    updateManagedSessionState(session.id, {
      last_seen_at: capturedAt,
      last_output_at: nextLastOutputAt,
      runtime_state: nextRuntimeState,
      last_transition_at: currentRow?.runtime_state !== nextRuntimeState ? capturedAt : (currentRow?.last_transition_at ?? session.last_transition_at),
      tail_preview: summarizeTail(tail),
      tail_hash: nextTailHash,
      status: statusFromRuntimeState(nextRuntimeState),
      summary: summarizeTail(tail) ?? session.summary,
    });
  }

  return {
    session_id: session.id,
    session_name: session.session_name,
    pane_id: session.pane_id,
    captured_at: capturedAt,
    line_count: lineCount(tail),
    tail,
  };
}

function sendLiteral(target: string, text: string): void {
  const result = tmuxResult([
    "send-keys",
    "-t",
    target,
    "-l",
    "--",
    text,
  ]);
  if (result.status !== 0) {
    throw new Error("runtime_send_literal_failed");
  }
}

function sendKey(target: string, key: string): void {
  const result = tmuxResult([
    "send-keys",
    "-t",
    target,
    key,
  ]);
  if (result.status !== 0) {
    throw new Error(`runtime_send_key_failed ${key}`);
  }
}

function normalizeKey(key: string): string {
  const normalized = key.trim().toLowerCase();
  switch (normalized) {
    case "enter":
    case "return":
      return "Enter";
    case "tab":
      return "Tab";
    case "escape":
    case "esc":
      return "Escape";
    case "ctrl-c":
    case "c-c":
      return "C-c";
    case "ctrl-d":
    case "c-d":
      return "C-d";
    case "up":
      return "Up";
    case "down":
      return "Down";
    default:
      return key;
  }
}

export function sendRuntimeSessionInput(input: {
  id: string;
  mode?: RuntimeInputMode;
  text?: string;
  key?: string;
  submit?: boolean;
}): RuntimeSession {
  const session = resolveSession(input.id);
  const target = tmuxTargetFor(session);
  const mode = input.mode ?? (input.key ? "key" : "paste");

  if (mode === "key") {
    if (!input.key) {
      throw new Error("runtime_input_requires_key");
    }
    sendKey(target, normalizeKey(input.key));
    if (session.source === "managed") {
      logRuntimeEvent({
        session_id: session.id,
        event_kind: "key_sent",
        summary: `key ${normalizeKey(input.key)}`,
        payload: { key: normalizeKey(input.key) },
      });
    }
  } else if (typeof input.text === "string" && input.text.length > 0) {
    if (mode === "paste") {
      const setBuffer = tmuxResult([
        "set-buffer",
        "--",
        input.text,
      ]);
      if (setBuffer.status !== 0) {
        throw new Error("runtime_set_buffer_failed");
      }
      const paste = tmuxResult([
        "paste-buffer",
        "-t",
        target,
      ]);
      if (paste.status !== 0) {
        throw new Error("runtime_paste_failed");
      }
      tmuxResult(["delete-buffer"]);
    } else {
      for (const character of input.text) {
        sendLiteral(target, character);
      }
    }
    if (session.source === "managed") {
      logRuntimeEvent({
        session_id: session.id,
        event_kind: "input_sent",
        summary: `${mode} ${input.text.slice(0, 80)}`,
        payload: {
          mode,
          submit: input.submit === true,
          text_preview: input.text.slice(0, 200),
        },
      });
    }
  } else {
    throw new Error("runtime_input_requires_text_or_key");
  }

  if (input.submit) {
    sendKey(target, "Enter");
  }

  if (session.source === "managed") {
    updateManagedSessionState(session.id, {
      last_seen_at: nowIso(),
      status: "running",
    });
  }

  return resolveSession(input.id);
}

export function createRuntimeSession(input: CreateRuntimeSessionInput): RuntimeSession {
  ensureInitialized();
  const tool = resolveTool(input.tool_kind);
  const id = createId("rt");
  const sessionName = sessionNameFor(input, id);
  const cwd = resolve(input.cwd ?? process.cwd());

  if (tmuxExists(sessionName)) {
    throw new Error(`runtime_session_name_taken ${sessionName}`);
  }

  const command = buildCommand(tool, input);
  const shellCommand = `bash -lc ${shellEscape(command)}`;
  const result = tmuxResult([
    "new-session",
    "-d",
    "-s",
    sessionName,
    "-c",
    cwd,
    shellCommand,
  ]);

  if (result.status !== 0) {
    throw new Error(`runtime_session_start_failed ${resultText(result.stderr).trim()}`);
  }

  tmuxResult([
    "set-option",
    "-t",
    sessionName,
    "history-limit",
    "100000",
  ]);

  const pane = paneForSessionName(sessionName);
  if (!pane) {
    throw new Error(`runtime_session_pane_missing ${sessionName}`);
  }

  const startedAt = nowIso();
  const session: PersistedRuntimeSession = {
    id,
    session_name: sessionName,
    source: "managed",
    tool_kind: tool.kind,
    tool_name: tool.name,
    status: "running",
    runtime_state: "working",
    cwd,
    command,
    pane_id: pane.paneId,
    pid: pane.pid,
    started_at: startedAt,
    last_seen_at: startedAt,
    last_output_at: null,
    last_transition_at: startedAt,
    tail_preview: null,
    tail_hash: null,
    summary: `Managed ${tool.name} session.`,
  };

  persistManagedSession(session);
  logRuntimeEvent({
    session_id: session.id,
    event_kind: "session_started",
    summary: `started ${tool.name}`,
    payload: {
      tool_kind: tool.kind,
      cwd,
      command,
      session_name: session.session_name,
    },
  });

  if (typeof input.initial_input === "string" && input.initial_input.trim().length > 0) {
    sendRuntimeSessionInput({
      id: session.id,
      mode: input.simulate_typing ? "type" : "paste",
      text: input.initial_input,
      submit: true,
    });
  }

  return resolveSession(session.id);
}

export function dispatchRuntimePrompt(input: DispatchPromptInput): {
  session: RuntimeSession;
  screen: RuntimeSessionScreen;
} {
  const session = input.session_id
    ? sendRuntimeSessionInput({
        id: input.session_id,
        mode: input.simulate_typing ? "type" : "paste",
        text: input.prompt,
        submit: true,
      })
    : createRuntimeSession({
        tool_kind: input.tool_kind,
        initial_input: input.prompt,
        ...(input.cwd ? { cwd: input.cwd } : {}),
        ...(input.session_name ? { session_name: input.session_name } : {}),
        ...(input.startup_options ? { startup_options: input.startup_options } : {}),
        ...(input.command ? { command: input.command } : {}),
        ...(input.simulate_typing !== undefined ? { simulate_typing: input.simulate_typing } : {}),
      });

  if (session.source === "managed") {
    logRuntimeEvent({
      session_id: session.id,
      event_kind: "prompt_dispatched",
      summary: input.prompt.slice(0, 120),
      payload: {
        text_preview: input.prompt.slice(0, 500),
        mode: input.simulate_typing ? "type" : "paste",
      },
    });
  }

  return {
    session,
    screen: readRuntimeSessionScreen(session.id),
  };
}

export function stopRuntimeSession(id: string): RuntimeSession {
  const session = resolveSession(id);
  if (session.source !== "managed") {
    throw new Error("runtime_external_session_stop_forbidden");
  }
  const result = tmuxResult([
    "kill-session",
    "-t",
    session.session_name,
  ]);
  if (result.status !== 0) {
    throw new Error(`runtime_session_stop_failed ${session.session_name}`);
  }
  updateManagedSessionState(id, {
    status: "stopped",
    last_seen_at: nowIso(),
  });
  logRuntimeEvent({
    session_id: id,
    event_kind: "session_stopped",
    summary: "session stopped",
  });
  return resolveSession(id);
}

export function forgetRuntimeSession(id: string): void {
  deleteManagedSession(id);
}
