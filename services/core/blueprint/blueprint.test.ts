/**
 * Blueprint subservice tests.
 *
 * Uses a hermetic in-memory SQLite database (via vi.mock of the persistence
 * layer) so tests don't touch the shared `~/.local/share/ema/ema.db` file.
 *
 * Covers:
 *   1. Drizzle/DDL bootstrap creates tables
 *   2. createGacCard persists + emits an event
 *   3. nextGacId increments GAC-NNN monotonically
 *   4. listGacCards filters by status/category/priority
 *   5. answerGacCard transitions pending → answered + writes transition row
 *   6. deferGacCard transitions pending → deferred
 *   7. promoteGacCard transitions pending → promoted
 *   8. state machine rejects answered → deferred
 *   9. parseGacCardFile validates the hand-authored GAC-001 and GAC-004 files
 *  10. loadAllGacCards upserts every legacy card in ema-genesis/intents/
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// --- Hermetic DB stub ----------------------------------------------------
// Must run BEFORE the service module is imported, per Vitest hoisting rules.
const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

// Dynamic imports so the mock is active.
const {
  answerGacCard,
  blueprintEvents,
  createGacCard,
  deferGacCard,
  getGacCard,
  initBlueprint,
  listGacCards,
  listGacTransitions,
  promoteGacCard,
} = await import("./service.js");
const { loadAllGacCards, parseGacCardFile } = await import("./filesystem.js");
const { canTransition, InvalidTransitionError } = await import(
  "./state-machine.js"
);

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TEST_DIR, "..", "..", "..");

function resetDb(): void {
  memoryDb.exec(`
    DROP TABLE IF EXISTS gac_cards;
    DROP TABLE IF EXISTS gac_transitions;
  `);
  // Force re-init on next call.
  // The service caches `initialised`, but DROP then initBlueprint re-applies DDL.
  initBlueprint();
}

beforeAll(() => {
  initBlueprint();
});

beforeEach(() => {
  memoryDb.exec("DELETE FROM gac_cards; DELETE FROM gac_transitions;");
});

describe("Blueprint / schema bootstrap", () => {
  it("creates gac_cards and gac_transitions tables", () => {
    const tables = memoryDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("gac_cards");
    expect(names).toContain("gac_transitions");
  });
});

describe("Blueprint / createGacCard", () => {
  it("persists a pending card and emits a created event", () => {
    const events: string[] = [];
    const listener = (): void => {
      events.push("gac:created");
    };
    blueprintEvents.on("gac:created", listener);

    const card = createGacCard({
      title: "Should tests hit the real DB?",
      question: "Are hermetic tests worth the setup?",
      options: [
        {
          label: "A",
          text: "In-memory SQLite",
          implications: "Fast and isolated",
        },
        {
          label: "B",
          text: "Real file DB",
          implications: "Slow and shared",
        },
      ],
      category: "clarification",
      priority: "medium",
      author: "test-suite",
    });

    expect(card.id).toMatch(/^GAC-\d{3,}$/u);
    expect(card.status).toBe("pending");
    expect(events).toEqual(["gac:created"]);
    blueprintEvents.off("gac:created", listener);

    const roundtrip = getGacCard(card.id);
    expect(roundtrip).not.toBeNull();
    expect(roundtrip?.options).toHaveLength(2);
  });

  it("mints monotonically increasing GAC-NNN ids", () => {
    const first = createGacCard({
      title: "one",
      question: "first",
      options: [{ label: "A", text: "x", implications: "y" }],
      category: "gap",
      priority: "low",
      author: "t",
    });
    const second = createGacCard({
      title: "two",
      question: "second",
      options: [{ label: "A", text: "x", implications: "y" }],
      category: "gap",
      priority: "low",
      author: "t",
    });
    const firstNum = Number.parseInt(first.id.replace("GAC-", ""), 10);
    const secondNum = Number.parseInt(second.id.replace("GAC-", ""), 10);
    expect(secondNum).toBe(firstNum + 1);
  });
});

describe("Blueprint / listGacCards", () => {
  it("filters by status, category, and priority", () => {
    createGacCard({
      title: "a",
      question: "q",
      options: [{ label: "A", text: "x", implications: "y" }],
      category: "gap",
      priority: "high",
      author: "t",
    });
    const cardB = createGacCard({
      title: "b",
      question: "q",
      options: [{ label: "A", text: "x", implications: "y" }],
      category: "assumption",
      priority: "low",
      author: "t",
    });

    expect(listGacCards({ category: "gap" })).toHaveLength(1);
    expect(listGacCards({ category: "assumption" })).toHaveLength(1);
    expect(listGacCards({ priority: "low" })).toHaveLength(1);
    expect(listGacCards({ status: "pending" })).toHaveLength(2);

    answerGacCard(cardB.id, { selected: "A", answered_by: "human" });
    expect(listGacCards({ status: "answered" })).toHaveLength(1);
    expect(listGacCards({ status: "pending" })).toHaveLength(1);
  });
});

describe("Blueprint / state transitions", () => {
  it("answerGacCard transitions pending → answered and writes a transition row", () => {
    const card = createGacCard({
      title: "t",
      question: "q",
      options: [{ label: "A", text: "x", implications: "y" }],
      category: "gap",
      priority: "medium",
      author: "t",
    });

    const answered = answerGacCard(card.id, {
      selected: "A",
      answered_by: "human",
      reason: "obvious",
    });
    expect(answered.status).toBe("answered");
    expect(answered.answer?.selected).toBe("A");

    const transitions = listGacTransitions(card.id);
    // 1 creation row + 1 answer row
    expect(transitions.length).toBeGreaterThanOrEqual(2);
    const lastTransition = transitions[transitions.length - 1];
    expect(lastTransition?.to_status).toBe("answered");
    expect(lastTransition?.reason).toBe("obvious");
  });

  it("deferGacCard transitions pending → deferred", () => {
    const card = createGacCard({
      title: "t",
      question: "q",
      options: [{ label: "A", text: "x", implications: "y" }],
      category: "gap",
      priority: "medium",
      author: "t",
    });
    const deferred = deferGacCard(card.id, {
      actor: "human",
      reason: "need more research",
    });
    expect(deferred.status).toBe("deferred");
    expect(deferred.result_action?.type).toBe("defer_to_blocker");
  });

  it("promoteGacCard transitions pending → promoted", () => {
    const card = createGacCard({
      title: "t",
      question: "q",
      options: [{ label: "A", text: "x", implications: "y" }],
      category: "gap",
      priority: "medium",
      author: "t",
    });
    const promoted = promoteGacCard(card.id, {
      actor: "human",
      reason: "blocking on decision",
      blocker_id: "BLOCK-001",
    });
    expect(promoted.status).toBe("promoted");
    expect(promoted.result_action?.target).toBe("BLOCK-001");
  });

  it("rejects terminal→terminal transitions", () => {
    const card = createGacCard({
      title: "t",
      question: "q",
      options: [{ label: "A", text: "x", implications: "y" }],
      category: "gap",
      priority: "medium",
      author: "t",
    });
    answerGacCard(card.id, { selected: "A", answered_by: "human" });
    expect(() =>
      deferGacCard(card.id, { actor: "human", reason: "too late" }),
    ).toThrow(InvalidTransitionError);
    expect(canTransition("answered", "deferred")).toBe(false);
    expect(canTransition("pending", "answered")).toBe(true);
  });
});

describe("Blueprint / filesystem parser", () => {
  it("parses GAC-001 from ema-genesis/intents", () => {
    const path = join(REPO_ROOT, "ema-genesis", "intents", "GAC-001", "README.md");
    const content = readFileSync(path, "utf8");
    const parsed = parseGacCardFile(content);
    expect(parsed).not.toBeNull();
    expect(parsed?.card.id).toBe("GAC-001");
    expect(parsed?.card.category).toBe("gap");
    expect(parsed?.card.priority).toBe("critical");
    expect(parsed?.card.options.length).toBeGreaterThan(0);
  });

  it("parses GAC-004 from ema-genesis/intents", () => {
    const path = join(REPO_ROOT, "ema-genesis", "intents", "GAC-004", "README.md");
    const content = readFileSync(path, "utf8");
    const parsed = parseGacCardFile(content);
    expect(parsed).not.toBeNull();
    expect(parsed?.card.id).toBe("GAC-004");
    expect(parsed?.card.status).toBe("answered");
  });

  it("loadAllGacCards indexes every hand-authored GAC card", () => {
    const report = loadAllGacCards([join(REPO_ROOT, "ema-genesis", "intents")]);
    expect(report.errors).toHaveLength(0);
    // There are 10 hand-authored cards (GAC-001 through GAC-010).
    expect(report.loaded).toBeGreaterThanOrEqual(10);
    const loaded = listGacCards();
    expect(loaded.length).toBeGreaterThanOrEqual(10);
    const ids = loaded.map((c) => c.id).sort();
    expect(ids).toContain("GAC-001");
    expect(ids).toContain("GAC-010");
  });
});
