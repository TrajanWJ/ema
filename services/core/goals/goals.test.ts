import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const {
  __resetGoalsInit,
  completeGoal,
  createGoal,
  deleteGoal,
  getGoal,
  getGoalWithChildren,
  initGoals,
  listGoals,
  updateGoal,
} = await import("./goals.service.js");

beforeAll(() => {
  initGoals();
});

beforeEach(() => {
  memoryDb.exec("DROP TABLE IF EXISTS goals");
  __resetGoalsInit();
  initGoals();
});

describe("Goals / schema bootstrap", () => {
  it("creates the goals table", () => {
    const tables = memoryDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;

    expect(tables.map((row) => row.name)).toContain("goals");
  });
});

describe("Goals / CRUD", () => {
  it("creates and filters goals by owner and timeframe", () => {
    createGoal({
      title: "Ship quarterly slice",
      timeframe: "quarterly",
      owner_kind: "human",
      owner_id: "trajan",
      intent_slug: "int-recovery-wave-1",
    });
    createGoal({
      title: "Strategist weekly goal",
      timeframe: "weekly",
      owner_kind: "agent",
      owner_id: "strategist",
    });

    expect(listGoals()).toHaveLength(2);
    expect(listGoals({ owner_kind: "agent" })).toHaveLength(1);
    expect(listGoals({ owner_id: "strategist" })[0]?.title).toBe(
      "Strategist weekly goal",
    );
    expect(listGoals({ timeframe: "quarterly" })).toHaveLength(1);
  });

  it("updates status and linked fields", () => {
    const goal = createGoal({
      title: "Prepare buildout",
      timeframe: "monthly",
    });

    const updated = updateGoal(goal.id, {
      status: "completed",
      owner_kind: "agent",
      owner_id: "builder",
      success_criteria: "Execution and retro finished",
    });

    expect(updated.status).toBe("completed");
    expect(updated.owner_kind).toBe("agent");
    expect(updated.owner_id).toBe("builder");
    expect(updated.success_criteria).toBe("Execution and retro finished");
  });

  it("returns parent plus children context", () => {
    const parent = createGoal({
      title: "Parent goal",
      timeframe: "yearly",
    });
    createGoal({
      title: "Child goal",
      timeframe: "quarterly",
      parent_id: parent.id,
    });

    const payload = getGoalWithChildren(parent.id);
    expect(payload?.goal.id).toBe(parent.id);
    expect(payload?.children).toHaveLength(1);
    expect(payload?.children[0]?.title).toBe("Child goal");
  });

  it("completes and deletes goals", () => {
    const goal = createGoal({
      title: "Disposable goal",
      timeframe: "weekly",
    });

    expect(completeGoal(goal.id).status).toBe("completed");
    expect(deleteGoal(goal.id)).toBe(true);
    expect(getGoal(goal.id)).toBeNull();
  });
});
