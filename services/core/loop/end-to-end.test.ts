import Database from "better-sqlite3";
import { beforeEach, expect, test, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

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

test("complete intent → proposal → execution cycle", async () => {
  const intent = intentService.create({
    title: "E2E bootstrap",
    description: "Prove the full cycle works.",
    source: "human",
    priority: "critical",
    requested_by_actor_id: "actor_owner",
    scope: ["services/core/**", "shared/schemas/**"],
    constraints: ["persist everything", "emit events"],
    metadata: { test: true },
  });

  const activeIntent = intentService.updateStatus(intent.id, "active");
  expect(activeIntent.status).toBe("active");

  const proposal = proposalService.generate(intent.id);
  expect(proposal.status).toBe("pending_approval");

  const approved = proposalService.approve(proposal.id, "actor_owner");
  expect(approved.status).toBe("approved");

  const execution = executionService.start(approved.id);
  expect(execution.status).toBe("running");

  executionService.recordArtifact(execution.id, {
    type: "summary",
    label: "Execution summary",
    content: "The core loop ran end to end.",
    created_by_actor_id: "actor_owner",
    mime_type: "text/plain",
  });

  const completed = executionService.complete(execution.id, {
    summary: "The core loop ran end to end.",
    metadata: { verified: true },
  });
  expect(completed.status).toBe("completed");

  const finalIntent = intentService.updateStatus(intent.id, "completed");
  expect(finalIntent.status).toBe("completed");

  const persistedArtifacts = executionService.listArtifacts(execution.id);
  expect(persistedArtifacts).toHaveLength(1);
  expect(persistedArtifacts[0]?.content).toContain("end to end");

  const events = listLoopEvents().map((event) => event.type);
  expect(events).toEqual([
    "intent.created",
    "intent.status_updated",
    "proposal.generated",
    "proposal.approved",
    "execution.started",
    "execution.artifact_recorded",
    "execution.completed",
    "intent.status_updated",
  ]);
});
