/**
 * Pipes subservice tests.
 *
 * Hermetic: stubs `services/persistence/db.js` with an in-memory better-sqlite3
 * handle the same way `core/blueprint/blueprint.test.ts` does. Composer calls
 * use a tmpdir artifactsRoot so no test writes to `~/.local/share/ema/`.
 *
 * Covered cases:
 *   1. Registry reports 21/21/5 counts and every Appendix A.3 trigger + action
 *   2. `registry.hasTrigger / hasAction / hasTransform` reject unknowns
 *   3. DDL bootstrap creates `pipes` + `pipe_runs` tables
 *   4. createPipe persists, listPipes filters by trigger + enabled
 *   5. togglePipe enables/disables
 *   6. executePipe happy path: trigger → filter → tasks:create writes a run
 *   7. filter transform halts the run with status "halted"
 *   8. executePipe records failures when an action throws
 *   9. claude:run action goes through Composer and writes response.md
 *  10. Router file exists at the auto-loader path
 *  11. MCP tools expose the expected names
 *  12. pipeBus fans out to the executor on trigger
 */

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// --- Hermetic DB stub ----------------------------------------------------
const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const { Composer } = await import("../composer/index.js");
const {
  createPipe,
  executePipe,
  getPipe,
  initPipes,
  listPipeRuns,
  listPipes,
  pipeBus,
  registry,
  resetPipesInitFlag,
  togglePipe,
  setClaudeComposer,
  setClaudeProvider,
  attachPipeBusExecutor,
  PipeBus,
} = await import("./index.js");
const { pipesMcpTools } = await import("./mcp-tools.js");

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

function resetDb(): void {
  memoryDb.exec(`
    DROP TABLE IF EXISTS pipes;
    DROP TABLE IF EXISTS pipe_runs;
  `);
  resetPipesInitFlag();
  initPipes();
}

// --- Registry -------------------------------------------------------------

describe("pipes registry", () => {
  it("ships 21 triggers, 21 actions, 5 transforms", () => {
    expect(registry.counts.triggers).toBe(21);
    expect(registry.counts.actions).toBe(21);
    expect(registry.counts.transforms).toBe(5);
  });

  it("lists every Appendix A.3 trigger", () => {
    const expected = [
      "brain_dump:item_created",
      "brain_dump:item_processed",
      "tasks:created",
      "tasks:status_changed",
      "tasks:completed",
      "proposals:seed_fired",
      "proposals:generated",
      "proposals:refined",
      "proposals:debated",
      "proposals:queued",
      "proposals:approved",
      "proposals:redirected",
      "proposals:killed",
      "proposals:decomposed",
      "projects:created",
      "projects:status_changed",
      "habits:completed",
      "habits:streak_milestone",
      "system:daemon_started",
      "system:daily",
      "system:weekly",
    ] as const;
    for (const name of expected) {
      expect(registry.hasTrigger(name)).toBe(true);
    }
    expect(registry.triggers).toHaveLength(expected.length);
  });

  it("lists every Appendix A.3 action including claude:run", () => {
    const expected = [
      "brain_dump:create_item",
      "tasks:create",
      "tasks:transition",
      "proposals:create_seed",
      "proposals:approve",
      "proposals:redirect",
      "proposals:kill",
      "projects:create",
      "projects:transition",
      "projects:rebuild_context",
      "responsibilities:generate_due_tasks",
      "vault:create_project_space",
      "vault:create_note",
      "vault:search",
      "notify:desktop",
      "notify:log",
      "notify:send",
      "claude:run",
      "http:request",
      "transform",
      "branch",
    ] as const;
    for (const name of expected) {
      expect(registry.hasAction(name)).toBe(true);
    }
    expect(registry.actions).toHaveLength(expected.length);
  });

  it("lists the 5 stock transforms in Elixir order", () => {
    expect(registry.transforms.map((t) => t.name)).toEqual([
      "filter",
      "map",
      "delay",
      "claude",
      "conditional",
    ]);
  });

  it("rejects unknown names via has* lookups", () => {
    expect(registry.hasTrigger("nope:nope")).toBe(false);
    expect(registry.hasAction("nope:nope")).toBe(false);
    expect(registry.hasTransform("nope")).toBe(false);
  });
});

// --- Service --------------------------------------------------------------

describe("pipes service", () => {
  beforeEach(() => resetDb());

  it("bootstraps DDL creating pipes + pipe_runs", () => {
    const tables = memoryDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as { name: string }[];
    const names = tables.map((r) => r.name);
    expect(names).toContain("pipes");
    expect(names).toContain("pipe_runs");
  });

  it("createPipe persists and listPipes filters by trigger + enabled", () => {
    const a = createPipe({
      name: "capture -> task",
      trigger: "brain_dump:item_created",
      action: "tasks:create",
      transforms: [{ name: "filter", config: { conditions: [] } }],
    });
    const b = createPipe({
      name: "approved -> log",
      trigger: "proposals:approved",
      action: "notify:log",
      enabled: false,
    });

    expect(a.id).toMatch(/^pipe-/u);
    expect(a.enabled).toBe(true);
    expect(b.enabled).toBe(false);

    const triggerFiltered = listPipes({
      trigger: "brain_dump:item_created",
    });
    expect(triggerFiltered).toHaveLength(1);
    expect(triggerFiltered[0]?.id).toBe(a.id);

    const enabledFiltered = listPipes({ enabled: true });
    expect(enabledFiltered.map((p) => p.id)).toEqual([a.id]);
  });

  it("togglePipe flips the enabled flag", () => {
    const p = createPipe({
      name: "toggler",
      trigger: "tasks:created",
      action: "notify:log",
    });
    const off = togglePipe(p.id, false);
    expect(off.enabled).toBe(false);
    const back = togglePipe(p.id, true);
    expect(back.enabled).toBe(true);
  });

  it("createPipe rejects unknown trigger and action names", () => {
    expect(() =>
      createPipe({
        name: "bad",
        trigger: "not:a:trigger" as `${string}:${string}`,
        action: "tasks:create",
      }),
    ).toThrow(/unknown trigger/u);
    expect(() =>
      createPipe({
        name: "bad",
        trigger: "tasks:created",
        action: "not_an_action",
      }),
    ).toThrow(/unknown action/u);
  });
});

// --- Executor -------------------------------------------------------------

describe("executor", () => {
  beforeEach(() => resetDb());

  it("happy path: brain_dump:item_created → filter → tasks:create completes", async () => {
    const pipe = createPipe({
      name: "capture -> task",
      trigger: "brain_dump:item_created",
      action: "tasks:create",
      transforms: [
        {
          name: "filter",
          config: {
            conditions: [{ op: "present", key: "title" }],
            mode: "all",
          },
        },
      ],
    });

    const run = await executePipe(pipe, {
      title: "buy coffee",
      source: "pipe-test",
    });

    expect(run.status).toBe("completed");
    expect(run.pipe_id).toBe(pipe.id);
    const output = run.output as { ok: true; task_id: string; title: string };
    expect(output.ok).toBe(true);
    expect(output.title).toBe("buy coffee");
    expect(output.task_id).toMatch(/^task-stub-/u);

    const history = listPipeRuns({ pipeId: pipe.id });
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe("completed");
    const duration = history[0]?.duration_ms;
    expect(typeof duration === "number" && duration >= 0).toBe(true);
  });

  it("halts when the filter transform drops the event", async () => {
    const pipe = createPipe({
      name: "gated",
      trigger: "tasks:created",
      action: "notify:log",
      transforms: [
        {
          name: "filter",
          config: {
            conditions: [{ op: "eq", key: "priority", value: "high" }],
          },
        },
      ],
    });

    const run = await executePipe(pipe, { priority: "low" });
    expect(run.status).toBe("halted");
    expect(run.halted_reason).toMatch(/filter dropped/u);
  });

  it("records a failure when an action throws", async () => {
    // Force claude:run to throw by swapping the provider.
    setClaudeProvider(async () => {
      throw new Error("provider exploded");
    });

    const pipe = createPipe({
      name: "claude fail",
      trigger: "system:daily",
      action: "claude:run",
    });

    const run = await executePipe(pipe, { content: "hi" });
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/provider exploded/u);

    setClaudeProvider(null);
  });
});

// --- Claude action round-trips through Composer ---------------------------

describe("claude:run action", () => {
  let tmpRoot: string;

  beforeAll(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), "ema-pipes-claude-"));
    setClaudeComposer(new Composer({ artifactsRoot: tmpRoot }));
    setClaudeProvider(async () => "OK");
  });

  afterAll(async () => {
    setClaudeComposer(null);
    setClaudeProvider(null);
    await rm(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(() => resetDb());

  it("compiles an artifact, invokes the provider, and records response.md", async () => {
    const pipe = createPipe({
      name: "daily claude",
      trigger: "system:daily",
      action: "claude:run",
    });

    const run = await executePipe(pipe, {
      content: "capture summary",
      prompt_template: "Summarise: {{content}}",
    });

    expect(run.status).toBe("completed");
    const output = run.output as {
      run_id: string;
      artifact_dir: string;
      response: string;
    };
    expect(output.response).toBe("OK");
    // Composer run ids are timestamp-prefixed (`YYYYMMDDTHHMMSSmmmZ-<rand>`),
    // not our `run-…` pipe_run ids. The artifact dir lives under tmpRoot.
    expect(output.run_id).toMatch(/^\d{8}T\d{6}/u);
    expect(output.artifact_dir.startsWith(tmpRoot)).toBe(true);

    const promptBody = await readFile(
      join(output.artifact_dir, "prompt.md"),
      "utf8",
    );
    expect(promptBody).toContain("Summarise: capture summary");

    const responseBody = await readFile(
      join(output.artifact_dir, "response.md"),
      "utf8",
    );
    expect(responseBody).toContain("OK");
  });
});

// --- Auto-loader file presence -------------------------------------------

describe("auto-loader convention", () => {
  it("publishes pipes.router.ts next to index.ts", async () => {
    const routerPath = join(TEST_DIR, "pipes.router.ts");
    const info = await stat(routerPath);
    expect(info.isFile()).toBe(true);
    expect(existsSync(routerPath)).toBe(true);
  });

  it("router module exports registerRoutes", async () => {
    const mod = (await import("./pipes.router.js")) as {
      registerRoutes?: unknown;
    };
    expect(typeof mod.registerRoutes).toBe("function");
  });
});

// --- MCP tools ------------------------------------------------------------

describe("pipes MCP tools", () => {
  it("registers the six expected tool names", () => {
    const names = pipesMcpTools.map((t) => t.name);
    expect(names).toEqual([
      "pipes_list",
      "pipes_show",
      "pipes_create",
      "pipes_toggle",
      "pipes_run",
      "pipes_history",
    ]);
  });
});

// --- Bus fanout -----------------------------------------------------------

describe("pipeBus → executor wiring", () => {
  beforeEach(() => resetDb());

  it("fires every enabled matching pipe on a trigger event", async () => {
    const localBus = new PipeBus();
    createPipe({
      name: "bus fanout",
      trigger: "tasks:created",
      action: "notify:log",
    });

    const unsubscribe = attachPipeBusExecutor(localBus);

    // Start the bus fire and wait a tick for the async listener to finish.
    localBus.trigger("tasks:created", { task_id: "t1" });
    // The handler is async; yield enough microtasks for it to complete.
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));

    const history = listPipeRuns({});
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0]?.trigger).toBe("tasks:created");
    expect(history[0]?.status).toBe("completed");

    unsubscribe();
    pipeBus.reset(); // defensive — don't leak listeners to other tests
  });
});
