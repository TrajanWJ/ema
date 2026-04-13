import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const { __resetGoalsInit, createGoal, initGoals } = await import(
  "../goals/goals.service.js"
);
const {
  __resetCalendarInit,
  createAgentBuildout,
  createCalendarEntry,
  deleteCalendarEntry,
  getCalendarEntry,
  initCalendar,
  listCalendarEntries,
  updateCalendarEntry,
} = await import("./calendar.service.js");

beforeAll(() => {
  initGoals();
  initCalendar();
});

beforeEach(() => {
  memoryDb.exec("DROP TABLE IF EXISTS calendar_entries");
  memoryDb.exec("DROP TABLE IF EXISTS goals");
  __resetGoalsInit();
  __resetCalendarInit();
  initGoals();
  initCalendar();
});

describe("Calendar / schema bootstrap", () => {
  it("creates the calendar_entries table", () => {
    const tables = memoryDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;

    expect(tables.map((row) => row.name)).toContain("calendar_entries");
  });
});

describe("Calendar / CRUD", () => {
  it("creates and filters human schedule and agent blocks", () => {
    createCalendarEntry({
      title: "Human review",
      entry_kind: "human_commitment",
      owner_kind: "human",
      owner_id: "trajan",
      starts_at: "2026-04-13T14:00:00.000Z",
      ends_at: "2026-04-13T15:00:00.000Z",
    });
    createCalendarEntry({
      title: "Builder execute block",
      entry_kind: "agent_virtual_block",
      owner_kind: "agent",
      owner_id: "builder",
      phase: "execute",
      starts_at: "2026-04-13T15:00:00.000Z",
      ends_at: "2026-04-13T18:00:00.000Z",
    });

    expect(listCalendarEntries()).toHaveLength(2);
    expect(listCalendarEntries({ owner_kind: "agent" })).toHaveLength(1);
    expect(listCalendarEntries({ entry_kind: "human_commitment" })).toHaveLength(1);
  });

  it("updates and deletes a calendar entry", () => {
    const entry = createCalendarEntry({
      title: "Agent plan block",
      entry_kind: "agent_virtual_block",
      owner_kind: "agent",
      owner_id: "strategist",
      phase: "plan",
      starts_at: "2026-04-13T10:00:00.000Z",
      ends_at: "2026-04-13T11:00:00.000Z",
    });

    const updated = updateCalendarEntry(entry.id, {
      status: "completed",
      phase: "review",
    });

    expect(updated.status).toBe("completed");
    expect(updated.phase).toBe("review");
    expect(deleteCalendarEntry(entry.id)).toBe(true);
    expect(getCalendarEntry(entry.id)).toBeNull();
  });

  it("persists task linkage for agenda context", () => {
    const entry = createCalendarEntry({
      title: "Write the draft",
      entry_kind: "human_focus_block",
      owner_kind: "human",
      owner_id: "self",
      starts_at: "2026-04-13T13:00:00.000Z",
      ends_at: "2026-04-13T14:00:00.000Z",
      task_id: "task_alpha",
    });

    expect(entry.task_id).toBe("task_alpha");

    const updated = updateCalendarEntry(entry.id, {
      task_id: "task_beta",
      status: "in_progress",
    });

    expect(updated.task_id).toBe("task_beta");
    expect(getCalendarEntry(entry.id)?.task_id).toBe("task_beta");
  });
});

describe("Calendar / phased buildouts", () => {
  it("creates a 4-phase agent buildout linked to a goal", () => {
    const goal = createGoal({
      title: "Ship planning slice",
      timeframe: "quarterly",
      owner_kind: "agent",
      owner_id: "strategist",
      intent_slug: "int-recovery-wave-1",
    });

    const buildout = createAgentBuildout({
      goal_id: goal.id,
      owner_id: "strategist",
      start_at: "2026-04-13T16:00:00.000Z",
      plan_minutes: 30,
      execute_minutes: 120,
      review_minutes: 45,
      retro_minutes: 15,
    });

    expect(buildout.entries).toHaveLength(4);
    expect(buildout.entries.map((entry) => entry.phase)).toEqual([
      "plan",
      "execute",
      "review",
      "retro",
    ]);
    expect(new Set(buildout.entries.map((entry) => entry.buildout_id))).toEqual(
      new Set([buildout.buildout_id]),
    );
    expect(buildout.entries[0]?.goal_id).toBe(goal.id);
    expect(buildout.entries[0]?.intent_slug).toBe("int-recovery-wave-1");
  });
});
