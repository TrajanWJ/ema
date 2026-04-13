import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const {
  createInboxItem,
  getInboxItem,
  promoteInboxItemToTask,
} = await import("./brain-dump.service.js");
const { findTaskBySource } = await import("../tasks/tasks.service.js");

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

beforeEach(() => {
  memoryDb.exec(`
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS task_comments;
    DROP TABLE IF EXISTS inbox_items;
  `);
  applyTaskDdl();
  applyInboxDdl();
});

describe("brain-dump / promote to task", () => {
  it("creates a real task and marks the inbox item processed", () => {
    const item = createInboxItem({
      content: "Follow up with Dana about the invoice and next steps",
      source: "text",
    });

    const promoted = promoteInboxItemToTask(item.id);
    expect(promoted).not.toBeNull();
    expect(promoted?.item.action).toBe("task");
    expect(promoted?.item.processed).toBe(true);
    expect(promoted?.task.source_type).toBe("brain_dump");
    expect(promoted?.task.source_id).toBe(item.id);
    expect(promoted?.task.title).toContain("Follow up with Dana");

    const task = findTaskBySource("brain_dump", item.id);
    expect(task?.id).toBe(promoted?.task.id);
    expect(getInboxItem(item.id)?.processed).toBe(true);
  });

  it("returns the existing task if the inbox item was already promoted", () => {
    const item = createInboxItem({
      content: "Prepare Friday handoff note",
      source: "text",
    });

    const first = promoteInboxItemToTask(item.id);
    const second = promoteInboxItemToTask(item.id);

    expect(first?.task.id).toBe(second?.task.id);
    expect(second?.item.action).toBe("task");
  });
});
