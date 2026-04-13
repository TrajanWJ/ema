import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createAgentRuntimeHeartbeat } from "./agent-runtime-heartbeat.js";
import { createIntentWatcher } from "./intent-watcher.js";
import { onSessionEvent, createSessionWatcher } from "./session-watcher.js";
import { onVaultEvent, createVaultWatcher } from "./vault-watcher.js";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe("workers boot cleanly", () => {
  it("vault-watcher starts, observes a file add, and stops", async () => {
    const root = await mkdtemp(join(tmpdir(), "ema-vault-"));
    process.env["EMA_VAULT_PATH"] = root;

    const worker = createVaultWatcher();
    const eventPromise = new Promise<string>((resolve) => {
      const off = onVaultEvent((event) => {
        off();
        resolve(event.type);
      });
    });

    await worker.start();
    await writeFile(join(root, "note.md"), "# hi\n", "utf8");

    await expect(eventPromise).resolves.toBe("add");
    await worker.stop();
  });

  it("session-watcher polls a jsonl session and emits an event", async () => {
    const root = await mkdtemp(join(tmpdir(), "ema-claude-projects-"));
    const projectDir = join(root, "ema");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      join(projectDir, "session.jsonl"),
      '{"role":"user","content":"boot"}\n{"role":"assistant","content":"ok"}\n',
      "utf8",
    );
    process.env["CLAUDE_PROJECTS_DIR"] = root;

    const eventPromise = new Promise<number>((resolve) => {
      const off = onSessionEvent((event) => {
        off();
        resolve(event.lineCount);
      });
    });

    const worker = createSessionWatcher();
    await worker.start();

    await expect(eventPromise).resolves.toBe(2);
    await worker.stop();
  });

  it("intent-watcher boots as an explicit no-op when disabled", async () => {
    process.env["EMA_WORKERS_WATCH_INTENTS"] = "0";
    const worker = createIntentWatcher();
    await expect(worker.start()).resolves.toBeUndefined();
    await expect(worker.stop()).resolves.toBeUndefined();
  });

  it("agent-runtime-heartbeat boots, polls intents, forwards a transition, and stops", async () => {
    process.env["EMA_HEARTBEAT_INTERVAL_MS"] = "10";
    process.env["EMA_SERVICES_URL"] = "http://127.0.0.1:4488";

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/api/intents?status=active")) {
        return {
          ok: true,
          json: async () => ({ intents: [{ id: "intent-1" }] }),
        };
      }
      return {
        ok: true,
        json: async () => ({ status: "accepted" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const worker = createAgentRuntimeHeartbeat();
    await worker.start();
    await new Promise((resolve) => setTimeout(resolve, 35));
    await worker.stop();

    expect(fetchMock).toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith("/api/agents/runtime-transition"),
      ),
    ).toBe(true);
  });
});
