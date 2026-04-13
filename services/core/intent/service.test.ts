import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const { intentService, CoreIntentNotFoundError } = await import("./service.js");
const { loopEvents, listLoopEvents } = await import("../loop/events.js");
const { resetLoopMigrationsForTests, runLoopMigrations } = await import(
  "../loop/migrations.js"
);

function resetTables(): void {
  memoryDb.exec(`
    DROP TABLE IF EXISTS loop_events;
    DROP TABLE IF EXISTS loop_artifacts;
    DROP TABLE IF EXISTS loop_executions;
    DROP TABLE IF EXISTS loop_proposals;
    DROP TABLE IF EXISTS loop_intents;
    DROP TABLE IF EXISTS service_migrations;
  `);
  resetLoopMigrationsForTests();
  runLoopMigrations(memoryDb);
  loopEvents.removeAllListeners();
}

beforeEach(() => {
  resetTables();
});

describe("IntentService", () => {
  it("creates and persists an intent", () => {
    const intent = intentService.create({
      title: "Bootstrap the loop",
      description: "Create the first runnable loop intent.",
      source: "system",
      priority: "high",
      requested_by_actor_id: "actor_system",
      scope: ["services/core/**"],
      constraints: ["typed", "durable"],
      metadata: { wave: 1 },
    });

    expect(intent.status).toBe("draft");
    expect(intentService.get(intent.id)?.title).toBe("Bootstrap the loop");
  });

  it("lists intents with status filters", () => {
    const a = intentService.create({
      title: "A",
      description: "A",
      source: "human",
      priority: "medium",
      requested_by_actor_id: "actor_owner",
      scope: ["docs/**"],
      constraints: [],
      metadata: {},
    });
    const b = intentService.create({
      title: "B",
      description: "B",
      source: "agent",
      priority: "critical",
      requested_by_actor_id: "actor_agent",
      scope: ["services/**"],
      constraints: [],
      metadata: {},
    });

    intentService.updateStatus(a.id, "active");
    intentService.updateStatus(b.id, "active");
    intentService.updateStatus(b.id, "completed");

    expect(intentService.list({ status: "active" })).toHaveLength(1);
    expect(intentService.list({ status: "completed" })[0]?.id).toBe(b.id);
  });

  it("updates status and persists an event", () => {
    const seen: string[] = [];
    loopEvents.on("intent.status_updated", () => {
      seen.push("intent.status_updated");
    });

    const intent = intentService.create({
      title: "Status",
      description: "Status",
      source: "system",
      priority: "low",
      requested_by_actor_id: "actor_system",
      scope: ["shared/**"],
      constraints: [],
      metadata: {},
    });

    const updated = intentService.updateStatus(intent.id, "active");
    expect(updated.status).toBe("active");
    expect(seen).toEqual(["intent.status_updated"]);
    expect(listLoopEvents().some((event) => event.type === "intent.status_updated")).toBe(true);
  });

  it("rebuilds search_text during indexing", () => {
    const intent = intentService.create({
      title: "Searchable Intent",
      description: "Includes renderer and services terms",
      source: "human",
      priority: "high",
      requested_by_actor_id: "actor_owner",
      scope: ["apps/renderer/**", "services/**"],
      constraints: ["no regressions"],
      metadata: {},
    });

    memoryDb.prepare("UPDATE loop_intents SET search_text = '' WHERE id = ?").run(intent.id);
    intentService.index();

    const row = memoryDb.prepare("SELECT search_text FROM loop_intents WHERE id = ?").get(intent.id) as {
      search_text: string;
    };
    expect(row.search_text).toContain("searchable intent");
    expect(row.search_text).toContain("apps/renderer/**");
  });

  it("throws for missing intents on status update", () => {
    expect(() => intentService.updateStatus("missing", "failed")).toThrow(
      CoreIntentNotFoundError,
    );
  });
});
