/**
 * UserState subservice tests.
 *
 * Hermetic in-memory SQLite (mirrors `blueprint.test.ts` approach).
 *
 * Covers:
 *   1. Cold-boot default is { mode: 'unknown', distress_flag: false }
 *   2. updateUserState (self) writes current + appends snapshot
 *   3. updateUserState emits user_state:changed
 *   4. distress raised/cleared events fire exactly on the transition
 *   5. recordSignal: 3× agent_blocked in window → crisis + distress raised
 *   6. recordSignal: self_report_flow clears distress and sets focused
 *   7. recordSignal: drift_detected populates drift_score but does NOT raise distress
 *   8. getUserStateHistory returns newest-first with a limit
 *   9. Pure heuristic: applySignal deterministic over a synthetic history
 *  10. Ring-buffer prune keeps count <= SNAPSHOT_RING_SIZE
 */

import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hermetic DB stub ----------------------------------------------------
const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

// Dynamic imports so the mock is live.
const {
  getCurrentUserState,
  getUserStateHistory,
  initUserState,
  recordSignal,
  updateUserState,
  userStateEvents,
} = await import("./service.js");
const {
  applySignal,
  DISTRESS_BLOCK_THRESHOLD,
  DISTRESS_WINDOW_MS,
} = await import("./heuristics.js");
const { applyUserStateDdl, SNAPSHOT_RING_SIZE } = await import("./schema.js");

import type {
  UserStateSignal,
  UserStateSnapshot,
} from "@ema/shared/schemas";

// Apply DDL once before anything runs — initUserState's `initialised` flag is
// module-scoped so we can't rely on it to re-create tables across test files.
applyUserStateDdl(memoryDb);
initUserState();

beforeEach(() => {
  // DELETE (not DROP) preserves the schema so the init flag stays valid.
  memoryDb.exec(
    "DELETE FROM user_state_current; DELETE FROM user_state_snapshots;",
  );
  userStateEvents.removeAllListeners();
});

describe("UserState / cold boot", () => {
  it("returns { mode: 'unknown', distress_flag: false } on first read", () => {
    const snap = getCurrentUserState();
    expect(snap.mode).toBe("unknown");
    expect(snap.distress_flag).toBe(false);
    expect(snap.current_intent_slug).toBeNull();
    expect(snap.updated_by).toBe("self");
  });
});

describe("UserState / updateUserState", () => {
  it("self-report mutation persists + appends a snapshot row", () => {
    const next = updateUserState({
      mode: "focused",
      focus_score: 0.8,
      current_intent_slug: "build-user-state",
      reason: "user_typed_command",
    });
    expect(next.mode).toBe("focused");
    expect(next.focus_score).toBe(0.8);
    expect(next.current_intent_slug).toBe("build-user-state");
    expect(next.updated_by).toBe("self");

    const roundtrip = getCurrentUserState();
    expect(roundtrip.mode).toBe("focused");

    const history = getUserStateHistory({ limit: 10 });
    // cold_start + manual_self
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0]?.reason).toBe("user_typed_command");
  });

  it("emits user_state:changed and distress_raised on the transition", () => {
    const events: string[] = [];
    userStateEvents.on("user_state:changed", () => events.push("changed"));
    userStateEvents.on("user_state:distress_raised", () =>
      events.push("raised"),
    );
    userStateEvents.on("user_state:distress_cleared", () =>
      events.push("cleared"),
    );

    // Warm boot.
    getCurrentUserState();
    updateUserState({ distress_flag: true, mode: "crisis" });
    updateUserState({ distress_flag: false, mode: "scattered" });

    expect(events).toContain("raised");
    expect(events).toContain("cleared");
    expect(events.filter((e) => e === "changed").length).toBe(2);
  });
});

describe("UserState / recordSignal heuristics", () => {
  it("three agent_blocked signals in window raise distress to crisis", () => {
    const raisedEvents: UserStateSnapshot[] = [];
    userStateEvents.on("user_state:distress_raised", (evt: unknown) => {
      if (
        evt &&
        typeof evt === "object" &&
        "snapshot" in evt &&
        (evt as { snapshot?: UserStateSnapshot }).snapshot
      ) {
        raisedEvents.push((evt as { snapshot: UserStateSnapshot }).snapshot);
      }
    });

    const baseAt = new Date("2026-04-12T12:00:00.000Z").getTime();
    for (let i = 0; i < DISTRESS_BLOCK_THRESHOLD; i += 1) {
      const at = new Date(baseAt + i * 1000).toISOString();
      const signal: UserStateSignal = {
        kind: "agent_blocked",
        source: "test",
        at,
      };
      recordSignal(signal);
    }
    const final = getCurrentUserState();
    expect(final.distress_flag).toBe(true);
    expect(final.mode).toBe("crisis");
    expect(raisedEvents).toHaveLength(1);
  });

  it("self_report_flow clears distress and sets focused", () => {
    updateUserState({
      distress_flag: true,
      mode: "crisis",
      reason: "seed",
    });
    const cleared = recordSignal({
      kind: "self_report_flow",
      source: "test",
    });
    expect(cleared.distress_flag).toBe(false);
    expect(cleared.mode).toBe("focused");
  });

  it("drift_detected sets drift_score but does not raise distress", () => {
    const at = new Date("2026-04-12T12:00:00.000Z").toISOString();
    const snap = recordSignal({ kind: "drift_detected", source: "test", at });
    expect(snap.distress_flag).toBe(false);
    expect(snap.drift_score).toBeGreaterThan(0);
    expect(["scattered", "unknown"]).toContain(snap.mode);
  });
});

describe("UserState / history", () => {
  it("getUserStateHistory returns newest-first and respects limit", () => {
    updateUserState({ mode: "scattered", reason: "r1" });
    updateUserState({ mode: "focused", reason: "r2" });
    updateUserState({ mode: "resting", reason: "r3" });

    const entries = getUserStateHistory({ limit: 2 });
    expect(entries).toHaveLength(2);
    expect(entries[0]?.reason).toBe("r3");
    expect(entries[1]?.reason).toBe("r2");
  });

  it("ring-buffer prune keeps snapshot count <= SNAPSHOT_RING_SIZE", () => {
    const overshoot = SNAPSHOT_RING_SIZE + 25;
    for (let i = 0; i < overshoot; i += 1) {
      updateUserState({
        mode: i % 2 === 0 ? "focused" : "scattered",
        reason: `bulk_${i}`,
      });
    }
    const count = memoryDb
      .prepare("SELECT COUNT(*) AS c FROM user_state_snapshots")
      .get() as { c: number };
    expect(count.c).toBeLessThanOrEqual(SNAPSHOT_RING_SIZE);
  });
});

describe("UserState / pure heuristic", () => {
  it("applySignal is deterministic over a synthetic history", () => {
    const previous: UserStateSnapshot = {
      mode: "focused",
      distress_flag: false,
      current_intent_slug: null,
      updated_at: new Date("2026-04-12T12:00:00.000Z").toISOString(),
      updated_by: "self",
    };
    const signal: UserStateSignal = {
      kind: "agent_blocked",
      source: "test",
      at: new Date("2026-04-12T12:02:00.000Z").toISOString(),
    };
    const history: UserStateSignal[] = [
      signal,
      {
        kind: "agent_blocked",
        source: "test",
        at: new Date("2026-04-12T12:01:30.000Z").toISOString(),
      },
      {
        kind: "agent_blocked",
        source: "test",
        at: new Date("2026-04-12T12:01:00.000Z").toISOString(),
      },
    ];
    const first = applySignal({
      previous,
      signal,
      history,
      now: signal.at ?? previous.updated_at,
    });
    const second = applySignal({
      previous,
      signal,
      history,
      now: signal.at ?? previous.updated_at,
    });
    expect(first.next.mode).toBe("crisis");
    expect(first.next.distress_flag).toBe(true);
    expect(first.distressTransition).toBe("raised");
    expect(second.next).toEqual(first.next);
    // Confirms window math stays inside DISTRESS_WINDOW_MS for the fixtures.
    expect(DISTRESS_WINDOW_MS).toBeGreaterThan(60_000);
  });
});
