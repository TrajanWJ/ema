/**
 * BootstrapWatcher — self-healing one-shot bootstrap with retry.
 *
 * Ports `Ema.IntentionFarmer.BootstrapWatcher`. The old module was a
 * GenServer that retried with exponential backoff and then rescanned on a
 * fixed interval. We collapse that down to a promise-based `run()` that
 * accepts an async bootstrap function and retries on rejection.
 *
 * Scheduling of the periodic rescan is left to the caller — a subservice
 * here has no business spawning timers that outlive the request.
 */

export interface BootstrapWatcherOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export interface BootstrapWatcherResult<T> {
  ok: boolean;
  attempts: number;
  result: T | null;
  error: string | null;
}

const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_INITIAL_DELAY = 10; // kept tiny so tests run fast
const DEFAULT_MAX_DELAY = 5 * 60 * 1000;

export class BootstrapWatcher {
  private readonly maxAttempts: number;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(opts: BootstrapWatcherOptions = {}) {
    this.maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.initialDelayMs = opts.initialDelayMs ?? DEFAULT_INITIAL_DELAY;
    this.maxDelayMs = opts.maxDelayMs ?? DEFAULT_MAX_DELAY;
  }

  async run<T>(
    fn: () => Promise<T>,
  ): Promise<BootstrapWatcherResult<T>> {
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < this.maxAttempts) {
      attempt += 1;
      try {
        const result = await fn();
        return { ok: true, attempts: attempt, result, error: null };
      } catch (err) {
        lastError = err;
        if (attempt >= this.maxAttempts) break;
        const delay = Math.min(
          this.initialDelayMs * 2 ** (attempt - 1),
          this.maxDelayMs,
        );
        await sleep(delay);
      }
    }

    return {
      ok: false,
      attempts: attempt,
      result: null,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
