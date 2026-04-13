import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const { createIntent: createRuntimeIntent, _resetInitForTest: resetRuntimeIntents } = await import(
  "../intents/service.js"
);
const { intentService } = await import("../intent/service.js");
const { proposalService, ProposalNotFoundError, ProposalStateError } = await import("./service.js");
const { listLoopEvents } = await import("../loop/events.js");
const { __resetExecutionsInit } = await import("../executions/executions.service.js");
const { resetLoopMigrationsForTests, runLoopMigrations } = await import(
  "../loop/migrations.js"
);

function resetTables(): void {
  memoryDb.exec(`
    DROP TABLE IF EXISTS execution_phase_transitions;
    DROP TABLE IF EXISTS executions;
    DROP TABLE IF EXISTS intent_events;
    DROP TABLE IF EXISTS intent_links;
    DROP TABLE IF EXISTS intent_phase_transitions;
    DROP TABLE IF EXISTS intents;
    DROP TABLE IF EXISTS loop_events;
    DROP TABLE IF EXISTS loop_artifacts;
    DROP TABLE IF EXISTS loop_executions;
    DROP TABLE IF EXISTS loop_proposals;
    DROP TABLE IF EXISTS loop_intents;
    DROP TABLE IF EXISTS service_migrations;
  `);
  resetRuntimeIntents();
  __resetExecutionsInit();
  resetLoopMigrationsForTests();
  runLoopMigrations(memoryDb);
}

function seedIntent() {
  return intentService.create({
    title: "Seed intent",
    description: "Need a proposal",
    source: "human",
    priority: "high",
    requested_by_actor_id: "actor_owner",
    scope: ["services/core/**"],
    constraints: ["keep it additive"],
    metadata: {},
  });
}

function seedRuntimeIntent() {
  return createRuntimeIntent({
    slug: "runtime-proposal-intent",
    title: "Runtime proposal intent",
    description: "Need a durable proposal in the active backend",
    level: "execution",
    status: "active",
    kind: "implement",
    actor_id: "actor_owner",
    exit_condition: "Execution completed with result evidence",
    scope: ["services/core/proposal/**"],
    metadata: {},
  });
}

beforeEach(() => {
  resetTables();
});

describe("ProposalService", () => {
  it("generates a proposal from an intent", () => {
    const intent = seedIntent();
    const proposal = proposalService.generate(intent.id);

    expect(proposal.intent_id).toBe(intent.id);
    expect(proposal.status).toBe("pending_approval");
    expect(proposal.plan_steps.length).toBeGreaterThan(0);
  });

  it("approves a pending proposal", () => {
    const proposal = proposalService.generate(seedIntent().id);
    const approved = proposalService.approve(proposal.id, "actor_reviewer");

    expect(approved.status).toBe("approved");
    expect(approved.approved_by_actor_id).toBe("actor_reviewer");
  });

  it("rejects a proposal with a reason", () => {
    const proposal = proposalService.generate(seedIntent().id);
    const rejected = proposalService.reject(
      proposal.id,
      "actor_reviewer",
      "Needs tighter scope",
    );

    expect(rejected.status).toBe("rejected");
    expect(rejected.rejection_reason).toBe("Needs tighter scope");
  });

  it("revises a proposal and supersedes the original", () => {
    const proposal = proposalService.generate(seedIntent().id);
    const revised = proposalService.revise(proposal.id, {
      summary: "Revised summary",
      plan_steps: ["step one", "step two"],
    });

    expect(revised.parent_proposal_id).toBe(proposal.id);
    expect(revised.revision).toBe(2);
    expect(revised.status).toBe("revised");
    expect(proposalService.get(proposal.id)?.status).toBe("superseded");
  });

  it("throws on invalid transitions and missing rows", () => {
    expect(() => proposalService.approve("missing", "actor_reviewer")).toThrow(
      ProposalNotFoundError,
    );

    const proposal = proposalService.generate(seedIntent().id);
    proposalService.approve(proposal.id, "actor_reviewer");
    expect(() =>
      proposalService.reject(proposal.id, "actor_reviewer", "too late"),
    ).toThrow(ProposalStateError);
    expect(listLoopEvents().filter((event) => event.type.startsWith("proposal.")).length).toBeGreaterThanOrEqual(2);
  });

  it("starts an execution for an approved runtime proposal", () => {
    const runtimeIntent = seedRuntimeIntent();
    const proposal = proposalService.generate(runtimeIntent.id);
    proposalService.approve(proposal.id, "actor_owner");

    const execution = proposalService.startExecution(proposal.id, {
      mode: "implement",
      title: "Ship the approved proposal",
    });

    expect(execution.proposal_id).toBe(proposal.id);
    expect(execution.intent_slug).toBe(runtimeIntent.id);
    expect(execution.title).toBe("Ship the approved proposal");
  });
});
