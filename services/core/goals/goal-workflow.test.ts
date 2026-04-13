import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { createIntent: createRuntimeIntent, _resetInitForTest: resetRuntimeIntents } = await import(
  "../intents/service.js"
);
const { __resetExecutionsInit, completeExecution, transitionPhase } = await import(
  "../executions/executions.service.js"
);
const { __resetGoalsInit, createBuildoutForGoal, createGoal, createProposalForGoal, getGoalContext, startExecutionForGoal } =
  await import("./goals.service.js");
const { __resetCalendarInit, getBuildout, initCalendar } = await import(
  "../calendar/calendar.service.js"
);
const { proposalService } = await import("../proposal/service.js");
const { resetLoopMigrationsForTests, runLoopMigrations } = await import(
  "../loop/migrations.js"
);

function resetTables(): void {
  memoryDb.exec(`
    DROP TABLE IF EXISTS calendar_entries;
    DROP TABLE IF EXISTS goals;
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
  __resetGoalsInit();
  __resetCalendarInit();
  resetLoopMigrationsForTests();
  runLoopMigrations(memoryDb);
  initCalendar();
}

beforeEach(() => {
  resetTables();
});

describe("Goal workflow / proposal -> buildout -> execution", () => {
  it("creates a coherent workflow and syncs buildout status from execution phase/completion", () => {
    const intent = createRuntimeIntent({
      slug: "goal-workflow-intent",
      title: "Goal workflow intent",
      description: "Drive the full planning loop",
      level: "execution",
      status: "active",
      kind: "implement",
      actor_id: "actor_owner",
      exit_condition: "Execution completed",
      scope: ["services/core/goals/**"],
      metadata: {},
    });

    const goal = createGoal({
      title: "Integrated goal",
      timeframe: "weekly",
      owner_kind: "agent",
      owner_id: "strategist",
      intent_slug: intent.id,
    });

    const proposal = createProposalForGoal(goal.id, {
      actor_id: "strategist",
    });
    expect(proposal.metadata.goal_id).toBe(goal.id);
    proposalService.approve(proposal.id, "actor_owner");

    const buildout = createBuildoutForGoal(goal.id, {
      start_at: "2026-04-13T16:00:00.000Z",
      plan_minutes: 30,
      execute_minutes: 120,
      review_minutes: 45,
      retro_minutes: 15,
    });
    expect(buildout.entries).toHaveLength(4);

    const execution = startExecutionForGoal(goal.id, {
      buildout_id: buildout.buildout_id,
      mode: "implement",
      title: "Execute integrated goal",
    });

    expect(execution.proposal_id).toBe(proposal.id);

    const boundBuildout = getBuildout(buildout.buildout_id);
    expect(boundBuildout?.entries.every((entry) => entry.execution_id === execution.id)).toBe(
      true,
    );

    transitionPhase(execution.id, { to: "idle", reason: "execution bootstrapped" });
    transitionPhase(execution.id, { to: "plan", reason: "start planning" });
    let context = getGoalContext(goal.id);
    expect(context?.active_buildouts[0]?.entries.map((entry) => entry.status)).toEqual([
      "in_progress",
      "scheduled",
      "scheduled",
      "scheduled",
    ]);

    transitionPhase(execution.id, { to: "execute", reason: "do the work" });
    context = getGoalContext(goal.id);
    expect(context?.active_buildouts[0]?.entries.map((entry) => entry.status)).toEqual([
      "completed",
      "in_progress",
      "scheduled",
      "scheduled",
    ]);

    completeExecution(execution.id, {
      result_summary: "done",
    });
    context = getGoalContext(goal.id);
    expect(context?.active_buildouts[0]?.entries.every((entry) => entry.status === "completed")).toBe(
      true,
    );
    expect(context?.proposals).toHaveLength(1);
    expect(context?.executions).toHaveLength(1);
    expect(context?.calendar_entries).toHaveLength(4);
  });
});
