import { nanoid } from 'nanoid';
import { getDb } from '../../persistence/db.js';
import type { TaskRecord } from '../tasks/tasks.service.js';
import type { ExecutionRecord } from '../executions/executions.service.js';

export interface ProjectRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  icon: string | null;
  color: string | null;
  linked_path: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  task_count?: number | undefined;
  proposal_count?: number | undefined;
}

export interface CreateProjectInput {
  slug?: string | undefined;
  name: string;
  description?: string | null | undefined;
  status?: string | undefined;
  icon?: string | null | undefined;
  color?: string | null | undefined;
  linked_path?: string | null | undefined;
  parent_id?: string | null | undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function mapProject(row: Record<string, unknown> | undefined): ProjectRecord | null {
  if (!row) return null;

  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: typeof row.description === 'string' ? row.description : null,
    status: String(row.status),
    icon: typeof row.icon === 'string' ? row.icon : null,
    color: typeof row.color === 'string' ? row.color : null,
    linked_path: typeof row.linked_path === 'string' ? row.linked_path : null,
    parent_id: typeof row.parent_id === 'string' ? row.parent_id : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    task_count: typeof row.task_count === 'number' ? row.task_count : undefined,
    proposal_count: typeof row.proposal_count === 'number' ? row.proposal_count : undefined,
  };
}

function listProjectTasks(projectId: string): TaskRecord[] {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT *
        FROM tasks
        WHERE project_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 8
      `,
    )
    .all(projectId) as TaskRecord[];
}

function listProjectExecutions(projectId: string): ExecutionRecord[] {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT e.*
        FROM executions e
        LEFT JOIN inbox_items i ON i.id = e.brain_dump_item_id
        WHERE i.project_id = ?
        ORDER BY e.updated_at DESC, e.created_at DESC
        LIMIT 8
      `,
    )
    .all(projectId) as ExecutionRecord[];
}

export function listProjects(): ProjectRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          p.*,
          COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id), 0) AS task_count,
          0 AS proposal_count
        FROM projects p
        ORDER BY p.updated_at DESC, p.created_at DESC
      `,
    )
    .all() as Record<string, unknown>[];

  return rows.map((row) => mapProject(row)).filter((project): project is ProjectRecord => project !== null);
}

export function getProject(idOrSlug: string): ProjectRecord | null {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT
          p.*,
          COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id), 0) AS task_count,
          0 AS proposal_count
        FROM projects p
        WHERE p.id = ? OR p.slug = ?
        LIMIT 1
      `,
    )
    .get(idOrSlug, idOrSlug) as Record<string, unknown> | undefined;

  return mapProject(row);
}

export function createProject(input: CreateProjectInput): ProjectRecord {
  const db = getDb();
  const now = new Date().toISOString();
  const id = nanoid();
  const slugBase = input.slug?.trim() || slugify(input.name);
  const slug = slugBase.length > 0 ? slugBase : id.toLowerCase();

  db.prepare(
    `
      INSERT INTO projects (
        id, slug, name, description, status, icon, color, linked_path, parent_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    id,
    slug,
    input.name,
    input.description ?? null,
    input.status ?? 'active',
    input.icon ?? null,
    input.color ?? null,
    input.linked_path ?? null,
    input.parent_id ?? null,
    now,
    now,
  );

  return getProject(id) as ProjectRecord;
}

export function updateProject(
  idOrSlug: string,
  input: Partial<CreateProjectInput>,
): ProjectRecord | null {
  const db = getDb();
  const existing = getProject(idOrSlug);
  if (!existing) return null;

  const next = {
    slug: input.slug?.trim() || existing.slug,
    name: input.name ?? existing.name,
    description: input.description === undefined ? existing.description : input.description,
    status: input.status ?? existing.status,
    icon: input.icon === undefined ? existing.icon : input.icon,
    color: input.color === undefined ? existing.color : input.color,
    linked_path:
      input.linked_path === undefined ? existing.linked_path : input.linked_path,
    parent_id: input.parent_id === undefined ? existing.parent_id : input.parent_id,
  };

  db.prepare(
    `
      UPDATE projects
      SET slug = ?, name = ?, description = ?, status = ?, icon = ?, color = ?, linked_path = ?, parent_id = ?, updated_at = ?
      WHERE id = ?
    `,
  ).run(
    next.slug,
    next.name,
    next.description,
    next.status,
    next.icon,
    next.color,
    next.linked_path,
    next.parent_id,
    new Date().toISOString(),
    existing.id,
  );

  return getProject(existing.id);
}

export function getProjectContext(idOrSlug: string): Record<string, unknown> | null {
  const project = getProject(idOrSlug);
  if (!project) return null;

  const tasks = listProjectTasks(project.id);
  const executions = listProjectExecutions(project.id);

  const taskStatusCounts = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});

  const executionStatusCounts = executions.reduce<Record<string, number>>((acc, execution) => {
    acc[execution.status] = (acc[execution.status] ?? 0) + 1;
    return acc;
  }, {});

  const latestTask = tasks[0]?.updated_at ?? null;
  const latestExecution = executions[0]?.updated_at ?? null;
  const lastActivity = [project.updated_at, latestTask, latestExecution]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return {
    project,
    tasks: {
      total: project.task_count ?? tasks.length,
      by_status: taskStatusCounts,
      recent: tasks.slice(0, 6),
    },
    proposals: {
      total: 0,
      by_status: {},
      recent: [],
    },
    campaigns: [],
    active_campaign: null,
    executions: {
      total: executions.length,
      running: executionStatusCounts.running ?? 0,
      succeeded: executionStatusCounts.completed ?? 0,
      failed: executionStatusCounts.failed ?? 0,
      success_rate:
        executions.length > 0
          ? Math.round(((executionStatusCounts.completed ?? 0) / executions.length) * 100)
          : 0,
      recent: executions.slice(0, 6),
    },
    reflexion: {
      total_lessons: 0,
      recent: [],
    },
    gaps: {
      total_open: 0,
      critical_count: 0,
      top_blockers: [],
    },
    health: {
      status: project.status,
      running_executions: executionStatusCounts.running ?? 0,
      active_campaign: false,
      open_gaps: 0,
      critical_gaps: 0,
    },
    stats: {
      total_executions: executions.length,
      active_tasks:
        (taskStatusCounts.todo ?? 0) +
        (taskStatusCounts.proposed ?? 0) +
        (taskStatusCounts.in_progress ?? 0) +
        (taskStatusCounts.blocked ?? 0),
      total_campaigns: 0,
      total_proposals: 0,
    },
    vault: {
      note_count: 0,
      recent_notes: [],
    },
    last_activity: lastActivity,
    generated_at: new Date().toISOString(),
  };
}
