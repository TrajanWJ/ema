import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TEST_DIR, "..", "..", "..");

const intentsModule = await import("../intents/index.js");
const executionsModule = await import("../executions/executions.service.js");

function resetTables(): void {
  memoryDb.exec(`
    DROP TABLE IF EXISTS execution_phase_transitions;
    DROP TABLE IF EXISTS executions;
    DROP TABLE IF EXISTS intent_events;
    DROP TABLE IF EXISTS intent_links;
    DROP TABLE IF EXISTS intent_phase_transitions;
    DROP TABLE IF EXISTS intents;
  `);
}

function nextIntentPhase(
  current: ReturnType<typeof intentsModule.getIntentPhase>,
): "idle" | "plan" | "execute" | "review" | "retro" {
  switch (current) {
    case "idle":
      return "plan";
    case "plan":
      return "execute";
    case "execute":
      return "review";
    case "review":
      return "retro";
    case "retro":
      return "idle";
    default:
      return "plan";
  }
}

beforeEach(() => {
  resetTables();
  intentsModule._resetInitForTest();
  executionsModule.__resetExecutionsInit();
  intentsModule.initIntents();
  executionsModule.initExecutions();
});

describe("backend vertical slice / intent -> execution -> result -> intent writeback", () => {
  it("indexes a filesystem intent, runs an execution, records a result, and writes back to the linked intent", () => {
    const report = intentsModule.loadAllIntents(
      intentsModule.defaultIntentSources(REPO_ROOT),
    );
    expect(report.loaded).toBeGreaterThan(0);

    const intent = intentsModule
      .listIntents()
      .find((candidate) => candidate.id.startsWith("int-"));
    expect(intent).toBeTruthy();
    if (!intent) return;

    const execution = executionsModule.createExecutionFromIntent(intent.id, {
      title: `vertical-slice:${intent.id}`,
      mode: "implement",
      requires_approval: false,
    });

    expect(execution.intent_slug).toBe(intent.id);

    executionsModule.transitionPhase(execution.id, {
      to: "idle",
      reason: "boot",
    });
    executionsModule.transitionPhase(execution.id, {
      to: "plan",
      reason: "planned the work",
    });
    executionsModule.transitionPhase(execution.id, {
      to: "execute",
      reason: "doing the work",
    });
    executionsModule.appendStep(execution.id, {
      label: "implemented vertical slice",
      note: "Execution now supports result evidence and intent writeback.",
    });

    const resultDir = mkdtempSync(join(tmpdir(), "ema-vertical-slice-"));
    const resultPath = join(resultDir, "result.md");
    writeFileSync(
      resultPath,
      "# Result\n\nVertical slice completed with linked intent writeback.\n",
      "utf8",
    );

    const recorded = executionsModule.recordExecutionResult(execution.id, {
      result_path: resultPath,
      result_summary: "Result evidence attached.",
      intent_event: "result attached during vertical slice",
    });

    expect(recorded.result_path).toBe(resultPath);
    expect(recorded.result_summary).toBe("Result evidence attached.");

    const targetIntentPhase = nextIntentPhase(intentsModule.getIntentPhase(intent.id));
    const completed = executionsModule.completeExecution(execution.id, {
      result_summary: "Vertical slice complete.",
      result_path: resultPath,
      intent_status: "completed",
      intent_phase: targetIntentPhase,
      intent_event: "vertical slice complete",
    });

    expect(completed).not.toBeNull();
    expect(completed?.status).toBe("completed");
    expect(completed?.result_path).toBe(resultPath);
    expect(completed?.result_summary).toBe("Vertical slice complete.");

    const updatedIntent = intentsModule.getIntent(intent.id);
    expect(updatedIntent?.status).toBe("completed");
    expect(intentsModule.getIntentPhase(intent.id)).toBe(targetIntentPhase);

    const bundle = intentsModule.getRuntimeBundle(intent.id);
    expect(bundle).not.toBeNull();
    expect(bundle?.links.executions.some((link) => link.target_id === execution.id)).toBe(true);
    expect(bundle?.recent_events.some((event) => event.event_type === "execution_completed")).toBe(
      true,
    );
  });
});
