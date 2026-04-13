import { spawnSync } from "node:child_process";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const runtimeFabric = await import("./service.js");

function cleanupSessions(prefix: string): void {
  try {
    const result = spawnSync("tmux", [
      "list-sessions",
      "-F",
      "#{session_name}",
    ], {
      encoding: "utf8",
    });
    if (result.status !== 0) return;
    const sessions = result.stdout
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter((line: string) => line.startsWith(prefix));
    for (const session of sessions) {
      spawnSync("tmux", [
        "kill-session",
        "-t",
        session,
      ]);
    }
  } catch {
    // Ignore cleanup failures.
  }
}

beforeEach(() => {
  memoryDb.exec(`
    DROP TABLE IF EXISTS runtime_fabric_tools;
    DROP TABLE IF EXISTS runtime_fabric_sessions;
    DROP TABLE IF EXISTS runtime_fabric_session_events;
  `);
  runtimeFabric.__resetRuntimeFabricInit();
});

afterEach(() => {
  cleanupSessions("ema-runtime-test");
});

describe("runtime-fabric", () => {
  it("discovers runtime tools", () => {
    const tools = runtimeFabric.scanRuntimeTools();
    expect(tools.some((tool) => tool.kind === "shell")).toBe(true);
    expect(tools.every((tool) => tool.id.startsWith("runtime_tool:"))).toBe(true);
  });

  it("starts a managed shell session, relays input, and captures the screen", () => {
    const session = runtimeFabric.createRuntimeSession({
      tool_kind: "shell",
      session_name: "ema-runtime-test-shell",
      command: "bash",
      initial_input: "printf 'runtime-fabric-ok\\n'",
    });

    expect(session.source).toBe("managed");
    expect(session.session_name).toContain("ema-runtime-test-shell");
    expect(session.runtime_state).toBe("working");

    const screen = runtimeFabric.readRuntimeSessionScreen(session.id, 80);
    expect(screen.tail).toContain("runtime-fabric-ok");

    runtimeFabric.sendRuntimeSessionInput({
      id: session.id,
      text: "printf 'second-line\\n'",
      submit: true,
    });

    const updated = runtimeFabric.readRuntimeSessionScreen(session.id, 80);
    expect(updated.tail).toContain("second-line");

    const events = runtimeFabric.listRuntimeSessionEvents(session.id, 10);
    expect(events.some((event) => event.event_kind === "session_started")).toBe(true);
    expect(events.some((event) => event.event_kind === "input_sent")).toBe(true);

    const stopped = runtimeFabric.stopRuntimeSession(session.id);
    expect(stopped.status).toBe("stopped");
  });
});
