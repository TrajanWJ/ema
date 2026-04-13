export interface Worker {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly name: string;
}

export type WorkerFactory = () => Worker;

interface WorkerRegistration {
  name: string;
  factory: WorkerFactory;
  cronSchedule?: string | undefined;
  instance: Worker | null;
  state: "idle" | "running" | "disabled";
  failures: FailureRecord[];
  backoffMs: number;
}

interface FailureRecord {
  timestamp: number;
  error: string;
}

interface WorkerHealth {
  name: string;
  state: "idle" | "running" | "disabled";
  failureCount: number;
  backoffMs: number;
}

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;
const FAILURE_BUDGET = 5;
const FAILURE_WINDOW_MS = 60_000;

const registry = new Map<string, WorkerRegistration>();

export function registerWorker(
  name: string,
  factory: WorkerFactory,
  opts?: { cronSchedule?: string },
): void {
  const reg: WorkerRegistration = {
    name,
    factory,
    instance: null,
    state: "idle",
    failures: [],
    backoffMs: MIN_BACKOFF_MS,
  };
  if (opts?.cronSchedule !== undefined) {
    reg.cronSchedule = opts.cronSchedule;
  }
  registry.set(name, reg);
}

function pruneFailures(reg: WorkerRegistration): void {
  const cutoff = Date.now() - FAILURE_WINDOW_MS;
  reg.failures = reg.failures.filter((f) => f.timestamp > cutoff);
}

function recordFailure(reg: WorkerRegistration, error: string): void {
  reg.failures.push({ timestamp: Date.now(), error });
  pruneFailures(reg);

  if (reg.failures.length >= FAILURE_BUDGET) {
    reg.state = "disabled";
    console.error(`[worker-manager] ${reg.name} disabled: ${FAILURE_BUDGET} failures in ${FAILURE_WINDOW_MS / 1000}s`);
    return;
  }

  // Exponential backoff
  reg.backoffMs = Math.min(reg.backoffMs * 2, MAX_BACKOFF_MS);
}

async function startWorker(reg: WorkerRegistration): Promise<void> {
  if (reg.state === "disabled") return;

  try {
    const worker = reg.factory();
    reg.instance = worker;
    reg.state = "running";
    reg.backoffMs = MIN_BACKOFF_MS;
    await worker.start();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[worker-manager] ${reg.name} crashed: ${msg}`);
    recordFailure(reg, msg);

    // recordFailure may have flipped state to "disabled"; TS control-flow
    // analysis can't track that cross-function mutation, so we widen via `as`
    // and re-check here.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const currentState = reg.state as WorkerRegistration["state"];
    if (currentState !== "disabled") {
      reg.state = "idle";
      setTimeout(() => void startWorker(reg), reg.backoffMs);
    }
  }
}

export async function startAll(): Promise<void> {
  const starts: Promise<void>[] = [];
  for (const reg of registry.values()) {
    starts.push(startWorker(reg));
  }
  await Promise.allSettled(starts);
}

export async function stopAll(): Promise<void> {
  const stops: Promise<void>[] = [];
  for (const reg of registry.values()) {
    if (reg.instance && reg.state === "running") {
      stops.push(reg.instance.stop());
      reg.state = "idle";
      reg.instance = null;
    }
  }
  await Promise.allSettled(stops);
}

export function getHealth(): WorkerHealth[] {
  const results: WorkerHealth[] = [];
  for (const reg of registry.values()) {
    pruneFailures(reg);
    results.push({
      name: reg.name,
      state: reg.state,
      failureCount: reg.failures.length,
      backoffMs: reg.backoffMs,
    });
  }
  return results;
}
