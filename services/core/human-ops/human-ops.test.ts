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
  __resetGoalsInit,
  createGoal,
  initGoals,
} = await import("../goals/goals.service.js");
const {
  __resetCalendarInit,
  createCalendarEntry,
  initCalendar,
} = await import("../calendar/calendar.service.js");
const {
  __resetHumanOpsInit,
  getHumanOpsAgenda,
  getHumanOpsDailyBrief,
  getHumanOpsDay,
  initHumanOps,
  upsertHumanOpsDay,
} = await import("./service.js");
const {
  initUserState,
  updateUserState,
} = await import("../user-state/index.js");
const { applyUserStateDdl } = await import("../user-state/schema.js");

function applyTaskDdl(): void {
  memoryDb.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      priority INTEGER NOT NULL,
      source_type TEXT,
      source_id TEXT,
      effort TEXT,
      due_date TEXT,
      project_id TEXT,
      parent_id TEXT,
      completed_at TEXT,
      agent TEXT,
      intent TEXT,
      intent_confidence TEXT,
      intent_overridden INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      body TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function applyInboxDdl(): void {
  memoryDb.exec(`
    CREATE TABLE IF NOT EXISTS inbox_items (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT,
      processed INTEGER NOT NULL DEFAULT 0,
      action TEXT,
      processed_at TEXT,
      created_at TEXT NOT NULL,
      project_id TEXT
    );
  `);
}

function seedTask(params: {
  id: string;
  title: string;
  status: string;
  due_date?: string | null;
  priority?: number;
  completed_at?: string | null;
}): void {
  const now = "2026-04-13T09:00:00.000Z";
  memoryDb
    .prepare(
      `
        INSERT INTO tasks (
          id, title, description, status, priority, source_type, source_id, effort, due_date,
          project_id, parent_id, completed_at, agent, intent, intent_confidence, intent_overridden,
          created_at, updated_at
        ) VALUES (?, ?, NULL, ?, ?, NULL, NULL, NULL, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL, ?, ?)
      `,
    )
    .run(
      params.id,
      params.title,
      params.status,
      params.priority ?? 2,
      params.due_date ?? null,
      params.completed_at ?? null,
      now,
      now,
    );
}

function seedInboxItem(id: string, content: string, created_at: string): void {
  memoryDb
    .prepare(
      `
        INSERT INTO inbox_items (id, content, source, processed, action, processed_at, created_at, project_id)
        VALUES (?, ?, 'text', 0, NULL, NULL, ?, NULL)
      `,
    )
    .run(id, content, created_at);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-13T12:00:00.000Z"));
  memoryDb.exec(`
    DROP TABLE IF EXISTS human_ops_days;
    DROP TABLE IF EXISTS calendar_entries;
    DROP TABLE IF EXISTS goals;
    DROP TABLE IF EXISTS user_state_current;
    DROP TABLE IF EXISTS user_state_snapshots;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS task_comments;
    DROP TABLE IF EXISTS inbox_items;
  `);
  __resetGoalsInit();
  __resetCalendarInit();
  __resetHumanOpsInit();
  applyTaskDdl();
  applyInboxDdl();
  applyUserStateDdl(memoryDb);
  initGoals();
  initCalendar();
  initUserState();
  initHumanOps();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("human-ops / day + daily brief", () => {
  it("persists a day object and derives a daily brief from operational state", () => {
    const goal = createGoal({
      title: "Keep the day coherent",
      timeframe: "weekly",
      owner_kind: "human",
      owner_id: "self",
    });

    seedTask({
      id: "task_overdue",
      title: "Call the client back",
      status: "todo",
      due_date: "2026-04-12",
      priority: 4,
    });
    seedTask({
      id: "task_now",
      title: "Finish proposal review",
      status: "todo",
      priority: 3,
    });
    seedTask({
      id: "task_done",
      title: "Ship small fix",
      status: "done",
      priority: 2,
      completed_at: "2026-04-13T11:00:00.000Z",
    });

    seedInboxItem("inbox_1", "Need to respond to Alex", "2026-04-13T12:00:00.000Z");

    createCalendarEntry({
      id: "human_block",
      title: "Proposal focus block",
      entry_kind: "human_focus_block",
      owner_kind: "human",
      owner_id: "self",
      starts_at: "2026-04-13T14:00:00.000Z",
      ends_at: "2026-04-13T15:00:00.000Z",
      goal_id: goal.id,
    });
    createCalendarEntry({
      id: "agent_block",
      title: "Strategist review",
      entry_kind: "agent_virtual_block",
      owner_kind: "agent",
      owner_id: "strategist",
      starts_at: "2026-04-13T16:00:00.000Z",
      ends_at: "2026-04-13T17:00:00.000Z",
      phase: "review",
      goal_id: goal.id,
    });

    updateUserState({
      mode: "scattered",
      focus_score: 0.35,
      energy_score: 0.4,
      drift_score: 0.7,
      distress_flag: false,
      reason: "test_seed",
    });

    const savedDay = upsertHumanOpsDay("2026-04-13", {
      plan: "Do the proposal review, then follow up with Alex.",
      linked_goal_id: goal.id,
      now_task_id: "task_now",
      pinned_task_ids: ["task_now", "task_overdue"],
    });

    expect(savedDay.linked_goal_id).toBe(goal.id);
    expect(savedDay.now_task_id).toBe("task_now");

    const loadedDay = getHumanOpsDay("2026-04-13");
    expect(loadedDay).not.toBeNull();
    if (!loadedDay) return;
    expect(loadedDay.plan).toContain("proposal review");

    const brief = getHumanOpsDailyBrief("2026-04-13", "self");
    expect(brief.day.now_task_id).toBe("task_now");
    expect(brief.linked_goal?.id).toBe(goal.id);
    expect(brief.now_task?.title).toBe("Finish proposal review");
    expect(brief.pinned_tasks.map((task) => task.id)).toEqual(["task_now", "task_overdue"]);
    expect(brief.overdue_tasks.map((task) => task.id)).toContain("task_overdue");
    expect(brief.inbox).toHaveLength(1);
    expect(brief.human_schedule).toHaveLength(1);
    expect(brief.agent_schedule).toHaveLength(1);
    expect(brief.agent_schedule[0]?.owner_id).toBe("strategist");
    expect(brief.recent_wins[0]?.id).toBe("task_done");
    expect(brief.user_state.current.mode).toBe("scattered");
    expect(brief.recovery_items.length).toBeGreaterThan(0);
  });

  it("derives an agenda read model from the shared calendar ledger", () => {
    const goal = createGoal({
      title: "Protect the day",
      timeframe: "weekly",
      owner_kind: "human",
      owner_id: "self",
    });

    seedTask({
      id: "task_linked",
      title: "Prepare status memo",
      status: "todo",
      priority: 3,
    });

    createCalendarEntry({
      id: "human_due",
      title: "Status memo block",
      entry_kind: "human_focus_block",
      owner_kind: "human",
      owner_id: "self",
      starts_at: "2026-04-13T09:00:00.000Z",
      ends_at: "2026-04-13T10:00:00.000Z",
      goal_id: goal.id,
      task_id: "task_linked",
    });
    createCalendarEntry({
      id: "agent_execute",
      title: "Builder execute",
      entry_kind: "agent_virtual_block",
      owner_kind: "agent",
      owner_id: "builder",
      starts_at: "2026-04-13T11:30:00.000Z",
      ends_at: "2026-04-13T12:30:00.000Z",
      phase: "execute",
      goal_id: goal.id,
    });
    createCalendarEntry({
      id: "human_tomorrow",
      title: "Client follow-up",
      entry_kind: "human_commitment",
      owner_kind: "human",
      owner_id: "self",
      starts_at: "2026-04-14T15:00:00.000Z",
      ends_at: "2026-04-14T16:00:00.000Z",
    });

    const agenda = getHumanOpsAgenda("2026-04-13", 2, "self");
    expect(agenda.anchor_date).toBe("2026-04-13");
    expect(agenda.horizon_days).toBe(2);
    expect(agenda.days).toHaveLength(2);

    const today = agenda.days[0];
    expect(today?.human_count).toBe(1);
    expect(today?.agent_count).toBe(1);

    const dueItem = today?.entries.find((item) => item.entry.id === "human_due");
    expect(dueItem?.task?.title).toBe("Prepare status memo");
    expect(dueItem?.goal?.id).toBe(goal.id);
    expect(dueItem?.is_overdue).toBe(true);
    expect(dueItem?.is_today).toBe(true);

    const agentItem = today?.entries.find((item) => item.entry.id === "agent_execute");
    expect(agentItem?.is_happening_now).toBe(true);
    expect(agentItem?.entry.phase).toBe("execute");

    const tomorrow = agenda.days[1];
    expect(tomorrow?.date).toBe("2026-04-14");
    expect(tomorrow?.human_count).toBe(1);
    expect(tomorrow?.entries[0]?.entry.id).toBe("human_tomorrow");

    expect(agenda.at_risk_entries.map((item) => item.entry.id)).toEqual(["human_due"]);
  });
});
