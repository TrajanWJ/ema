import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { ChronicleSessionDetail } from "@ema/shared/schemas";

import {
  captureMachineSnapshot,
  discoverAgentConfigs,
  discoverInstalledCliTools,
  getIngestionStatus,
  importDiscoveredSessions,
  type ImportDiscoveredSessionsInput,
  type ImportedSessionRecord,
  type IngestionAgentConfigSummary,
  type InstalledCliToolSummary,
  type MachineSnapshotSummary,
} from "./service.js";

export interface IngestionBootstrapState {
  first_started_at: string | null;
  last_started_at: string | null;
  run_count: number;
  machine_id: string | null;
  last_repo_root: string | null;
  last_machine_snapshot_session_id: string | null;
  last_backfill_offset: number;
  last_next_offset: number | null;
  last_total_candidates: number;
  backfill_complete: boolean;
  installed_tools: InstalledCliToolSummary[];
  agent_configs: IngestionAgentConfigSummary[];
}

export interface IngestionBootstrapRun {
  state: IngestionBootstrapState;
  snapshot: {
    session: ChronicleSessionDetail;
    machine: MachineSnapshotSummary;
  };
  backfill: {
    imported: ImportedSessionRecord[];
    count: number;
    scanned: number;
    offset: number;
    next_offset: number | null;
    total_candidates: number;
  } | null;
}

export interface RunIngestionBootstrapInput {
  repoRoot?: string;
  backfillLimit?: number;
  force?: boolean;
}

const DEFAULT_BOOTSTRAP_STATE: IngestionBootstrapState = {
  first_started_at: null,
  last_started_at: null,
  run_count: 0,
  machine_id: null,
  last_repo_root: null,
  last_machine_snapshot_session_id: null,
  last_backfill_offset: 0,
  last_next_offset: 0,
  last_total_candidates: 0,
  backfill_complete: false,
  installed_tools: [],
  agent_configs: [],
};

export function getIngestionBootstrapState(): IngestionBootstrapState {
  const path = ingestionBootstrapStatePath();
  if (!existsSync(path)) return { ...DEFAULT_BOOTSTRAP_STATE };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<IngestionBootstrapState>;
    return {
      ...DEFAULT_BOOTSTRAP_STATE,
      ...parsed,
      installed_tools: Array.isArray(parsed.installed_tools) ? parsed.installed_tools : [],
      agent_configs: Array.isArray(parsed.agent_configs) ? parsed.agent_configs : [],
    };
  } catch {
    return { ...DEFAULT_BOOTSTRAP_STATE };
  }
}

export function runIngestionBootstrap(
  input: RunIngestionBootstrapInput = {},
): IngestionBootstrapRun {
  const repoRoot = input.repoRoot ?? process.cwd();
  const previous = getIngestionBootstrapState();
  const startedAt = new Date().toISOString();
  const backfillLimit = Math.max(1, Math.min(input.backfillLimit ?? bootstrapBatchSize(), 5000));

  const snapshot = captureMachineSnapshot(repoRoot);
  const installedTools = discoverInstalledCliTools();
  const agentConfigs = discoverAgentConfigs(repoRoot);

  const shouldBackfill = input.force === true || previous.run_count === 0 || previous.last_next_offset !== null;
  const backfillInput: ImportDiscoveredSessionsInput = {
    repoRoot,
    limit: backfillLimit,
    offset: input.force === true ? 0 : previous.last_next_offset ?? previous.last_backfill_offset,
  };
  const backfill = shouldBackfill ? importDiscoveredSessions(backfillInput) : null;

  const state: IngestionBootstrapState = {
    first_started_at: previous.first_started_at ?? startedAt,
    last_started_at: startedAt,
    run_count: previous.run_count + 1,
    machine_id: snapshot.snapshot.machine_id,
    last_repo_root: repoRoot,
    last_machine_snapshot_session_id: snapshot.detail.session.id,
    last_backfill_offset: backfill?.offset ?? previous.last_backfill_offset,
    last_next_offset: backfill ? backfill.next_offset : previous.last_next_offset,
    last_total_candidates: backfill?.total_candidates ?? previous.last_total_candidates,
    backfill_complete: backfill ? backfill.next_offset === null : previous.backfill_complete,
    installed_tools: installedTools,
    agent_configs: agentConfigs,
  };

  writeBootstrapState(state);

  return {
    state,
    snapshot: {
      session: snapshot.detail,
      machine: snapshot.snapshot,
    },
    backfill,
  };
}

export function getIngestionRuntimeStatus(repoRoot: string = process.cwd()): ReturnType<typeof getIngestionStatus> & {
  installed_tools: InstalledCliToolSummary[];
  bootstrap: IngestionBootstrapState;
} {
  return {
    ...getIngestionStatus(repoRoot),
    installed_tools: discoverInstalledCliTools(),
    bootstrap: getIngestionBootstrapState(),
  };
}

function bootstrapBatchSize(): number {
  const raw = Number(process.env.EMA_BOOTSTRAP_BACKFILL_LIMIT ?? 500);
  if (!Number.isFinite(raw)) return 500;
  return Math.max(1, Math.min(Math.floor(raw), 5000));
}

function writeBootstrapState(state: IngestionBootstrapState): void {
  const path = ingestionBootstrapStatePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2), "utf8");
}

function ingestionBootstrapStatePath(): string {
  const override = process.env.EMA_INGESTION_BOOTSTRAP_STATE_PATH?.trim();
  if (override) return override;
  return join(homedir(), ".local", "share", "ema", "ingestion-bootstrap.json");
}
