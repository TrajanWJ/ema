import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const {
  __resetChronicleForTests,
  importChronicleSession,
} = await import("../chronicle/service.js");
const {
  __resetReviewForTests,
  approveReviewItem,
  extractChronicleSession,
  getChronicleReviewState,
  getReviewItemDetail,
  listReviewItems,
  promoteReviewItem,
} = await import("./service.js");

let chronicleDir = "";

function resetTables(): void {
  memoryDb.exec(`
    DROP TABLE IF EXISTS promotion_receipts;
    DROP TABLE IF EXISTS review_items;
    DROP TABLE IF EXISTS chronicle_extractions;
    DROP TABLE IF EXISTS calendar_entries;
    DROP TABLE IF EXISTS goals;
    DROP TABLE IF EXISTS intent_events;
    DROP TABLE IF EXISTS intent_links;
    DROP TABLE IF EXISTS intent_phase_transitions;
    DROP TABLE IF EXISTS intents;
    DROP TABLE IF EXISTS chronicle_artifacts;
    DROP TABLE IF EXISTS chronicle_entries;
    DROP TABLE IF EXISTS chronicle_sessions;
    DROP TABLE IF EXISTS chronicle_sources;
  `);
  __resetChronicleForTests();
  __resetReviewForTests();
}

beforeEach(() => {
  resetTables();
  chronicleDir = mkdtempSync(join(tmpdir(), "ema-review-"));
  process.env.EMA_CHRONICLE_DIR = chronicleDir;
});

afterEach(() => {
  delete process.env.EMA_CHRONICLE_DIR;
  if (chronicleDir) {
    rmSync(chronicleDir, { recursive: true, force: true });
  }
});

describe("Chronicle review flow", () => {
  it("extracts review candidates from a Chronicle session", () => {
    const detail = importChronicleSession({
      source: { kind: "manual", label: "Fixture transcript" },
      session: {
        title: "Planning sync",
        project_hint: "ema",
        entries: [
          {
            role: "user",
            kind: "message",
            content: "We need to build the Chronicle review queue next.",
            metadata: {},
          },
          {
            role: "assistant",
            kind: "message",
            content: "Schedule the follow-up for 2026-04-20 and capture the artifact.",
            metadata: {},
          },
        ],
        artifacts: [
          {
            name: "notes.md",
            kind: "attachment",
            text_content: "review notes",
            metadata: {},
          },
        ],
        metadata: {},
      },
    });

    const result = extractChronicleSession(detail.session.id);

    expect(result.extractions.length).toBeGreaterThanOrEqual(3);
    expect(result.review_items.length).toBe(result.extractions.length);

    const items = listReviewItems({ session_id: detail.session.id });
    expect(items.some((item) => item.candidate_kind === "intent_candidate")).toBe(true);
    expect(items.some((item) => item.candidate_kind === "calendar_candidate")).toBe(true);
  });

  it("approves and promotes an intent candidate with provenance preserved", () => {
    const detail = importChronicleSession({
      source: { kind: "manual", label: "Fixture transcript" },
      session: {
        title: "Review intent session",
        entries: [
          {
            role: "user",
            kind: "message",
            content: "Build the Chronicle review promotion flow.",
            metadata: {},
          },
        ],
        artifacts: [],
        metadata: {},
      },
    });

    const extractionRun = extractChronicleSession(detail.session.id);
    const item = extractionRun.review_items.find(
      (candidate) => candidate.candidate_kind === "intent_candidate",
    );
    expect(item).toBeDefined();

    const approved = approveReviewItem(item!.id, { actor_id: "actor_reviewer" });
    expect(approved.status).toBe("approved");

    const promoted = promoteReviewItem(item!.id, {
      to: "intent",
      actor_id: "actor_reviewer",
      note: "Promote into live intent backlog.",
    });

    expect(promoted.item.status).toBe("promoted");
    expect(promoted.item.target_kind).toBe("intent");
    expect(promoted.item.target_id).toBeTruthy();
    expect(promoted.receipts).toHaveLength(1);
    expect(promoted.receipts[0]?.target_kind).toBe("intent");

    const reviewState = getChronicleReviewState(detail.session.id);
    expect(reviewState.extractions.length).toBeGreaterThan(0);
    expect(reviewState.review_items.length).toBeGreaterThan(0);
    expect(reviewState.promotion_receipts).toHaveLength(1);
  });

  it("promotes a dated candidate into a calendar entry", () => {
    const detail = importChronicleSession({
      source: { kind: "manual", label: "Calendar fixture" },
      session: {
        title: "Calendar session",
        entries: [
          {
            role: "user",
            kind: "message",
            content: "Book the design review for 2026-05-01.",
            metadata: {},
          },
        ],
        artifacts: [],
        metadata: {},
      },
    });

    const extractionRun = extractChronicleSession(detail.session.id);
    const item = extractionRun.review_items.find(
      (candidate) => candidate.candidate_kind === "calendar_candidate",
    );
    expect(item).toBeDefined();

    approveReviewItem(item!.id, { actor_id: "actor_reviewer" });
    const promoted = promoteReviewItem(item!.id, {
      to: "calendar_entry",
      actor_id: "actor_reviewer",
      owner_id: "human_ops",
    });

    expect(promoted.item.target_kind).toBe("calendar_entry");
    expect(promoted.receipts[0]?.target_id).toBeTruthy();

    const detailAfter = getReviewItemDetail(item!.id);
    expect(detailAfter.item.status).toBe("promoted");
    expect(detailAfter.receipts).toHaveLength(1);
  });
});
