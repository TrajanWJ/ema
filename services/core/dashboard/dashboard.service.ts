import { getDb } from '../../persistence/db.js';

export interface DashboardSnapshot {
  date: string;
  inbox_count: number;
  recent_inbox: Array<{
    id: string;
    content: string;
    source: string;
    created_at: string;
  }>;
  habits: Array<{
    id: string;
    name: string;
    color: string;
    completed: boolean;
    streak: number;
  }>;
  journal: null;
}

export function getTodaySnapshot(): DashboardSnapshot {
  const db = getDb();
  const inboxCountRow = db
    .prepare('SELECT COUNT(*) as count FROM inbox_items WHERE processed = 0')
    .get() as { count: number };
  const recentInbox = db
    .prepare(
      `
        SELECT id, content, source, created_at
        FROM inbox_items
        ORDER BY created_at DESC
        LIMIT 5
      `,
    )
    .all() as Array<{
      id: string;
      content: string;
      source: string;
      created_at: string;
    }>;

  return {
    date: new Date().toISOString().slice(0, 10),
    inbox_count: inboxCountRow.count,
    recent_inbox: recentInbox,
    habits: [],
    journal: null,
  };
}
