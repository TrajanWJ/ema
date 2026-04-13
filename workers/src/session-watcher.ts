import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Worker } from "./worker-manager.js";

const POLL_INTERVAL_MS = 30_000;

interface SessionFile {
  path: string;
  modifiedAt: number;
}

export interface SessionEvent {
  sessionFile: string;
  lineCount: number;
  timestamp: number;
}

export type SessionEventHandler = (event: SessionEvent) => void;

const listeners = new Set<SessionEventHandler>();

export function onSessionEvent(handler: SessionEventHandler): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

function emit(event: SessionEvent): void {
  for (const handler of listeners) {
    try {
      handler(event);
    } catch {
      // Swallow listener errors
    }
  }
}

const knownModTimes = new Map<string, number>();

function claudeProjectsDir(): string {
  return (
    process.env["CLAUDE_PROJECTS_DIR"] ??
    `${process.env["HOME"] ?? "~"}/.claude/projects`
  );
}

async function findJsonlFiles(dir: string): Promise<SessionFile[]> {
  const results: SessionFile[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        const nested = await findJsonlFiles(fullPath);
        results.push(...nested);
      } else if (entry.name.endsWith(".jsonl")) {
        const info = await stat(fullPath);
        results.push({ path: fullPath, modifiedAt: info.mtimeMs });
      }
    }
  } catch {
    // Directory might not exist yet
  }

  return results;
}

async function poll(): Promise<void> {
  const files = await findJsonlFiles(claudeProjectsDir());

  for (const file of files) {
    const lastMod = knownModTimes.get(file.path);

    if (lastMod === undefined || file.modifiedAt > lastMod) {
      knownModTimes.set(file.path, file.modifiedAt);

      try {
        const content = await readFile(file.path, "utf-8");
        const lineCount = content.split("\n").filter((l) => l.trim().length > 0).length;

        emit({
          sessionFile: file.path,
          lineCount,
          timestamp: Date.now(),
        });
      } catch {
        // File may have been deleted between stat and read
      }
    }
  }
}

export function createSessionWatcher(): Worker {
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    name: "session-watcher",

    async start(): Promise<void> {
      await poll();
      timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    },

    async stop(): Promise<void> {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      knownModTimes.clear();
      listeners.clear();
    },
  };
}
