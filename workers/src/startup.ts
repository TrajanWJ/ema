import { createAgentRuntimeHeartbeat } from "./agent-runtime-heartbeat.js";
import { createIntentWatcher } from "./intent-watcher.js";
import { createSessionWatcher } from "./session-watcher.js";
import { createVaultWatcher } from "./vault-watcher.js";
import { registerWorker, startAll, stopAll } from "./worker-manager.js";

let registered = false;

function registerDefaultWorkers(): void {
  if (registered) return;
  registered = true;

  registerWorker("vault-watcher", createVaultWatcher);
  registerWorker("session-watcher", createSessionWatcher);
  registerWorker("agent-runtime-heartbeat", createAgentRuntimeHeartbeat);
  registerWorker("intent-watcher", createIntentWatcher);
}

async function main(): Promise<void> {
  registerDefaultWorkers();
  await startAll();
}

function handleShutdown(): void {
  void stopAll().finally(() => process.exit(0));
}

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

void main().catch((error) => {
  console.error("[workers] failed to start", error);
  process.exit(1);
});
