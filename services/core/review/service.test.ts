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
  createReviewItem,
  deferReviewItem,
  getChronicleReviewState,
  getReviewItemDetail,
  listReviewItems,
  recordPromotionReceipt,
  rejectReviewItem,
  ReviewStateError,
} = await import("./service.js");

let chronicleDir = "";

function resetTables(): void {
  memoryDb.exec(`
    DROP TABLE IF EXISTS promotion_receipts;
    DROP TABLE IF EXISTS review_decisions;
    DROP TABLE IF EXISTS review_items;
    DROP TABLE IF EXISTS promotion_receipts_legacy;
    DROP TABLE IF EXISTS review_items_legacy;
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

function importFixtureSession() {
  return importChronicleSession({
    source: { kind: "manual", label: "Fixture transcript" },
    session: {
      title: "Review planning session",
      summary: "Conversation about turning imported material into real work.",
      project_hint: "ema",
      entries: [
        {
          role: "user",
          kind: "message",
          content: "Turn Chronicle imports into review decisions before promotion.",
          metadata: {},
        },
        {
          role: "assistant",
          kind: "message",
          content: "Approve the strongest item and defer the rest until tomorrow.",
          metadata: {},
        },
      ],
      artifacts: [],
      metadata: {},
    },
  });
}

describe("Review service", () => {
  it("creates an idempotent session review item", () => {
    const chronicle = importFixtureSession();

    const first = createReviewItem({
      chronicle_session_id: chronicle.session.id,
      created_by_actor_id: "actor_reviewer",
    });
    const second = createReviewItem({
      chronicle_session_id: chronicle.session.id,
      created_by_actor_id: "actor_reviewer",
    });

    expect(first.item.id).toBe(second.item.id);
    expect(first.item.source_kind).toBe("chronicle_session");
    expect(first.chronicle.session.title).toBe("Review planning session");
  });

  it("creates an entry-scoped review item with chronicle linkage", () => {
    const chronicle = importFixtureSession();
    const entry = chronicle.entries[0];
    expect(entry).toBeDefined();

    const detail = createReviewItem({
      chronicle_session_id: chronicle.session.id,
      chronicle_entry_id: entry!.id,
      created_by_actor_id: "actor_reviewer",
      suggested_target_kind: "intent",
    });

    expect(detail.item.source_kind).toBe("chronicle_entry");
    expect(detail.item.chronicle_entry_id).toBe(entry!.id);
    expect(detail.chronicle.entry?.content).toContain("review decisions");
    expect(detail.item.suggested_target_kind).toBe("intent");
  });

  it("records deferral and later approval with decision history", () => {
    const chronicle = importFixtureSession();
    const created = createReviewItem({
      chronicle_session_id: chronicle.session.id,
      created_by_actor_id: "actor_reviewer",
    });

    const deferred = deferReviewItem(created.item.id, {
      actor_id: "actor_reviewer",
      rationale: "Need a second pass tomorrow.",
    });
    expect(deferred.status).toBe("deferred");

    const approved = approveReviewItem(created.item.id, {
      actor_id: "actor_reviewer",
      rationale: "This is now ready to become structured work.",
    });
    expect(approved.status).toBe("approved");

    const detail = getReviewItemDetail(created.item.id);
    expect(detail.decisions).toHaveLength(2);
    expect(detail.decisions[0]?.decision).toBe("approve");

    const approvedItems = listReviewItems({ decision: "approve" });
    expect(approvedItems).toHaveLength(1);
    expect(approvedItems[0]?.decision_count).toBe(2);
  });

  it("blocks terminal transitions once rejected", () => {
    const chronicle = importFixtureSession();
    const created = createReviewItem({
      chronicle_session_id: chronicle.session.id,
      created_by_actor_id: "actor_reviewer",
    });

    const rejected = rejectReviewItem(created.item.id, {
      actor_id: "actor_reviewer",
      rationale: "No downstream action needed.",
    });
    expect(rejected.status).toBe("rejected");

    expect(() =>
      approveReviewItem(created.item.id, {
        actor_id: "actor_reviewer",
        rationale: "Trying to reopen terminal item.",
      }),
    ).toThrow(ReviewStateError);
  });

  it("records promotion receipts only for approved items and exposes session state", () => {
    const chronicle = importFixtureSession();
    const created = createReviewItem({
      chronicle_session_id: chronicle.session.id,
      created_by_actor_id: "actor_reviewer",
      suggested_target_kind: "proposal",
    });

    approveReviewItem(created.item.id, {
      actor_id: "actor_reviewer",
      rationale: "Promote this into structured planning work.",
    });

    const detail = recordPromotionReceipt(created.item.id, {
      target_kind: "proposal",
      target_id: "proposal_001",
      status: "linked",
      summary: "Captured linkage to the proposal domain.",
    });

    expect(detail.receipts).toHaveLength(1);
    expect(detail.receipts[0]?.target_kind).toBe("proposal");
    expect(detail.receipts[0]?.target_id).toBe("proposal_001");

    const sessionState = getChronicleReviewState(chronicle.session.id);
    expect(sessionState.review_items).toHaveLength(1);
    expect(sessionState.promotion_receipts).toHaveLength(1);
  });

  it("refuses to record a promotion receipt before approval", () => {
    const chronicle = importFixtureSession();
    const created = createReviewItem({
      chronicle_session_id: chronicle.session.id,
      created_by_actor_id: "actor_reviewer",
    });

    expect(() =>
      recordPromotionReceipt(created.item.id, {
        target_kind: "intent",
      }),
    ).toThrow(ReviewStateError);
  });
});
