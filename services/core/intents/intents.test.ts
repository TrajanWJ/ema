/**
 * Intents subservice tests.
 *
 * Hermetic: the persistence layer is vi.mocked with an in-memory sqlite
 * handle, exactly as `blueprint.test.ts` does, so tests never touch the
 * shared `~/.local/share/ema/ema.db` file.
 *
 * Covers:
 *  1. DDL bootstrap creates both tables
 *  2. createIntent persists + emits a created event + writes initial phase row
 *  3. slug validation rejects invalid forms
 *  4. kind-aware validation rejects `port` without exit_condition/scope
 *  5. listIntents filters by status/level/kind/phase
 *  6. transitionPhase writes an append-only row + respects the allowed map
 *  7. illegal rewind transitions are rejected
 *  8. updateIntentStatus emits status_changed
 *  9. parseIntentFile validates INT-RECOVERY-WAVE-1 (kind: port + exit + scope)
 * 10. parseIntentFile skips GAC-* ids
 * 11. loadAllIntents indexes every INT-* hand-authored intent
 * 12. validateIntentForKind passes on INT-RECOVERY-WAVE-1
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// --- Hermetic DB stub ----------------------------------------------------
const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const {
  createIntent,
  getIntent,
  getIntentPhase,
  initIntents,
  intentsEvents,
  IntentValidationError,
  isValidSlug,
  listIntentPhaseTransitions,
  listIntents,
  slugify,
  transitionPhase,
  updateIntentStatus,
  _resetInitForTest,
} = await import("./service.js");
const { loadAllIntents, parseIntentFile } = await import("./filesystem.js");
const { canTransition, InvalidIntentPhaseTransitionError } = await import(
  "./state-machine.js"
);
const { validateIntentForKind } = await import("@ema/shared/schemas");

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TEST_DIR, "..", "..", "..");

beforeAll(() => {
  initIntents();
});

beforeEach(() => {
  memoryDb.exec(`
    DROP TABLE IF EXISTS intents;
    DROP TABLE IF EXISTS intent_phase_transitions;
  `);
  _resetInitForTest();
  initIntents();
});

describe("Intents / schema bootstrap", () => {
  it("creates intents and intent_phase_transitions tables", () => {
    const tables = memoryDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("intents");
    expect(names).toContain("intent_phase_transitions");
  });
});

describe("Intents / slug helpers", () => {
  it("accepts kebab-slugs and rejects junk", () => {
    expect(isValidSlug("int-recovery-wave-1")).toBe(true);
    expect(isValidSlug("a")).toBe(false);
    expect(isValidSlug("Has Spaces")).toBe(false);
    expect(isValidSlug("UPPER")).toBe(false);
    expect(isValidSlug("trailing-")).toBe(false);
  });

  it("slugifies titles", () => {
    expect(slugify("Recovery Wave 1 — port old build")).toBe(
      "recovery-wave-1-port-old-build",
    );
  });
});

describe("Intents / createIntent", () => {
  it("persists a draft intent and emits a created event", () => {
    const events: string[] = [];
    const listener = (): void => {
      events.push("intent:created");
    };
    intentsEvents.on("intent:created", listener);

    const intent = createIntent({
      title: "Write the intents port",
      level: "initiative",
    });

    expect(intent.id).toBe("write-the-intents-port");
    expect(intent.status).toBe("draft");
    expect(events).toEqual(["intent:created"]);
    intentsEvents.off("intent:created", listener);

    const roundtrip = getIntent(intent.id);
    expect(roundtrip).not.toBeNull();
    expect(roundtrip?.title).toBe("Write the intents port");

    expect(getIntentPhase(intent.id)).toBe("idle");

    const transitions = listIntentPhaseTransitions(intent.id);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.from_phase).toBeNull();
    expect(transitions[0]?.to_phase).toBe("idle");
    expect(transitions[0]?.reason).toBe("created");
  });

  it("rejects a `port` intent missing exit_condition and scope", () => {
    expect(() =>
      createIntent({
        slug: "port-thing",
        title: "Port something",
        level: "initiative",
        kind: "port",
      }),
    ).toThrow(IntentValidationError);

    try {
      createIntent({
        slug: "port-thing-2",
        title: "Port something else",
        level: "initiative",
        kind: "port",
      });
    } catch (err) {
      expect(err).toBeInstanceOf(IntentValidationError);
      const missing = (err as InstanceType<typeof IntentValidationError>)
        .missing;
      expect(missing).toContain("exit_condition");
      expect(missing).toContain("scope");
    }
  });

  it("accepts a `port` intent with exit_condition and scope", () => {
    const intent = createIntent({
      slug: "port-thing-ok",
      title: "Port something with discipline",
      level: "initiative",
      kind: "port",
      exit_condition: "Tests green + tsc clean",
      scope: ["services/core/port-thing/**"],
    });
    expect(intent.kind).toBe("port");
    expect(intent.exit_condition).toBe("Tests green + tsc clean");
    expect(intent.scope).toEqual(["services/core/port-thing/**"]);
  });
});

describe("Intents / listIntents", () => {
  it("filters by status / level / kind / phase", () => {
    createIntent({
      slug: "alpha",
      title: "alpha",
      level: "initiative",
      kind: "research",
    });
    const beta = createIntent({
      slug: "beta",
      title: "beta",
      level: "execution",
      kind: "port",
      exit_condition: "done",
      scope: ["x/**"],
    });

    expect(listIntents({ level: "initiative" })).toHaveLength(1);
    expect(listIntents({ level: "execution" })).toHaveLength(1);
    expect(listIntents({ kind: "research" })).toHaveLength(1);
    expect(listIntents({ kind: "port" })).toHaveLength(1);
    expect(listIntents({ phase: "idle" })).toHaveLength(2);

    updateIntentStatus(beta.id, { status: "active" });
    expect(listIntents({ status: "active" })).toHaveLength(1);
    expect(listIntents({ status: "draft" })).toHaveLength(1);
  });
});

describe("Intents / phase transitions", () => {
  it("writes append-only phase rows and respects the allowed map", () => {
    const intent = createIntent({
      slug: "phase-walker",
      title: "phase walker",
      level: "initiative",
    });

    transitionPhase(intent.id, { to: "plan", reason: "kickoff" });
    transitionPhase(intent.id, { to: "execute", reason: "go" });

    const transitions = listIntentPhaseTransitions(intent.id);
    // initial idle + plan + execute = 3
    expect(transitions).toHaveLength(3);
    expect(transitions[0]?.to_phase).toBe("idle");
    expect(transitions[1]?.to_phase).toBe("plan");
    expect(transitions[2]?.to_phase).toBe("execute");
    expect(transitions[2]?.from_phase).toBe("plan");

    expect(getIntentPhase(intent.id)).toBe("execute");
  });

  it("rejects illegal rewinds like retro → execute", () => {
    const intent = createIntent({
      slug: "phase-bad",
      title: "bad walker",
      level: "initiative",
    });
    transitionPhase(intent.id, { to: "execute", reason: "skip" });
    transitionPhase(intent.id, { to: "retro", reason: "skip again" });
    expect(() =>
      transitionPhase(intent.id, { to: "execute", reason: "rewind" }),
    ).toThrow(InvalidIntentPhaseTransitionError);
    expect(canTransition("retro", "execute")).toBe(false);
    expect(canTransition("idle", "execute")).toBe(true);
  });
});

describe("Intents / status updates", () => {
  it("emits status_changed with the prior status", () => {
    const intent = createIntent({
      slug: "status-thing",
      title: "status thing",
      level: "initiative",
    });

    const captured: Array<{ from: string; to: string }> = [];
    const listener = (payload: unknown): void => {
      const evt = payload as { from: string; to: string };
      captured.push({ from: evt.from, to: evt.to });
    };
    intentsEvents.on("intent:status_changed", listener);

    updateIntentStatus(intent.id, { status: "active" });
    expect(captured).toEqual([{ from: "draft", to: "active" }]);
    intentsEvents.off("intent:status_changed", listener);
  });
});

describe("Intents / filesystem parser", () => {
  it("parses INT-RECOVERY-WAVE-1 and passes the kind-aware check", () => {
    const path = join(
      REPO_ROOT,
      "ema-genesis",
      "intents",
      "INT-RECOVERY-WAVE-1",
      "README.md",
    );
    const content = readFileSync(path, "utf8");
    const parsed = parseIntentFile(content);
    expect(parsed).not.toBeNull();
    expect(parsed?.intent.id).toBe("int-recovery-wave-1");
    expect(parsed?.intent.kind).toBe("port");
    expect(parsed?.intent.exit_condition).toBeDefined();
    expect(parsed?.intent.scope).toBeDefined();
    expect((parsed?.intent.scope ?? []).length).toBeGreaterThan(0);
    expect(parsed?.phase).toBe("execute");

    const check = validateIntentForKind(parsed!.intent);
    expect(check.ok).toBe(true);
    expect(check.missing).toEqual([]);
  });

  it("skips GAC-* files", () => {
    const gac = `---
id: GAC-001
title: Not an intent
---

body
`;
    expect(parseIntentFile(gac)).toBeNull();
  });

  it("loadAllIntents indexes every hand-authored INT-* intent", () => {
    const report = loadAllIntents([
      join(REPO_ROOT, "ema-genesis", "intents"),
    ]);
    expect(report.errors).toHaveLength(0);
    // There are 13 INT-* directories under ema-genesis/intents at time of writing.
    expect(report.loaded).toBeGreaterThanOrEqual(1);
    const loaded = listIntents();
    expect(loaded.length).toBeGreaterThanOrEqual(1);
    const ids = loaded.map((i) => i.id);
    expect(ids).toContain("int-recovery-wave-1");
    // None of the loaded intents should have GAC- in the id.
    for (const id of ids) {
      expect(id.startsWith("gac-")).toBe(false);
    }
  });
});
