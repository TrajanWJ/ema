/**
 * Intent filesystem watcher — cross-process mirror.
 *
 * The services process owns its own `node:fs.watch` on
 * `.superman/intents/` and `ema-genesis/intents/` via
 * `services/core/intents/filesystem.ts`. This worker exists so that a
 * second Node process (workers/) can independently observe the intent
 * filesystem and POST events back into services via HTTP. It is the
 * symmetric twin of `agent-runtime-heartbeat.ts` — both follow the same
 * "workers watch, services own the DB, HTTP is the seam" pattern.
 *
 * By default this worker is DISABLED because the services process
 * already indexes intents at boot. Enable it by setting
 * `EMA_WORKERS_WATCH_INTENTS=1` in the environment. The typical reason
 * to enable it is when workers runs on a different host than services
 * — the watcher is then the only observer pushing filesystem changes
 * into the queryable index.
 *
 * When disabled, the worker registers a no-op start/stop so the
 * worker-manager supervision loop still tracks it.
 */

import {
  existsSync,
  readdirSync,
  statSync,
  watch,
  type FSWatcher,
} from "node:fs";
import { join, resolve } from "node:path";

import type { Worker } from "./worker-manager.js";

const DEBOUNCE_MS = 200;

function isEnabled(): boolean {
  return process.env["EMA_WORKERS_WATCH_INTENTS"] === "1";
}

function servicesBaseUrl(): string {
  return process.env["EMA_SERVICES_URL"] ?? "http://127.0.0.1:4488";
}

function intentRootsFromCwd(root: string): string[] {
  const candidates = [
    join(root, ".superman", "intents"),
    join(root, "ema-genesis", "intents"),
  ];
  return candidates.map((p) => resolve(p)).filter((p) => existsSync(p));
}

async function forwardReindex(): Promise<void> {
  try {
    await fetch(`${servicesBaseUrl()}/api/intents/reindex`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[intent-watcher] reindex forward failed: ${msg}`);
  }
}

function walkDirectories(root: string): string[] {
  const out: string[] = [root];
  try {
    const entries = readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const child = join(root, entry.name);
      try {
        statSync(child);
      } catch {
        continue;
      }
      out.push(child);
    }
  } catch {
    // Root vanished — caller re-queries on next tick.
  }
  return out;
}

export function createIntentWatcher(): Worker {
  let watchers: FSWatcher[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    name: "intent-watcher",
    async start(): Promise<void> {
      if (!isEnabled()) return; // explicit no-op when disabled
      const repoRoot = process.cwd();
      const roots = intentRootsFromCwd(repoRoot);
      if (roots.length === 0) return;

      const scheduleReindex = (): void => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void forwardReindex();
          debounceTimer = null;
        }, DEBOUNCE_MS);
      };

      for (const root of roots) {
        for (const dir of walkDirectories(root)) {
          try {
            const w = watch(dir, { persistent: true }, scheduleReindex);
            watchers.push(w);
          } catch {
            // Platform may not support watching this path — skip.
          }
        }
      }
    },

    async stop(): Promise<void> {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      for (const w of watchers) {
        try {
          w.close();
        } catch {
          // ignore
        }
      }
      watchers = [];
    },
  };
}
