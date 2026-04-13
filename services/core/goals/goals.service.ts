import { EventEmitter } from "node:events";

import { nanoid } from "nanoid";

import {
  goalSchema,
  goalStatusSchema,
  goalTimeframeSchema,
  goalOwnerKindSchema,
  type Goal,
  type GoalOwnerKind,
  type GoalStatus,
  type GoalTimeframe,
} from "@ema/shared/schemas";

import {
  bindExecutionToBuildout,
  createAgentBuildout,
  getBuildout,
  listCalendarEntries,
  type BuildoutRecord,
} from "../calendar/calendar.service.js";
import {
  createExecutionFromIntent,
  type CreateExecutionFromIntentInput,
  type ExecutionRecord,
  listExecutions,
} from "../executions/executions.service.js";
import { getDb } from "../../persistence/db.js";
import { proposalService } from "../proposal/service.js";
import { applyGoalsDdl } from "./schema.js";

type DbRow = Record<string, unknown>;

export interface GoalRecord extends Goal {}

export interface GoalFilters {
  status?: GoalStatus | undefined;
  timeframe?: GoalTimeframe | undefined;
  owner_kind?: GoalOwnerKind | undefined;
  owner_id?: string | undefined;
  project_id?: string | undefined;
  parent_id?: string | undefined;
  intent_slug?: string | undefined;
}

export interface CreateGoalInput {
  title: string;
  description?: string | null | undefined;
  timeframe: GoalTimeframe;
  status?: GoalStatus | undefined;
  owner_kind?: GoalOwnerKind | undefined;
  owner_id?: string | undefined;
  parent_id?: string | null | undefined;
  project_id?: string | null | undefined;
  space_id?: string | null | undefined;
  intent_slug?: string | null | undefined;
  target_date?: string | null | undefined;
  success_criteria?: string | null | undefined;
  id?: string | undefined;
}

export interface UpdateGoalInput {
  title?: string | undefined;
  description?: string | null | undefined;
  timeframe?: GoalTimeframe | undefined;
  status?: GoalStatus | undefined;
  owner_kind?: GoalOwnerKind | undefined;
  owner_id?: string | undefined;
  parent_id?: string | null | undefined;
  project_id?: string | null | undefined;
  space_id?: string | null | undefined;
  intent_slug?: string | null | undefined;
  target_date?: string | null | undefined;
  success_criteria?: string | null | undefined;
}

export interface GoalContextRecord {
  goal: GoalRecord;
  children: GoalRecord[];
  proposals: ReturnType<typeof proposalService.list>;
  executions: ExecutionRecord[];
  calendar_entries: ReturnType<typeof listCalendarEntries>;
  active_buildouts: BuildoutRecord[];
}

export interface CreateGoalProposalInput {
  actor_id?: string | undefined;
  title?: string | undefined;
  summary?: string | undefined;
  rationale?: string | undefined;
  plan_steps?: string[] | undefined;
}

export interface StartGoalExecutionInput {
  proposal_id?: string | null | undefined;
  buildout_id?: string | null | undefined;
  title?: string | undefined;
  objective?: string | null | undefined;
  mode?: string | undefined;
  requires_approval?: boolean | undefined;
  project_slug?: string | null | undefined;
  space_id?: string | null | undefined;
}

export interface CreateGoalBuildoutInput {
  owner_id?: string | undefined;
  start_at: string;
  title?: string | undefined;
  description?: string | null | undefined;
  plan_minutes?: number | undefined;
  execute_minutes?: number | undefined;
  review_minutes?: number | undefined;
  retro_minutes?: number | undefined;
}

export type GoalsEvent =
  | { type: "goal:created"; goal: GoalRecord }
  | { type: "goal:updated"; goal: GoalRecord }
  | { type: "goal:deleted"; id: string };

export const goalsEvents = new EventEmitter();

let initialised = false;

export class GoalNotFoundError extends Error {
  public readonly code = "goal_not_found";
  constructor(public readonly ref: string) {
    super(`Goal not found: ${ref}`);
    this.name = "GoalNotFoundError";
  }
}

export class GoalProposalNotFoundError extends Error {
  public readonly code = "goal_proposal_not_found";
  constructor(
    public readonly goalId: string,
    public readonly proposalId: string,
  ) {
    super(`Proposal ${proposalId} is not linked to goal ${goalId}`);
    this.name = "GoalProposalNotFoundError";
  }
}

export class GoalBuildoutNotFoundError extends Error {
  public readonly code = "goal_buildout_not_found";
  constructor(
    public readonly goalId: string,
    public readonly buildoutId: string,
  ) {
    super(`Buildout ${buildoutId} is not linked to goal ${goalId}`);
    this.name = "GoalBuildoutNotFoundError";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapGoal(row: DbRow | undefined): GoalRecord | null {
  if (!row) return null;

  const parsed = goalSchema.safeParse({
    id: String(row.id),
    title: String(row.title),
    description: typeof row.description === "string" ? row.description : null,
    timeframe: String(row.timeframe),
    status: String(row.status),
    owner_kind: String(row.owner_kind),
    owner_id: String(row.owner_id),
    parent_id: typeof row.parent_id === "string" ? row.parent_id : null,
    project_id: typeof row.project_id === "string" ? row.project_id : null,
    space_id: typeof row.space_id === "string" ? row.space_id : null,
    intent_slug: typeof row.intent_slug === "string" ? row.intent_slug : null,
    target_date: typeof row.target_date === "string" ? row.target_date : null,
    success_criteria:
      typeof row.success_criteria === "string" ? row.success_criteria : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  });

  if (!parsed.success) return null;
  return parsed.data;
}

export function initGoals(): void {
  if (initialised) return;
  applyGoalsDdl(getDb());
  initialised = true;
}

export function __resetGoalsInit(): void {
  initialised = false;
}

export function listGoals(filters: GoalFilters = {}): GoalRecord[] {
  initGoals();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }

  if (filters.timeframe) {
    clauses.push("timeframe = ?");
    params.push(filters.timeframe);
  }

  if (filters.owner_kind) {
    clauses.push("owner_kind = ?");
    params.push(filters.owner_kind);
  }

  if (filters.owner_id) {
    clauses.push("owner_id = ?");
    params.push(filters.owner_id);
  }

  if (filters.project_id) {
    clauses.push("project_id = ?");
    params.push(filters.project_id);
  }

  if (filters.parent_id) {
    clauses.push("parent_id = ?");
    params.push(filters.parent_id);
  }

  if (filters.intent_slug) {
    clauses.push("intent_slug = ?");
    params.push(filters.intent_slug);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(
      `SELECT * FROM goals ${whereSql} ORDER BY
        CASE timeframe
          WHEN 'weekly' THEN 1
          WHEN 'monthly' THEN 2
          WHEN 'quarterly' THEN 3
          WHEN 'yearly' THEN 4
          WHEN '3year' THEN 5
          ELSE 6
        END ASC,
        updated_at DESC,
        created_at DESC`,
    )
    .all(...params) as DbRow[];

  return rows
    .map((row) => mapGoal(row))
    .filter((goal): goal is GoalRecord => goal !== null);
}

export function getGoal(ref: string): GoalRecord | null {
  initGoals();
  const row = getDb()
    .prepare("SELECT * FROM goals WHERE id = ?")
    .get(ref) as DbRow | undefined;
  return mapGoal(row);
}

export function getGoalWithChildren(ref: string): {
  goal: GoalRecord;
  children: GoalRecord[];
} | null {
  const goal = getGoal(ref);
  if (!goal) return null;
  return {
    goal,
    children: listGoals({ parent_id: goal.id }),
  };
}

export function getGoalContext(ref: string): GoalContextRecord | null {
  const base = getGoalWithChildren(ref);
  if (!base) return null;

  const proposals = base.goal.intent_slug
    ? proposalService
        .list({ intent_id: base.goal.intent_slug })
        .filter((proposal) => {
          const goalId = proposal.metadata?.goal_id;
          return goalId === undefined || goalId === base.goal.id;
        })
    : [];

  const proposalIds = new Set(proposals.map((proposal) => proposal.id));
  const executions = base.goal.intent_slug
    ? listExecutions({ intent_slug: base.goal.intent_slug }).filter((execution) => {
        if (execution.proposal_id) {
          if (proposalIds.has(execution.proposal_id)) return true;
          return proposals.length === 0;
        }
        return true;
      })
    : [];

  const calendarEntries = listCalendarEntries({
    goal_id: base.goal.id,
  });
  const buildoutIds = new Set(
    calendarEntries
      .map((entry) => entry.buildout_id)
      .filter((buildoutId): buildoutId is string => Boolean(buildoutId)),
  );
  const activeBuildouts = [...buildoutIds]
    .map((buildoutId) => getBuildout(buildoutId))
    .filter((buildout): buildout is BuildoutRecord => buildout !== null);

  return {
    ...base,
    proposals,
    executions,
    calendar_entries: calendarEntries,
    active_buildouts: activeBuildouts,
  };
}

function normalizeOptionalDatetime(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return value;
}

function toExecutionStartInput(
  input: StartGoalExecutionInput,
  fallbackSpaceId: string | null,
): {
  title?: string | undefined;
  objective?: string | null | undefined;
  mode?: string | undefined;
  requires_approval?: boolean | undefined;
  project_slug?: string | null | undefined;
  space_id?: string | null | undefined;
} {
  return {
    ...(input.title ? { title: input.title } : {}),
    ...(input.objective !== undefined ? { objective: input.objective } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.requires_approval !== undefined
      ? { requires_approval: input.requires_approval }
      : {}),
    ...(input.project_slug !== undefined
      ? { project_slug: input.project_slug }
      : {}),
    ...(input.space_id !== undefined
      ? { space_id: input.space_id }
      : fallbackSpaceId
        ? { space_id: fallbackSpaceId }
        : {}),
  };
}

export function createGoal(input: CreateGoalInput): GoalRecord {
  initGoals();

  goalTimeframeSchema.parse(input.timeframe);
  if (input.status) goalStatusSchema.parse(input.status);
  if (input.owner_kind) goalOwnerKindSchema.parse(input.owner_kind);
  if (input.target_date) {
    if (Number.isNaN(new Date(input.target_date).getTime())) {
      throw new Error("invalid_goal_target_date");
    }
  }

  const id = input.id ?? `goal_${nanoid()}`;
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO goals (
        id, title, description, timeframe, status, owner_kind, owner_id,
        parent_id, project_id, space_id, intent_slug, target_date,
        success_criteria, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.title,
      input.description ?? null,
      input.timeframe,
      input.status ?? "active",
      input.owner_kind ?? "human",
      input.owner_id ?? "owner",
      input.parent_id ?? null,
      input.project_id ?? null,
      input.space_id ?? null,
      input.intent_slug ?? null,
      normalizeOptionalDatetime(input.target_date),
      input.success_criteria ?? null,
      now,
      now,
    );

  const goal = getGoal(id);
  if (!goal) throw new Error("goal_create_failed");
  goalsEvents.emit("goal:created", { type: "goal:created", goal } satisfies GoalsEvent);
  return goal;
}

export function updateGoal(ref: string, input: UpdateGoalInput): GoalRecord {
  initGoals();
  const existing = getGoal(ref);
  if (!existing) throw new GoalNotFoundError(ref);

  const next = {
    title: input.title ?? existing.title,
    description: input.description === undefined ? existing.description : input.description,
    timeframe: input.timeframe ?? existing.timeframe,
    status: input.status ?? existing.status,
    owner_kind: input.owner_kind ?? existing.owner_kind,
    owner_id: input.owner_id ?? existing.owner_id,
    parent_id: input.parent_id === undefined ? existing.parent_id : input.parent_id,
    project_id: input.project_id === undefined ? existing.project_id : input.project_id,
    space_id: input.space_id === undefined ? existing.space_id : input.space_id,
    intent_slug: input.intent_slug === undefined ? existing.intent_slug : input.intent_slug,
    target_date:
      input.target_date === undefined ? existing.target_date : normalizeOptionalDatetime(input.target_date),
    success_criteria:
      input.success_criteria === undefined
        ? existing.success_criteria
        : input.success_criteria,
  };

  goalTimeframeSchema.parse(next.timeframe);
  goalStatusSchema.parse(next.status);
  goalOwnerKindSchema.parse(next.owner_kind);
  if (next.target_date && Number.isNaN(new Date(next.target_date).getTime())) {
    throw new Error("invalid_goal_target_date");
  }

  getDb()
    .prepare(
      `UPDATE goals
       SET title = ?, description = ?, timeframe = ?, status = ?, owner_kind = ?, owner_id = ?,
           parent_id = ?, project_id = ?, space_id = ?, intent_slug = ?, target_date = ?,
           success_criteria = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.title,
      next.description,
      next.timeframe,
      next.status,
      next.owner_kind,
      next.owner_id,
      next.parent_id,
      next.project_id,
      next.space_id,
      next.intent_slug,
      next.target_date,
      next.success_criteria,
      nowIso(),
      existing.id,
    );

  const goal = getGoal(existing.id);
  if (!goal) throw new Error("goal_update_failed");
  goalsEvents.emit("goal:updated", { type: "goal:updated", goal } satisfies GoalsEvent);
  return goal;
}

export function completeGoal(ref: string): GoalRecord {
  return updateGoal(ref, { status: "completed" });
}

export function createProposalForGoal(
  ref: string,
  input: CreateGoalProposalInput = {},
) {
  const goal = getGoal(ref);
  if (!goal) throw new GoalNotFoundError(ref);
  if (!goal.intent_slug) throw new Error("goal_intent_required");

  return proposalService.generate(goal.intent_slug, {
    ...(input.title ? { title: input.title } : {}),
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.rationale ? { rationale: input.rationale } : {}),
    ...(input.plan_steps ? { plan_steps: input.plan_steps } : {}),
    ...(input.actor_id ? { generated_by_actor_id: input.actor_id } : {}),
    metadata: {
      goal_id: goal.id,
      goal_owner_kind: goal.owner_kind,
      goal_owner_id: goal.owner_id,
      goal_timeframe: goal.timeframe,
      ...(goal.target_date ? { goal_target_date: goal.target_date } : {}),
    },
  });
}

function selectProposalForGoal(goal: GoalRecord, proposalId?: string | null) {
  if (!goal.intent_slug) return null;
  const proposals = proposalService
    .list({ intent_id: goal.intent_slug })
    .filter((proposal) => {
      const goalId = proposal.metadata?.goal_id;
      return goalId === undefined || goalId === goal.id;
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  if (proposalId) {
    return proposals.find((proposal) => proposal.id === proposalId) ?? null;
  }

  return proposals.find((proposal) => proposal.status === "approved") ?? null;
}

export function startExecutionForGoal(
  ref: string,
  input: StartGoalExecutionInput = {},
): ExecutionRecord {
  const goal = getGoal(ref);
  if (!goal) throw new GoalNotFoundError(ref);

  const proposal = selectProposalForGoal(goal, input.proposal_id);
  if (input.proposal_id && !proposal) {
    throw new GoalProposalNotFoundError(goal.id, input.proposal_id);
  }

  let execution: ExecutionRecord;
  const executionInput = toExecutionStartInput(input, goal.space_id);

  if (proposal) {
    execution = proposalService.startExecution(proposal.id, executionInput);
  } else {
    if (!goal.intent_slug) {
      throw new Error("goal_intent_required");
    }
    execution = createExecutionFromIntent(goal.intent_slug, {
      ...(executionInput.title !== undefined ? { title: executionInput.title } : {}),
      ...(executionInput.objective !== undefined ? { objective: executionInput.objective } : {}),
      ...(executionInput.mode !== undefined ? { mode: executionInput.mode } : {}),
      ...(executionInput.requires_approval !== undefined
        ? { requires_approval: executionInput.requires_approval }
        : {}),
      ...(executionInput.project_slug !== undefined
        ? { project_slug: executionInput.project_slug }
        : {}),
      ...(executionInput.space_id !== undefined ? { space_id: executionInput.space_id } : {}),
    });
  }

  if (input.buildout_id) {
    const buildout = bindExecutionToBuildout(input.buildout_id, execution.id);
    if (!buildout) {
      throw new GoalBuildoutNotFoundError(goal.id, input.buildout_id);
    }
  }

  return execution;
}

export function createBuildoutForGoal(
  ref: string,
  input: CreateGoalBuildoutInput,
): BuildoutRecord {
  const goal = getGoal(ref);
  if (!goal) throw new GoalNotFoundError(ref);

  const ownerId = input.owner_id ?? goal.owner_id;
  if (!ownerId) throw new Error("goal_buildout_owner_required");

  return createAgentBuildout({
    goal_id: goal.id,
    owner_id: ownerId,
    start_at: input.start_at,
    ...(input.title ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.plan_minutes !== undefined ? { plan_minutes: input.plan_minutes } : {}),
    ...(input.execute_minutes !== undefined
      ? { execute_minutes: input.execute_minutes }
      : {}),
    ...(input.review_minutes !== undefined
      ? { review_minutes: input.review_minutes }
      : {}),
    ...(input.retro_minutes !== undefined ? { retro_minutes: input.retro_minutes } : {}),
    ...(goal.project_id ? { project_id: goal.project_id } : {}),
    ...(goal.space_id ? { space_id: goal.space_id } : {}),
    ...(goal.intent_slug ? { intent_slug: goal.intent_slug } : {}),
  });
}

export function deleteGoal(ref: string): boolean {
  initGoals();
  const existing = getGoal(ref);
  if (!existing) return false;

  getDb()
    .prepare("UPDATE goals SET parent_id = NULL, updated_at = ? WHERE parent_id = ?")
    .run(nowIso(), existing.id);

  const result = getDb().prepare("DELETE FROM goals WHERE id = ?").run(existing.id);
  if (result.changes > 0) {
    goalsEvents.emit("goal:deleted", { type: "goal:deleted", id: existing.id } satisfies GoalsEvent);
    return true;
  }
  return false;
}
