import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const { intentService } = await import("../intent/service.js");
const { proposalService } = await import("../proposal/service.js");
const { executionService, ExecutionNotFoundError } = await import("./service.js");
const { ProposalStateError } = await import("../proposal/service.js");
const { listLoopEvents } = await import("../loop/events.js");
const { resetLoopMigrationsForTests, runLoopMigrations } = await import(
  "../loop/migrations.js"
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

function seedApprovedProposal() {
  const intent = intentService.create({
    title: "Executable intent",
    description: "Need to run code",
    source: "human",
    priority: "critical",
    requested_by_actor_id: "actor_owner",
    scope: ["services/**"],
    constraints: [],
    metadata: {},
  });
  const proposal = proposalService.generate(intent.id);
  return proposalService.approve(proposal.id, "actor_owner");
}

beforeEach(() => {
  resetTables();
});

describe("ExecutionService", () => {
  it("starts an execution for an approved proposal", () => {
    const proposal = seedApprovedProposal();
    const execution = executionService.start(proposal.id);

    expect(execution.proposal_id).toBe(proposal.id);
    expect(execution.status).toBe("running");
  });

  it("rejects starting from an unapproved proposal", () => {
    const intent = intentService.create({
      title: "Unapproved",
      description: "No execution yet",
      source: "human",
      priority: "medium",
      requested_by_actor_id: "actor_owner",
      scope: ["docs/**"],
      constraints: [],
      metadata: {},
    });
    const proposal = proposalService.generate(intent.id);

    expect(() => executionService.start(proposal.id)).toThrow(ProposalStateError);
  });

  it("records artifacts durably", () => {
    const execution = executionService.start(seedApprovedProposal().id);
    executionService.recordArtifact(execution.id, {
      type: "report",
      label: "Verification",
      content: "Tests passed.",
      created_by_actor_id: "actor_owner",
      path: "reports/verification.md",
      mime_type: "text/markdown",
    });

    const artifacts = executionService.listArtifacts(execution.id);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.label).toBe("Verification");
  });

  it("completes and fails executions", () => {
    const success = executionService.start(seedApprovedProposal().id);
    const completed = executionService.complete(success.id, { summary: "Done" });
    expect(completed.status).toBe("completed");
    expect(completed.result_summary).toBe("Done");

    const failure = executionService.start(seedApprovedProposal().id);
    const failed = executionService.fail(failure.id, "boom");
    expect(failed.status).toBe("failed");
    expect(failed.error_message).toBe("boom");
  });

  it("throws for missing executions and emits execution events", () => {
    expect(() => executionService.fail("missing", "boom")).toThrow(
      ExecutionNotFoundError,
    );

    const execution = executionService.start(seedApprovedProposal().id);
    executionService.complete(execution.id, { summary: "Done" });
    const types = listLoopEvents().map((event) => event.type);
    expect(types).toContain("execution.started");
    expect(types).toContain("execution.completed");
  });
});
