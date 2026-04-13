import { getDb } from "../../persistence/db.js";
import { listInboxItems, type InboxItemRecord } from "../brain-dump/brain-dump.service.js";
import { listCalendarEntries, type CalendarEntryRecord } from "../calendar/calendar.service.js";
import { getGoal, listGoals, type GoalRecord } from "../goals/goals.service.js";
import { getTask, listTasks, type TaskRecord } from "../tasks/tasks.service.js";
import {
  getCurrentUserState,
  getUserStateHistory,
  type UserStateHistoryEntry,
} from "../user-state/index.js";
import {
  humanOpsDateSchema,
  humanOpsDaySchema,
  type HumanOpsDay,
  type HumanOpsDayUpdate,
} from "@ema/shared/schemas";

import { applyHumanOpsDdl } from "./schema.js";

type DbRow = Record<string, unknown>;

export interface HumanOpsDayRecord extends HumanOpsDay {}

export interface UpdateHumanOpsDayInput extends HumanOpsDayUpdate {}

export interface HumanOpsAgentScheduleGroup {
  owner_id: string;
  entries: CalendarEntryRecord[];
}

export interface HumanOpsDailyBriefRecord {
  date: string;
  day: HumanOpsDayRecord;
  inbox: InboxItemRecord[];
  actionable_tasks: TaskRecord[];
  overdue_tasks: TaskRecord[];
  pinned_tasks: TaskRecord[];
  suggested_tasks: TaskRecord[];
  now_task: TaskRecord | null;
  recent_wins: TaskRecord[];
  active_goals: GoalRecord[];
  linked_goal: GoalRecord | null;
  human_schedule: CalendarEntryRecord[];
  agent_schedule: HumanOpsAgentScheduleGroup[];
  user_state: {
    current: ReturnType<typeof getCurrentUserState>;
    history: UserStateHistoryEntry[];
  };
  next_action_label: string;
  recovery_items: string[];
  commitments_at_risk: CalendarEntryRecord[];
}

export interface HumanOpsAgendaItemRecord {
  date: string;
  entry: CalendarEntryRecord;
  goal: GoalRecord | null;
  task: TaskRecord | null;
  is_today: boolean;
  is_overdue: boolean;
  is_happening_now: boolean;
}

export interface HumanOpsAgendaDayRecord {
  date: string;
  is_today: boolean;
  human_count: number;
  agent_count: number;
  entries: HumanOpsAgendaItemRecord[];
}

export interface HumanOpsAgendaRecord {
  anchor_date: string;
  horizon_days: number;
  days: HumanOpsAgendaDayRecord[];
  at_risk_entries: HumanOpsAgendaItemRecord[];
}

let initialised = false;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeDate(date: string): string {
  const normalized = humanOpsDateSchema.parse(date);
  const [year, month, day] = normalized.split("-").map((part) => Number(part));
  const candidate = new Date(`${normalized}T00:00:00.000Z`);
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error("human_ops_invalid_date");
  }
  return normalized;
}

function parsePinnedTaskIds(value: unknown): string[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0,
    );
  } catch {
    return [];
  }
}

function serializePinnedTaskIds(taskIds: readonly string[]): string {
  return JSON.stringify([...new Set(taskIds)]);
}

function startOfDayIso(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function endOfDayIso(date: string): string {
  return `${date}T23:59:59.999Z`;
}

function addDays(date: string, days: number): string {
  const anchor = new Date(`${date}T00:00:00.000Z`);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return anchor.toISOString().slice(0, 10);
}

function isOpenTask(status: string): boolean {
  return [
    "proposed",
    "todo",
    "in_progress",
    "blocked",
    "in_review",
    "requires_proposal",
  ].includes(status);
}

function parseDueTime(value: string | null): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const candidate =
    /^\d{4}-\d{2}-\d{2}$/u.test(value) ? new Date(`${value}T23:59:59.999Z`) : new Date(value);
  const time = candidate.getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function sortTasksForDay(tasks: readonly TaskRecord[]): TaskRecord[] {
  return [...tasks].sort((left, right) => {
    const dueCompare = parseDueTime(left.due_date) - parseDueTime(right.due_date);
    if (dueCompare !== 0) return dueCompare;
    if (left.priority !== right.priority) return right.priority - left.priority;
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

function mapDay(row: DbRow | undefined): HumanOpsDayRecord | null {
  if (!row) return null;

  const parsed = humanOpsDaySchema.safeParse({
    date: String(row.date),
    plan: typeof row.plan === "string" ? row.plan : "",
    linked_goal_id:
      typeof row.linked_goal_id === "string" ? row.linked_goal_id : null,
    now_task_id: typeof row.now_task_id === "string" ? row.now_task_id : null,
    pinned_task_ids: parsePinnedTaskIds(row.pinned_task_ids),
    review_note: typeof row.review_note === "string" ? row.review_note : "",
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  });

  if (!parsed.success) return null;
  return parsed.data;
}

function getRow(date: string): DbRow | undefined {
  const row = getDb()
    .prepare("SELECT * FROM human_ops_days WHERE date = ?")
    .get(date) as DbRow | undefined;
  return row;
}

export function initHumanOps(): void {
  if (initialised) return;
  applyHumanOpsDdl(getDb());
  initialised = true;
}

export function __resetHumanOpsInit(): void {
  initialised = false;
}

export function getHumanOpsDay(date: string): HumanOpsDayRecord | null {
  initHumanOps();
  const normalizedDate = normalizeDate(date);
  return mapDay(getRow(normalizedDate));
}

export function ensureHumanOpsDay(date: string): HumanOpsDayRecord {
  initHumanOps();
  const normalizedDate = normalizeDate(date);
  const existing = getHumanOpsDay(normalizedDate);
  if (existing) return existing;

  const now = nowIso();
  getDb()
    .prepare(
      `
        INSERT INTO human_ops_days (
          date, plan, linked_goal_id, now_task_id, pinned_task_ids,
          review_note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(normalizedDate, "", null, null, "[]", "", now, now);

  return getHumanOpsDay(normalizedDate) as HumanOpsDayRecord;
}

export function upsertHumanOpsDay(
  date: string,
  input: UpdateHumanOpsDayInput = {},
): HumanOpsDayRecord {
  initHumanOps();
  const normalizedDate = normalizeDate(date);
  const existing = getHumanOpsDay(normalizedDate);
  const now = nowIso();

  const next = {
    plan: input.plan ?? existing?.plan ?? "",
    linked_goal_id:
      input.linked_goal_id !== undefined
        ? input.linked_goal_id
        : existing?.linked_goal_id ?? null,
    now_task_id:
      input.now_task_id !== undefined ? input.now_task_id : existing?.now_task_id ?? null,
    pinned_task_ids:
      input.pinned_task_ids !== undefined
        ? [...new Set(input.pinned_task_ids)]
        : existing?.pinned_task_ids ?? [],
    review_note: input.review_note ?? existing?.review_note ?? "",
  };

  if (existing) {
    getDb()
      .prepare(
        `
          UPDATE human_ops_days
          SET plan = ?, linked_goal_id = ?, now_task_id = ?, pinned_task_ids = ?,
              review_note = ?, updated_at = ?
          WHERE date = ?
        `,
      )
      .run(
        next.plan,
        next.linked_goal_id,
        next.now_task_id,
        serializePinnedTaskIds(next.pinned_task_ids),
        next.review_note,
        now,
        normalizedDate,
      );
  } else {
    getDb()
      .prepare(
        `
          INSERT INTO human_ops_days (
            date, plan, linked_goal_id, now_task_id, pinned_task_ids,
            review_note, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        normalizedDate,
        next.plan,
        next.linked_goal_id,
        next.now_task_id,
        serializePinnedTaskIds(next.pinned_task_ids),
        next.review_note,
        now,
        now,
      );
  }

  return getHumanOpsDay(normalizedDate) as HumanOpsDayRecord;
}

export function getHumanOpsDailyBrief(
  date: string,
  ownerId = "self",
): HumanOpsDailyBriefRecord {
  initHumanOps();
  const normalizedDate = normalizeDate(date);
  const day = ensureHumanOpsDay(normalizedDate);
  const inbox = listInboxItems().filter((item) => !item.processed);
  const actionableTasks = sortTasksForDay(listTasks().filter((task) => isOpenTask(task.status)));
  const overdueCutoff = endOfDayIso(normalizedDate);
  const overdueTasks = actionableTasks.filter(
    (task) => task.due_date !== null && parseDueTime(task.due_date) < new Date(overdueCutoff).getTime(),
  );
  const pinnedTasks = day.pinned_task_ids
    .map((taskId) => actionableTasks.find((task) => task.id === taskId) ?? null)
    .filter((task): task is TaskRecord => task !== null);
  const suggestedTasks = actionableTasks.filter((task) => !day.pinned_task_ids.includes(task.id)).slice(0, 5);
  const nowTask = day.now_task_id
    ? actionableTasks.find((task) => task.id === day.now_task_id) ?? null
    : null;
  const recentWins = [...listTasks()]
    .filter((task) => task.status === "done" && task.completed_at)
    .sort(
      (left, right) =>
        new Date(right.completed_at ?? right.created_at).getTime() -
        new Date(left.completed_at ?? left.created_at).getTime(),
    )
    .slice(0, 5);
  const activeGoals = listGoals({
    status: "active",
    owner_kind: "human",
    owner_id: ownerId,
  });
  const linkedGoal = day.linked_goal_id ? getGoal(day.linked_goal_id) : null;
  const humanSchedule = listCalendarEntries({
    owner_kind: "human",
    owner_id: ownerId,
    from: startOfDayIso(normalizedDate),
    to: endOfDayIso(normalizedDate),
  });
  const agentEntries = listCalendarEntries({
    owner_kind: "agent",
    from: startOfDayIso(normalizedDate),
    to: endOfDayIso(normalizedDate),
  });
  const groupedAgentSchedule = new Map<string, CalendarEntryRecord[]>();
  for (const entry of agentEntries) {
    const current = groupedAgentSchedule.get(entry.owner_id) ?? [];
    current.push(entry);
    groupedAgentSchedule.set(entry.owner_id, current);
  }
  const agentSchedule = [...groupedAgentSchedule.entries()].map(([agentOwnerId, entries]) => ({
    owner_id: agentOwnerId,
    entries,
  }));
  const userStateCurrent = getCurrentUserState();
  const userStateHistory = getUserStateHistory({ limit: 8 });
  const nextActionLabel =
    nowTask?.title ??
    overdueTasks[0]?.title ??
    pinnedTasks[0]?.title ??
    suggestedTasks[0]?.title ??
    "Process the inbox";
  const commitmentsAtRisk = humanSchedule.filter(
    (entry) =>
      entry.status === "scheduled" &&
      new Date(entry.starts_at).getTime() < Date.now(),
  );

  const recoveryItems: string[] = [];
  if (userStateCurrent.distress_flag || userStateCurrent.mode === "crisis") {
    recoveryItems.push("Reduce scope to one task and renegotiate the rest.");
  }
  if (userStateCurrent.mode === "scattered") {
    recoveryItems.push("Re-pick the current task before switching surfaces.");
  }
  if (overdueTasks.length > 0) {
    recoveryItems.push(
      `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"} need rescoping or completion.`,
    );
  }
  if (inbox.length >= 5) {
    recoveryItems.push(`Inbox has ${inbox.length} loose item${inbox.length === 1 ? "" : "s"} to process.`);
  }
  if (!nowTask && actionableTasks.length > 0) {
    recoveryItems.push("Pick one current task so the day can narrow.");
  }
  if (humanSchedule.length === 0) {
    recoveryItems.push("No human commitment block exists for the day yet.");
  }

  return {
    date: normalizedDate,
    day,
    inbox,
    actionable_tasks: actionableTasks,
    overdue_tasks: overdueTasks,
    pinned_tasks: pinnedTasks,
    suggested_tasks: suggestedTasks,
    now_task: nowTask,
    recent_wins: recentWins,
    active_goals: activeGoals,
    linked_goal: linkedGoal,
    human_schedule: humanSchedule,
    agent_schedule: agentSchedule,
    user_state: {
      current: userStateCurrent,
      history: userStateHistory,
    },
    next_action_label: nextActionLabel,
    recovery_items: recoveryItems,
    commitments_at_risk: commitmentsAtRisk,
  };
}

export function getHumanOpsAgenda(
  date: string,
  days = 7,
  ownerId = "self",
): HumanOpsAgendaRecord {
  initHumanOps();
  const anchorDate = normalizeDate(date);
  const horizonDays = Math.max(1, Math.min(14, Math.floor(days)));
  const endDate = addDays(anchorDate, horizonDays - 1);
  const now = Date.now();

  const entries = listCalendarEntries({
    from: startOfDayIso(anchorDate),
    to: endOfDayIso(endDate),
  }).filter(
    (entry) =>
      entry.owner_kind === "agent" ||
      (entry.owner_kind === "human" && entry.owner_id === ownerId),
  );

  const items: HumanOpsAgendaItemRecord[] = entries.map((entry) => {
    const entryDate = entry.starts_at.slice(0, 10);
    const goal = entry.goal_id ? getGoal(entry.goal_id) : null;
    const task = entry.task_id ? getTask(entry.task_id) : null;
    const startTime = new Date(entry.starts_at).getTime();
    const endTime = entry.ends_at ? new Date(entry.ends_at).getTime() : startTime;

    return {
      date: entryDate,
      entry,
      goal,
      task,
      is_today: entryDate === anchorDate,
      is_overdue:
        entry.status === "scheduled" &&
        entry.owner_kind === "human" &&
        startTime < now,
      is_happening_now:
        entry.status !== "completed" &&
        entry.status !== "cancelled" &&
        startTime <= now &&
        endTime >= now,
    };
  });

  const atRiskEntries = items.filter((item) => item.is_overdue);
  const dayMap = new Map<string, HumanOpsAgendaItemRecord[]>();
  for (const item of items) {
    const bucket = dayMap.get(item.date) ?? [];
    bucket.push(item);
    dayMap.set(item.date, bucket);
  }

  const daysOut: HumanOpsAgendaDayRecord[] = [];
  for (let index = 0; index < horizonDays; index += 1) {
    const currentDate = addDays(anchorDate, index);
    const dayItems = [...(dayMap.get(currentDate) ?? [])].sort(
      (left, right) =>
        new Date(left.entry.starts_at).getTime() - new Date(right.entry.starts_at).getTime(),
    );
    daysOut.push({
      date: currentDate,
      is_today: currentDate === anchorDate,
      human_count: dayItems.filter((item) => item.entry.owner_kind === "human").length,
      agent_count: dayItems.filter((item) => item.entry.owner_kind === "agent").length,
      entries: dayItems,
    });
  }

  return {
    anchor_date: anchorDate,
    horizon_days: horizonDays,
    days: daysOut,
    at_risk_entries: atRiskEntries,
  };
}
