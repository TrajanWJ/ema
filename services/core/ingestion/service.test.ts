import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const {
  __resetChronicleForTests,
  listChronicleSessions,
} = await import("../chronicle/service.js");
const {
  captureMachineSnapshot,
  buildChronicleImportFromFile,
  discoverSessionCandidates,
  discoverInstalledCliTools,
  importDiscoveredSessions,
} = await import("./service.js");
const {
  getIngestionBootstrapState,
  runIngestionBootstrap,
} = await import("./bootstrap.js");

let homeDir = "";
let repoRoot = "";
let chronicleDir = "";
let previousHome = "";
let previousPath = "";
let binDir = "";

function resetTables(): void {
  memoryDb.exec(`
    DROP TABLE IF EXISTS promotion_receipts;
    DROP TABLE IF EXISTS review_items;
    DROP TABLE IF EXISTS chronicle_extractions;
    DROP TABLE IF EXISTS chronicle_artifacts;
    DROP TABLE IF EXISTS chronicle_entries;
    DROP TABLE IF EXISTS chronicle_sessions;
    DROP TABLE IF EXISTS chronicle_sources;
  `);
  __resetChronicleForTests();
}

beforeEach(() => {
  resetTables();
  previousHome = process.env.HOME ?? "";
  homeDir = mkdtempSync(join(tmpdir(), "ema-ingestion-home-"));
  repoRoot = mkdtempSync(join(tmpdir(), "ema-ingestion-repo-"));
  chronicleDir = join(homeDir, ".local", "share", "ema", "chronicle");
  binDir = join(homeDir, "bin");
  process.env.HOME = homeDir;
  process.env.EMA_CHRONICLE_DIR = chronicleDir;
  previousPath = process.env.PATH ?? "";
  process.env.PATH = `${binDir}:${previousPath}`;

  mkdirSync(binDir, { recursive: true });

  mkdirSync(join(homeDir, ".codex", "sessions"), { recursive: true });
  mkdirSync(join(homeDir, ".claude", "projects", "ema"), { recursive: true });

  writeExecutable("codex", "#!/bin/sh\necho 'codex 0.120.0'\n");
  writeExecutable("claude", "#!/bin/sh\necho 'claude 1.0.0'\n");
  writeExecutable("pnpm", "#!/bin/sh\necho '10.29.3'\n");

  writeFileSync(
    join(homeDir, ".codex", "sessions", "history.jsonl"),
    [
      JSON.stringify({
        session_id: "codex-session-1",
        ts: 1713000000,
        text: "Bring all Codex sessions into Chronicle.",
      }),
      JSON.stringify({
        session_id: "codex-session-1",
        ts: 1713000001,
        text: "Second message in the same session.",
      }),
    ].join("\n"),
    "utf8",
  );

  writeFileSync(
    join(homeDir, ".claude", "projects", "ema", "session.jsonl"),
    [
      JSON.stringify({
        role: "user",
        content: "Import Claude local histories into EMA Chronicle.",
        timestamp: "2026-04-10T12:00:00.000Z",
      }),
      JSON.stringify({
        role: "assistant",
        content: "Chronicle should own the raw landing zone.",
        timestamp: "2026-04-10T12:05:00.000Z",
      }),
    ].join("\n"),
    "utf8",
  );

  mkdirSync(join(homeDir, ".codex", "sessions", "2026", "04", "13"), { recursive: true });
  writeFileSync(
    join(homeDir, ".codex", "sessions", "2026", "04", "13", "rollout.jsonl"),
    [
      JSON.stringify({
        timestamp: "2026-04-13T05:44:15.827Z",
        type: "session_meta",
        payload: {
          id: "codex-rollout-1",
          timestamp: "2026-04-13T05:44:03.035Z",
          cwd: repoRoot,
        },
      }),
      JSON.stringify({
        timestamp: "2026-04-13T05:44:20.000Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: [
            "<environment_context>",
            "  <cwd>/tmp/example</cwd>",
            "</environment_context>",
            "",
            "Harvest every local agent session into Chronicle with provenance.",
          ].join("\n"),
        },
      }),
      JSON.stringify({
        timestamp: "2026-04-13T05:44:25.000Z",
        type: "commentary",
        payload: {
          text: "Parsing the current repo and local agent directories now.",
        },
      }),
    ].join("\n"),
    "utf8",
  );
});

afterEach(() => {
  if (previousHome) process.env.HOME = previousHome;
  else delete process.env.HOME;
  process.env.PATH = previousPath;
  delete process.env.EMA_CHRONICLE_DIR;
  rmSync(homeDir, { recursive: true, force: true });
  rmSync(repoRoot, { recursive: true, force: true });
});

function writeExecutable(name: string, contents: string): void {
  const path = join(binDir, name);
  writeFileSync(path, contents, "utf8");
  chmodSync(path, 0o755);
}

describe("ingestion service", () => {
  it("discovers local session candidates across agent roots", () => {
    const sessions = discoverSessionCandidates({ repoRoot });

    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions.some((session) => session.agent === "codex")).toBe(true);
    expect(sessions.some((session) => session.agent === "claude")).toBe(true);
  });

  it("imports discovered sessions into Chronicle and dedupes repeat runs", () => {
    const first = importDiscoveredSessions({ repoRoot, limit: 10 });
    expect(first.count).toBeGreaterThanOrEqual(2);

    const sessionsAfterFirst = listChronicleSessions();
    expect(sessionsAfterFirst.length).toBe(first.count);

    const second = importDiscoveredSessions({ repoRoot, limit: 10 });
    const sessionsAfterSecond = listChronicleSessions();

    expect(second.count).toBe(first.count);
    expect(sessionsAfterSecond.length).toBe(sessionsAfterFirst.length);
    expect(
      sessionsAfterSecond.some((session) => session.source_kind === "codex"),
    ).toBe(true);
    expect(
      sessionsAfterSecond.some((session) => session.source_kind === "claude"),
    ).toBe(true);
  });

  it("supports paged Chronicle backfill imports with offsets", () => {
    const first = importDiscoveredSessions({ repoRoot, limit: 1, offset: 0 });
    const second = importDiscoveredSessions({ repoRoot, limit: 1, offset: 1 });

    expect(first.scanned).toBe(1);
    expect(second.scanned).toBe(1);
    expect(first.total_candidates).toBeGreaterThanOrEqual(3);
    expect(first.next_offset).toBe(1);
    expect(second.offset).toBe(1);
    expect(listChronicleSessions().length).toBe(2);
  });

  it("derives Chronicle titles from wrapped Codex session prompts", () => {
    const input = buildChronicleImportFromFile({
      path: join(homeDir, ".codex", "sessions", "2026", "04", "13", "rollout.jsonl"),
      agent: "codex",
    });

    expect(input.session.title).toContain("Harvest every local agent session");
    expect(input.session.entries.some((entry) => entry.role === "user")).toBe(true);
  });

  it("captures a repeatable machine snapshot into Chronicle", () => {
    const first = captureMachineSnapshot(repoRoot);
    const second = captureMachineSnapshot(repoRoot);

    expect(first.snapshot.hostname.length).toBeGreaterThan(0);
    expect(first.detail.source.kind).toBe("system");
    expect(first.detail.session.title).toContain("Machine snapshot");
    expect(first.detail.artifacts.some((artifact) => artifact.name === "machine-snapshot.json")).toBe(true);
    expect(first.snapshot.installed_cli_tools.some((tool) => tool.name === "codex")).toBe(true);
    expect(second.detail.session.id).not.toBe(first.detail.session.id);
    expect(listChronicleSessions().filter((session) => session.source_kind === "system").length).toBe(2);
  });

  it("detects installed agent and support CLIs from PATH", () => {
    const tools = discoverInstalledCliTools();

    expect(tools.some((tool) => tool.name === "codex" && tool.category === "agent_cli")).toBe(true);
    expect(tools.some((tool) => tool.name === "pnpm" && tool.category === "support_cli")).toBe(true);
  });

  it("persists bootstrap state and advances the default backfill cursor across runs", () => {
    const first = runIngestionBootstrap({ repoRoot, backfillLimit: 1 });
    const second = runIngestionBootstrap({ repoRoot, backfillLimit: 1 });
    const state = getIngestionBootstrapState();
    const bootstrapPath = join(homeDir, ".local", "share", "ema", "ingestion-bootstrap.json");

    expect(first.backfill?.offset).toBe(0);
    expect(first.backfill?.next_offset).toBe(1);
    expect(second.backfill?.offset).toBe(1);
    expect(second.backfill?.next_offset).toBe(2);
    expect(state.run_count).toBe(2);
    expect(state.last_next_offset).toBe(2);
    expect(state.installed_tools.some((tool) => tool.name === "claude")).toBe(true);
    expect(existsSync(bootstrapPath)).toBe(true);
    expect(JSON.parse(readFileSync(bootstrapPath, "utf8")).run_count).toBe(2);
  });
});
