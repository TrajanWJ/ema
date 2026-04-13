import { watch } from "chokidar";
import type { Worker } from "./worker-manager.js";

type EventType = "add" | "change" | "unlink";

export interface VaultEvent {
  type: EventType;
  path: string;
  timestamp: number;
}

export type VaultEventHandler = (event: VaultEvent) => void;

const listeners = new Set<VaultEventHandler>();

function vaultPath(): string {
  return process.env["EMA_VAULT_PATH"] ?? `${process.env["HOME"] ?? "~"}/.local/share/ema/vault`;
}

export function onVaultEvent(handler: VaultEventHandler): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

function emit(type: EventType, path: string): void {
  const event: VaultEvent = { type, path, timestamp: Date.now() };
  for (const handler of listeners) {
    try {
      handler(event);
    } catch {
      // Swallow listener errors to avoid crashing the watcher
    }
  }
}

export function createVaultWatcher(): Worker {
  let watcher: ReturnType<typeof watch> | null = null;

  return {
    name: "vault-watcher",

    async start(): Promise<void> {
      watcher = watch(vaultPath(), {
        ignoreInitial: true,
        persistent: true,
        depth: 10,
        ignored: [/(^|[/\\])\../, /node_modules/],
      });

      watcher
        .on("add", (p) => emit("add", p))
        .on("change", (p) => emit("change", p))
        .on("unlink", (p) => emit("unlink", p));

      // Wait for the watcher to be ready
      await new Promise<void>((resolve) => {
        watcher?.on("ready", resolve);
      });
    },

    async stop(): Promise<void> {
      if (watcher) {
        await watcher.close();
        watcher = null;
      }
      listeners.clear();
    },
  };
}
