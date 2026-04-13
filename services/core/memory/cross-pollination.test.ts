/**
 * Cross-pollination subservice tests.
 *
 * Hermetic: uses an in-memory SQLite database via vi.mock of the persistence
 * layer, following the same pattern as blueprint.test.ts.
 *
 * Covers:
 *   1. DDL bootstrap creates the memory_cross_pollinations table
 *   2. record() persists an entry and fires a "recorded" event
 *   3. Zod rejects an empty `fact` at record time
 *   4. Zod rejects confidence outside [0, 1]
 *   5. list() filters by source_project and target_project
 *   6. list() honours `limit` and returns newest first
 *   7. findApplicableFor returns target-matching entries newest first
 *   8. getHistory returns source-matching entries for a project
 *   9. subscribe() delivers events and the returned unsub stops delivery
 *  10. schema parses a happy-path entry end to end
 */

import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { crossPollinationEntrySchema } from "@ema/shared/schemas";

// --- Hermetic DB stub ----------------------------------------------------
// Must run BEFORE the service module is imported, per Vitest hoisting rules.
const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const {
  CrossPollinationService,
  initCrossPollination,
  _resetCrossPollinationForTests,
} = await import("./cross-pollination.js");

function resetTable(): void {
  memoryDb.exec("DELETE FROM memory_cross_pollinations;");
}

beforeAll(() => {
  initCrossPollination();
});

beforeEach(() => {
  _resetCrossPollinationForTests();
  memoryDb.exec("DROP TABLE IF EXISTS memory_cross_pollinations;");
  initCrossPollination();
  resetTable();
});

describe("cross-pollination / schema bootstrap", () => {
  it("creates the memory_cross_pollinations table", () => {
    const tables = memoryDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("memory_cross_pollinations");
  });
});

describe("cross-pollination / schema validation", () => {
  it("accepts a happy-path entry", () => {
    const parsed = crossPollinationEntrySchema.safeParse({
      id: "abc123",
      fact: "User prefers Pacific time meetings before noon.",
      source_project: "ema",
      target_project: "proslync",
      rationale: "Same user, same scheduling constraints.",
      applied_at: new Date().toISOString(),
      tags: ["scheduling"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty fact", () => {
    const parsed = crossPollinationEntrySchema.safeParse({
      id: "abc123",
      fact: "",
      source_project: "ema",
      target_project: "proslync",
      rationale: "irrelevant",
      applied_at: new Date().toISOString(),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects confidence outside [0, 1]", () => {
    const parsed = crossPollinationEntrySchema.safeParse({
      id: "abc123",
      fact: "x",
      source_project: "a",
      target_project: "b",
      rationale: "c",
      applied_at: new Date().toISOString(),
      confidence: 1.5,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("cross-pollination / record", () => {
  it("persists an entry and emits a recorded event", async () => {
    const service = new CrossPollinationService();
    const events: string[] = [];
    const unsub = service.subscribe((event) => {
      events.push(event.kind);
    });

    const entry = await service.record({
      fact: "Trajan works best in 90-minute blocks.",
      source_project: "ema",
      target_project: "hq",
      rationale: "Same user, same focus pattern.",
      actor_id: "agent-1",
      confidence: 0.85,
      tags: ["focus", "cadence"],
    });

    expect(entry.id).toBeTruthy();
    expect(entry.fact).toBe("Trajan works best in 90-minute blocks.");
    expect(entry.source_project).toBe("ema");
    expect(entry.target_project).toBe("hq");
    expect(entry.confidence).toBe(0.85);
    expect(entry.tags).toEqual(["focus", "cadence"]);
    expect(events).toEqual(["recorded"]);

    const roundtrip = await service.get(entry.id);
    expect(roundtrip).not.toBeNull();
    expect(roundtrip?.rationale).toBe("Same user, same focus pattern.");

    unsub();
  });

  it("subscribe unsubscribe stops event delivery", async () => {
    const service = new CrossPollinationService();
    const events: string[] = [];
    const unsub = service.subscribe((event) => events.push(event.kind));
    unsub();

    await service.record({
      fact: "x",
      source_project: "a",
      target_project: "b",
      rationale: "c",
    });

    expect(events).toEqual([]);
  });
});

describe("cross-pollination / list + filters", () => {
  it("filters by source_project and target_project", async () => {
    const service = new CrossPollinationService();
    await service.record({
      fact: "f1",
      source_project: "ema",
      target_project: "hq",
      rationale: "r1",
    });
    await service.record({
      fact: "f2",
      source_project: "ema",
      target_project: "proslync",
      rationale: "r2",
    });
    await service.record({
      fact: "f3",
      source_project: "place",
      target_project: "hq",
      rationale: "r3",
    });

    expect((await service.list()).length).toBe(3);
    expect((await service.list({ source_project: "ema" })).length).toBe(2);
    expect((await service.list({ target_project: "hq" })).length).toBe(2);
    expect(
      (await service.list({ source_project: "ema", target_project: "hq" }))
        .length,
    ).toBe(1);
  });

  it("orders entries by applied_at descending and honours limit", async () => {
    const service = new CrossPollinationService();
    // Spread applied_at by inserting with a tiny delay so ISO strings differ.
    await service.record({
      fact: "first",
      source_project: "a",
      target_project: "b",
      rationale: "r",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await service.record({
      fact: "second",
      source_project: "a",
      target_project: "b",
      rationale: "r",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await service.record({
      fact: "third",
      source_project: "a",
      target_project: "b",
      rationale: "r",
    });

    const all = await service.list();
    expect(all.map((e) => e.fact)).toEqual(["third", "second", "first"]);

    const limited = await service.list({ limit: 2 });
    expect(limited.map((e) => e.fact)).toEqual(["third", "second"]);
  });
});

describe("cross-pollination / findApplicableFor + getHistory", () => {
  it("findApplicableFor returns target-matching entries newest first", async () => {
    const service = new CrossPollinationService();
    await service.record({
      fact: "old",
      source_project: "ema",
      target_project: "hq",
      rationale: "r",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await service.record({
      fact: "new",
      source_project: "place",
      target_project: "hq",
      rationale: "r",
    });
    await service.record({
      fact: "unrelated",
      source_project: "ema",
      target_project: "proslync",
      rationale: "r",
    });

    const applicable = await service.findApplicableFor("hq");
    expect(applicable.map((e) => e.fact)).toEqual(["new", "old"]);
  });

  it("getHistory returns all transplants learned in a project", async () => {
    const service = new CrossPollinationService();
    await service.record({
      fact: "f1",
      source_project: "ema",
      target_project: "hq",
      rationale: "r",
    });
    await service.record({
      fact: "f2",
      source_project: "ema",
      target_project: "proslync",
      rationale: "r",
    });
    await service.record({
      fact: "f3",
      source_project: "other",
      target_project: "hq",
      rationale: "r",
    });

    const history = await service.getHistory("ema");
    expect(history.length).toBe(2);
    expect(history.every((e) => e.source_project === "ema")).toBe(true);
  });
});
