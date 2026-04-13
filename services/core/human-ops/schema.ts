import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const humanOpsDays = sqliteTable(
  "human_ops_days",
  {
    date: text("date").primaryKey(),
    plan: text("plan").notNull(),
    linkedGoalId: text("linked_goal_id"),
    nowTaskId: text("now_task_id"),
    pinnedTaskIds: text("pinned_task_ids").notNull(),
    reviewNote: text("review_note").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    updatedAtIdx: index("human_ops_days_updated_at_idx").on(table.updatedAt),
  }),
);

export const HUMAN_OPS_DDL = `
  CREATE TABLE IF NOT EXISTS human_ops_days (
    date TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT '',
    linked_goal_id TEXT,
    now_task_id TEXT,
    pinned_task_ids TEXT NOT NULL DEFAULT '[]',
    review_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS human_ops_days_updated_at_idx
    ON human_ops_days(updated_at);
`;

export function applyHumanOpsDdl(db: { exec: (sql: string) => unknown }): void {
  db.exec(HUMAN_OPS_DDL);
}
