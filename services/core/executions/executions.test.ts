/**
 * Executions subservice tests.
 *
 * Hermetic in-memory SQLite. Mirrors the setup pattern in
 * `services/core/blueprint/blueprint.test.ts` — mocks the persistence layer
 * with a shared `:memory:` handle and dynamic-imports the service so the
 * mock is active before module initialisation.
 *
 * Coverage:
 *   1. DDL bootstrap creates executions + execution_phase_transitions
 *   2. createExecution persists + emits an event
 *   3. listExecutions filters by status / mode / intent_slug / project_slug
 *   4. listExecutions excludes archived by default, includes with flag
 *   5. archiveExecution soft-archives
 *   6. transitionPhase null → idle is allowed, writes a log row
 *   7. transitionPhase idle → execute is allowed
 *   8. transitionPhase retro → execute is rejected (InvalidPhaseTransitionError)
 *   9. transitionPhase is append-only — rewinding logs a new row, not an update
 *  10. appendStep appends to the step journal, getStepJournal returns them
 *  11. getReflexionContext returns prior executions for an intent, newest first
 *  12. getReflexionContext excludes the current execution when asked
 */

import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

vi.mock("../../realtime/server.js", () => ({
  broadcast: vi.fn(),
  registerChannelHandler: vi.fn(),
}));

// The executions service now enforces a FK check against intents.getIntent
// (DEC-007 unified-intents schema + intent seam closure in EXE-003). Stub it
// here so the hermetic tests can use placeholder intent slugs like GAC-001
// without having to bootstrap the intents service in-process.
vi.mock("../intents/service.js", () => ({
  getIntent: (slug: string) => ({
    slug,
    title: `Stub intent ${slug}`,
    status: "active",
    phase: "execute",
    kind: "implement",
  }),
  attachExecution: vi.fn(),
}));

const {
  __resetExecutionsInit,
  appendStep,
  archiveExecution,
  createExecution,
  executionsEvents,
  getExecution,
  getStepJournal,
  initExecutions,
  listExecutions,
  listPhaseTransitions,
  transitionPhase,
} = await import("./executions.service.js");
const { getReflexionContext, buildReflexionPrefix } = await import(
  "./reflexion.js"
);
const { InvalidPhaseTransitionError, canTransitionPhase } = await import(
  "./state-machine.js"
);

function resetTables(): void {
  memoryDb.exec(`
    DROP TABLE IF EXISTS execution_phase_transitions;
    DROP TABLE IF EXISTS executions;
  `);
}

beforeAll(() => {
  initExecutions();
});

beforeEach(() => {
  resetTables();
  __resetExecutionsInit();
  initExecutions();
});

describe("Executions / schema bootstrap", () => {
  it("creates executions and execution_phase_transitions tables", () => {
    const tables = memoryDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("executions");
    expect(names).toContain("execution_phase_transitions");
  });
});

describe("Executions / createExecution", () => {
  it("persists the row and emits execution:created", () => {
    const events: string[] = [];
    const listener = (): void => {
      events.push("execution:created");
    };
    executionsEvents.on("execution:created", listener);

    const execution = createExecution({
      title: "Test run",
      objective: "do the thing",
      mode: "research",
      project_slug: "ema",
      intent_slug: "GAC-001",
    });

    expect(execution.id).toBeTruthy();
    expect(execution.status).toBe("created");
    expect(execution.project_slug).toBe("ema");
    expect(execution.intent_slug).toBe("GAC-001");
    expect(execution.step_journal).toEqual([]);
    expect(execution.current_phase).toBeNull();
    expect(events).toEqual(["execution:created"]);

    executionsEvents.off("execution:created", listener);

    const roundtrip = getExecution(execution.id);
    expect(roundtrip).not.toBeNull();
    expect(roundtrip?.objective).toBe("do the thing");
  });
});

describe("Executions / listExecutions filters", () => {
  it("filters by status, mode, intent_slug, and project_slug", () => {
    createExecution({
      title: "a",
      mode: "research",
      intent_slug: "GAC-001",
      project_slug: "ema",
    });
    createExecution({
      title: "b",
      mode: "code",
      intent_slug: "GAC-002",
      project_slug: "ema",
    });
    createExecution({
      title: "c",
      mode: "research",
      intent_slug: "GAC-001",
      project_slug: "hq",
    });

    expect(listExecutions({ mode: "research" })).toHaveLength(2);
    expect(listExecutions({ mode: "code" })).toHaveLength(1);
    expect(listExecutions({ intent_slug: "GAC-001" })).toHaveLength(2);
    expect(listExecutions({ project_slug: "hq" })).toHaveLength(1);
    expect(listExecutions({ status: "created" })).toHaveLength(3);
  });

  it("excludes archived rows by default and includes them on request", () => {
    const keep = createExecution({ title: "keep" });
    const drop = createExecution({ title: "drop" });
    archiveExecution(drop.id);

    expect(listExecutions()).toHaveLength(1);
    expect(listExecutions()[0]?.id).toBe(keep.id);
    expect(listExecutions({ includeArchived: true })).toHaveLength(2);
  });
});

describe("Executions / phase transitions", () => {
  it("allows null → idle as the first transition and logs a row", () => {
    const execution = createExecution({ title: "phases" });
    const { execution: updated, transition } = transitionPhase(execution.id, {
      to: "idle",
      reason: "boot",
    });
    expect(updated.current_phase).toBe("idle");
    expect(transition.from_phase).toBeNull();
    expect(transition.to_phase).toBe("idle");

    const log = listPhaseTransitions(execution.id);
    expect(log).toHaveLength(1);
    expect(log[0]?.to_phase).toBe("idle");
  });

  it("allows idle → execute and rejects retro → execute by DEC-005", () => {
    const execution = createExecution({ title: "phases" });
    transitionPhase(execution.id, { to: "idle", reason: "boot" });
    transitionPhase(execution.id, { to: "execute", reason: "start work" });

    const log = listPhaseTransitions(execution.id);
    expect(log).toHaveLength(2);
    expect(log[1]?.from_phase).toBe("idle");
    expect(log[1]?.to_phase).toBe("execute");

    // retro → execute is NOT in PHASE_TRANSITIONS.retro (['idle','plan'])
    transitionPhase(execution.id, { to: "retro", reason: "reflect" });
    expect(() =>
      transitionPhase(execution.id, { to: "execute", reason: "resume" }),
    ).toThrow(InvalidPhaseTransitionError);

    expect(canTransitionPhase("retro", "execute")).toBe(false);
    expect(canTransitionPhase("idle", "execute")).toBe(true);
    expect(canTransitionPhase(null, "idle")).toBe(true);
    expect(canTransitionPhase(null, "execute")).toBe(false);
  });

  it("is append-only — rewinding plan → idle writes a new row, not an update", () => {
    const execution = createExecution({ title: "phases" });
    transitionPhase(execution.id, { to: "idle", reason: "boot" });
    transitionPhase(execution.id, { to: "plan", reason: "planning" });
    transitionPhase(execution.id, { to: "idle", reason: "paused" });

    const log = listPhaseTransitions(execution.id);
    expect(log).toHaveLength(3);
    expect(log.map((r) => r.to_phase)).toEqual(["idle", "plan", "idle"]);
  });
});

describe("Executions / step journal", () => {
  it("appends steps and reads them back in order", () => {
    const execution = createExecution({ title: "steps" });
    appendStep(execution.id, { label: "first" });
    appendStep(execution.id, { label: "second", note: "with a note" });

    const journal = getStepJournal(execution.id);
    expect(journal).toHaveLength(2);
    expect(journal[0]?.label).toBe("first");
    expect(journal[1]?.label).toBe("second");
    expect(journal[1]?.note).toBe("with a note");
    expect(journal[0]?.at).toMatch(/T/u);
  });
});

describe("Executions / reflexion", () => {
  it("returns prior executions for the same intent, newest first", () => {
    createExecution({ title: "oldest", intent_slug: "GAC-007" });
    // Bump updated_at on the second so ordering is deterministic.
    const middle = createExecution({ title: "middle", intent_slug: "GAC-007" });
    const newest = createExecution({ title: "newest", intent_slug: "GAC-007" });
    createExecution({ title: "other", intent_slug: "GAC-999" });

    // Force completed_at to vary so the ORDER BY picks the newest.
    memoryDb
      .prepare("UPDATE executions SET completed_at = ? WHERE id = ?")
      .run("2030-01-01T00:00:00.000Z", newest.id);
    memoryDb
      .prepare("UPDATE executions SET completed_at = ? WHERE id = ?")
      .run("2029-01-01T00:00:00.000Z", middle.id);

    const history = getReflexionContext(memoryDb, "GAC-007", { limit: 5 });
    expect(history).toHaveLength(3);
    expect(history[0]?.id).toBe(newest.id);
    expect(history[1]?.id).toBe(middle.id);

    const prefix = buildReflexionPrefix(history);
    expect(prefix).toContain("Reflexion");
    expect(prefix).toContain("newest");
  });

  it("excludes the current execution when excludeId is passed", () => {
    const self = createExecution({ title: "self", intent_slug: "GAC-123" });
    createExecution({ title: "prior", intent_slug: "GAC-123" });

    const history = getReflexionContext(memoryDb, "GAC-123", {
      excludeId: self.id,
    });
    expect(history).toHaveLength(1);
    expect(history[0]?.id).not.toBe(self.id);
  });
});
