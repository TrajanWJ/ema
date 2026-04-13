import { nanoid } from 'nanoid';
import { getDb } from '../../persistence/db.js';
import { createTask, findTaskBySource, type TaskRecord } from '../tasks/tasks.service.js';

export interface InboxItemRecord {
  id: string;
  content: string;
  source: string;
  processed: boolean;
  action: string | null;
  processed_at: string | null;
  created_at: string;
  project_id: string | null;
}

export interface CreateInboxItemInput {
  content: string;
  source?: string | null;
  project_id?: string | null;
}

export interface PromoteInboxItemToTaskInput {
  title?: string | null;
  description?: string | null;
  priority?: string | number | null;
  status?: string | null;
}

function mapItem(row: Record<string, unknown> | undefined): InboxItemRecord | null {
  if (!row) return null;

  return {
    id: String(row.id),
    content: String(row.content),
    source: typeof row.source === 'string' ? row.source : 'text',
    processed:
      typeof row.processed === 'number'
        ? row.processed === 1
        : Boolean(row.processed),
    action: typeof row.action === 'string' ? row.action : null,
    processed_at: typeof row.processed_at === 'string' ? row.processed_at : null,
    created_at: String(row.created_at),
    project_id: typeof row.project_id === 'string' ? row.project_id : null,
  };
}

export function listInboxItems(): InboxItemRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM inbox_items ORDER BY created_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map((row) => mapItem(row)).filter((item): item is InboxItemRecord => item !== null);
}

export function createInboxItem(input: CreateInboxItemInput): InboxItemRecord {
  const db = getDb();
  const id = nanoid();
  const now = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO inbox_items (id, content, source, processed, action, processed_at, created_at, project_id)
      VALUES (?, ?, ?, 0, NULL, NULL, ?, ?)
    `,
  ).run(id, input.content, input.source ?? 'text', now, input.project_id ?? null);

  return getInboxItem(id) as InboxItemRecord;
}

export function getInboxItem(id: string): InboxItemRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM inbox_items WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return mapItem(row);
}

export function processInboxItem(id: string, action: string): InboxItemRecord | null {
  const db = getDb();
  const existing = getInboxItem(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE inbox_items SET processed = 1, action = ?, processed_at = ? WHERE id = ?',
  ).run(action, now, id);

  return getInboxItem(id);
}

export function deleteInboxItem(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM inbox_items WHERE id = ?').run(id);
  return result.changes > 0;
}

function defaultTaskTitle(content: string): string {
  const firstLine = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) return 'Untitled task';
  return firstLine.length <= 120 ? firstLine : `${firstLine.slice(0, 117)}...`;
}

export function promoteInboxItemToTask(
  id: string,
  input: PromoteInboxItemToTaskInput = {},
): { item: InboxItemRecord; task: TaskRecord } | null {
  const item = getInboxItem(id);
  if (!item) return null;

  const existingTask = findTaskBySource('brain_dump', item.id);
  if (existingTask) {
    const processed = item.processed ? item : processInboxItem(item.id, 'task');
    if (!processed) return null;
    return {
      item: processed,
      task: existingTask,
    };
  }

  const task = createTask({
    title: (input.title ?? '').trim() || defaultTaskTitle(item.content),
    description:
      typeof input.description === 'string' && input.description.trim().length > 0
        ? input.description
        : item.content,
    priority: input.priority ?? undefined,
    status: input.status ?? 'todo',
    source_type: 'brain_dump',
    source_id: item.id,
    project_id: item.project_id,
  });

  const processed = processInboxItem(item.id, 'task');
  if (!processed) return null;

  return {
    item: processed,
    task,
  };
}
