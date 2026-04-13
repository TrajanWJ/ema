import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const { loopOrchestrator } = await import("./orchestrator.js");
const { intentService } = await import("../intent/service.js");
const { proposalService } = await import("../proposal/service.js");
const { executionService } = await import("../execution/service.js");
const { listLoopEvents } = await import("./events.js");
const { resetLoopMigrationsForTests, runLoopMigrations } = await import(
  "./migrations.js"
);

function resetTables(): void {
  memoryDb.exec(`
    DROP TABLE IF EXISTS loop_events;
    DROP TABLE IF EXISTS loop_artifacts;
    DROP TABLE IF EXISTS loop_executions;
    DROP TABLE IF EXISTS loop_proposals;
    DROP TABLE IF EXISTS loop_intents;
    DROP TABLE IF EXISTS service_migrations;
  `);
  resetLoopMigrationsForTests();
  runLoopMigrations(memoryDb);
}

beforeEach(() => {
  resetTables();
});

describe("LoopOrchestrator", () => {
  it("completes the intent → proposal → execution cycle", () => {
    const result = loopOrchestrator.runIntent({
      title: "Ship the core loop",
      description: "Make the bootstrap loop executable.",
      source: "system",
      priority: "critical",
      requested_by_actor_id: "actor_system",
      scope: ["services/core/**", "shared/schemas/**"],
      constraints: ["tests green"],
      metadata: { wave: 1 },
    });

    expect(result.intent.status).toBe("completed");
    expect(result.proposal.status).toBe("approved");
    expect(result.execution.status).toBe("completed");
    expect(result.artifacts).toHaveLength(1);
  });

  it("persists each entity so it can be fetched again", () => {
    const result = loopOrchestrator.runIntent({
      title: "Persist me",
      description: "Roundtrip test",
      source: "human",
      priority: "high",
      requested_by_actor_id: "actor_owner",
      scope: ["docs/**"],
      constraints: [],
      metadata: {},
    });

    expect(intentService.get(result.intent.id)?.id).toBe(result.intent.id);
    expect(proposalService.get(result.proposal.id)?.id).toBe(result.proposal.id);
    expect(executionService.get(result.execution.id)?.id).toBe(result.execution.id);
  });

  it("handles multiple intents without id collisions", () => {
    const a = loopOrchestrator.runIntent({
      title: "Intent A",
      description: "A",
      source: "system",
      priority: "medium",
      requested_by_actor_id: "actor_system",
      scope: ["shared/**"],
      constraints: [],
      metadata: {},
    });
    const b = loopOrchestrator.runIntent({
      title: "Intent B",
      description: "B",
      source: "system",
      priority: "medium",
      requested_by_actor_id: "actor_system",
      scope: ["services/**"],
      constraints: [],
      metadata: {},
    });

    expect(a.intent.id).not.toBe(b.intent.id);
    expect(a.execution.id).not.toBe(b.execution.id);
  });

  it("writes a loop.completed event", () => {
    loopOrchestrator.runIntent({
      title: "Observe events",
      description: "Need the final event",
      source: "agent",
      priority: "high",
      requested_by_actor_id: "actor_agent",
      scope: ["services/**"],
      constraints: [],
      metadata: {},
    });

    expect(listLoopEvents().some((event) => event.type === "loop.completed")).toBe(true);
  });
});
