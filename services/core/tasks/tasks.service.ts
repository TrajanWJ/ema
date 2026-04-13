import { nanoid } from 'nanoid';
import { getDb } from '../../persistence/db.js';

export interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  source_type: string | null;
  source_id: string | null;
  effort: string | null;
  due_date: string | null;
  project_id: string | null;
  parent_id: string | null;
  completed_at: string | null;
  agent: string | null;
  intent: string | null;
  intent_confidence: string | null;
  intent_overridden: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCommentRecord {
  id: string;
  task_id: string;
  body: string;
  source: 'user' | 'system' | 'agent';
  created_at: string;
}

export interface TaskFilters {
  projectId?: string | undefined;
  status?: string | undefined;
  priority?: string | number | undefined;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null | undefined;
  status?: string | undefined;
  priority?: string | number | undefined;
  source_type?: string | null | undefined;
  source_id?: string | null | undefined;
  effort?: string | null | undefined;
  due_date?: string | null | undefined;
  project_id?: string | null | undefined;
  parent_id?: string | null | undefined;
  agent?: string | null | undefined;
  intent?: string | null | undefined;
  intent_confidence?: string | null | undefined;
  intent_overridden?: boolean | null | undefined;
}

const PRIORITY_MAP: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function normalizePriority(input: string | number | undefined): number {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return Math.max(1, Math.min(4, Math.round(input)));
  }

  if (typeof input === 'string') {
    const mapped = PRIORITY_MAP[input];
    if (mapped !== undefined) {
      return mapped;
    }

    const numeric = Number(input);
    if (Number.isFinite(numeric)) {
      return Math.max(1, Math.min(4, Math.round(numeric)));
    }
  }

  return 2;
}

function mapTask(row: Record<string, unknown> | undefined): TaskRecord | null {
  if (!row) return null;

  return {
    id: String(row.id),
    title: String(row.title),
    description: typeof row.description === 'string' ? row.description : null,
    status: String(row.status),
    priority: Number(row.priority ?? 2),
    source_type: typeof row.source_type === 'string' ? row.source_type : null,
    source_id: typeof row.source_id === 'string' ? row.source_id : null,
    effort: typeof row.effort === 'string' ? row.effort : null,
    due_date: typeof row.due_date === 'string' ? row.due_date : null,
    project_id: typeof row.project_id === 'string' ? row.project_id : null,
    parent_id: typeof row.parent_id === 'string' ? row.parent_id : null,
    completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
    agent: typeof row.agent === 'string' ? row.agent : null,
    intent: typeof row.intent === 'string' ? row.intent : null,
    intent_confidence:
      typeof row.intent_confidence === 'string' ? row.intent_confidence : null,
    intent_overridden:
      typeof row.intent_overridden === 'number'
        ? row.intent_overridden === 1
        : typeof row.intent_overridden === 'boolean'
          ? row.intent_overridden
          : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function listTasks(filters: TaskFilters = {}): TaskRecord[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.projectId) {
    conditions.push('project_id = ?');
    params.push(filters.projectId);
  }

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  if (filters.priority !== undefined) {
    conditions.push('priority = ?');
    params.push(normalizePriority(filters.priority));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT * FROM tasks ${whereClause} ORDER BY updated_at DESC, created_at DESC`,
    )
    .all(...params) as Record<string, unknown>[];

  return rows.map((row) => mapTask(row)).filter((task): task is TaskRecord => task !== null);
}

export function getTask(id: string): TaskRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return mapTask(row);
}

export function findTaskBySource(
  sourceType: string,
  sourceId: string,
): TaskRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM tasks WHERE source_type = ? AND source_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(sourceType, sourceId) as Record<string, unknown> | undefined;
  return mapTask(row);
}

export function createTask(input: CreateTaskInput): TaskRecord {
  const db = getDb();
  const now = new Date().toISOString();
  const id = nanoid();

  db.prepare(
    `
      INSERT INTO tasks (
        id, title, description, status, priority, source_type, source_id, effort, due_date,
        project_id, parent_id, completed_at, agent, intent, intent_confidence, intent_overridden,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    id,
    input.title,
    input.description ?? null,
    input.status ?? 'todo',
    normalizePriority(input.priority),
    input.source_type ?? null,
    input.source_id ?? null,
    input.effort ?? null,
    input.due_date ?? null,
    input.project_id ?? null,
    input.parent_id ?? null,
    input.status === 'done' ? now : null,
    input.agent ?? null,
    input.intent ?? null,
    input.intent_confidence ?? null,
    input.intent_overridden === null || input.intent_overridden === undefined
      ? null
      : input.intent_overridden
        ? 1
        : 0,
    now,
    now,
  );

  return getTask(id) as TaskRecord;
}

export function transitionTask(id: string, status: string): TaskRecord | null {
  const db = getDb();
  const existing = getTask(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?',
  ).run(status, status === 'done' ? now : null, now, id);

  return getTask(id);
}

export function addTaskComment(
  taskId: string,
  body: string,
  source: 'user' | 'system' | 'agent' = 'user',
): TaskCommentRecord {
  const db = getDb();
  const id = nanoid();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO task_comments (id, task_id, body, source, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, taskId, body, source, now);

  db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(now, taskId);

  return {
    id,
    task_id: taskId,
    body,
    source,
    created_at: now,
  };
}
