---
id: EXTRACT-Ark0N-Codeman
type: extraction
layer: research
category: agent-orchestration
title: "Source Extractions — Ark0N/Codeman"
status: active
created: 2026-04-12
updated: 2026-04-12
author: A2-agent-orchestration-core
clone_path: "../_clones/Ark0N-Codeman/"
source:
  url: https://github.com/Ark0N/Codeman
  sha: 7b8b175
  clone_date: 2026-04-12
  depth: shallow-1
  size_mb: 92
tags: [extraction, agent-orchestration, codeman, primary-steal]
connections:
  - { target: "[[research/agent-orchestration/Ark0N-Codeman]]", relation: source_of }
  - { target: "[[research/_clones/INDEX]]", relation: references }
---

# Source Extractions — Ark0N/Codeman

> Companion extraction doc for `[[research/agent-orchestration/Ark0N-Codeman]]`. **PRIMARY STEAL.** Codeman is EMA's target stack in miniature: TypeScript + Fastify + node-pty + tmux + xterm.js + SSE. This is the reference implementation for the puppeteer-style agent runtime.

## Clone metadata

| Field | Value |
|---|---|
| URL | https://github.com/Ark0N/Codeman |
| Clone depth | --depth=1 shallow |
| Clone date | 2026-04-12 |
| Clone size | ~92 MB |
| Language | TypeScript (ES2022, NodeNext, strict) |
| License | MIT |
| Key commit SHA | `7b8b175` chore: version packages |
| Version | `aicodeman@0.5.12` (npm name differs from product name) |
| Stack | Node 18+, Fastify, node-pty, xterm.js, Vitest |
| Source size | 118 TS files, ~39k LOC in `src/` |

## Install attempt

- **Attempted:** no
- **Result:** skipped
- **If skipped, why:** Codeman spawns real tmux sessions and per CLAUDE.md `vitest run` full-suite kills live tmux sessions; the project declares this explicitly and warns against running it from within another Codeman-managed session. Installing `node-pty` would invoke a gyp build; not required for source extraction. All read-only extraction completed via Read tool.

## Run attempt

- **Attempted:** no
- **Result:** skipped
- **If skipped, why:** Same reason; we only need the patterns, not a running server. Also requires `claude` CLI binary and `CODEMAN_PASSWORD` for tunnel use.

## Key files identified

Ordered by porting priority:

1. `src/web/sse-stream-manager.ts` — **CORE STEAL**: 16/32/50ms adaptive batch loop, per-session timers, backpressure, Cloudflare padding.
2. `src/session.ts` — The PTY wrapper: `pty.spawn` → `onData` → split-path (fast idle detection + throttled expensive parsers) → EventEmitter.
3. `src/tmux-manager.ts` — Ghost session discovery + `tmux new-session -ds` + `remain-on-exit` + `respawn-pane` three-step creation to survive server restart.
4. `src/config/server-timing.ts` — All timing constants in one file: `TERMINAL_BATCH_INTERVAL = 16`, `BATCH_FLUSH_THRESHOLD = 32KB`, `SSE_HEARTBEAT_INTERVAL = 15s`, `SSE_PADDING_SIZE = 8KB`.
5. `src/web/session-listener-wiring.ts` — 25-listener attach/detach pattern with dependency injection via `SessionListenerDeps`.
6. `src/mux-interface.ts` — The `TerminalMultiplexer` interface worth copying verbatim for EMA's multi-backend support (tmux today, zellij/screen later).
7. `src/session-manager.ts` — Mutex-guarded `createSession` to prevent race conditions on limit checks.
8. `src/web/server.ts:1607-1798` — `restoreMuxSessions()`: reconcile → create `Session` for each alive mux → `startInteractive()` attaches PTY → restore saved state from `state.json`.
9. `src/utils/BufferAccumulator` + `StaleExpirationMap` — auto-trimming + TTL cleanup; used to bound terminal buffers for 24hr sessions.
10. `src/web/sse-events.ts` — 117-event SSE registry (backend + frontend mirror in `constants.js`).
11. `src/file-stream-manager.ts` — real-time file tailing streamed to SSE.
12. `src/respawn-controller.ts` — circuit breaker (CLOSED → HALF_OPEN → OPEN) for autonomous session respawn on death.

## Extracted patterns

### Pattern 1: 16ms adaptive terminal batch loop (THE core pattern)

**Files:**
- `src/config/server-timing.ts:14-20` — timing constants
- `src/web/sse-stream-manager.ts:220-279` — `batchTerminalData()` ingests raw PTY chunks
- `src/web/sse-stream-manager.ts:281-314` — `flushSessionTerminalBatch()` emits to SSE with DEC 2026 sync markers
- `src/web/session-listener-wiring.ts:86-90` — session `terminal` event routes to `batchTerminalData`

**Snippet (verbatim from source):**
```typescript
// src/config/server-timing.ts:14-20
/** Terminal data batching interval — targets 60fps (ms) */
export const TERMINAL_BATCH_INTERVAL = 16;

/** Immediate flush threshold for terminal batches (bytes).
 * Set high (32KB) to allow effective batching; avg Ink events are ~14KB. */
export const BATCH_FLUSH_THRESHOLD = 32 * 1024;
```

```typescript
// src/web/sse-stream-manager.ts:225-279
batchTerminalData(sessionId: string, data: string): void {
  // Skip if server is stopping
  if (this._isStopping) return;

  let chunks = this.terminalBatches.get(sessionId);
  if (!chunks) {
    chunks = [];
    this.terminalBatches.set(sessionId, chunks);
  }
  chunks.push(data);
  const prevSize = this.terminalBatchSizes.get(sessionId) ?? 0;
  const totalLength = prevSize + data.length;
  this.terminalBatchSizes.set(sessionId, totalLength);

  // Adaptive batching: detect rapid events and extend batch window (per-session)
  const now = Date.now();
  const lastEvent = this.lastTerminalEventTime.get(sessionId) ?? 0;
  const eventGap = now - lastEvent;
  this.lastTerminalEventTime.set(sessionId, now);

  // Adjust batch interval based on event frequency (per-session)
  // Rapid events (<10ms gap) = 50ms batch, moderate (<20ms) = 32ms, else 16ms
  let sessionInterval: number;
  if (eventGap > 0 && eventGap < 10) {
    sessionInterval = 50;
  } else if (eventGap > 0 && eventGap < 20) {
    sessionInterval = 32;
  } else {
    sessionInterval = TERMINAL_BATCH_INTERVAL;
  }

  // Flush immediately if batch is large for responsiveness
  if (totalLength > BATCH_FLUSH_THRESHOLD) {
    const existingTimer = this.terminalBatchTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.terminalBatchTimers.delete(sessionId);
    }
    this.flushSessionTerminalBatch(sessionId);
    return;
  }

  // Start per-session batch timer if not already running
  // Each session flushes independently — prevents one busy session from
  // forcing all sessions to flush at its rate (thundering herd)
  if (!this.terminalBatchTimers.has(sessionId)) {
    this.terminalBatchTimers.set(
      sessionId,
      setTimeout(() => {
        this.terminalBatchTimers.delete(sessionId);
        this.flushSessionTerminalBatch(sessionId);
      }, sessionInterval)
    );
  }
}
```

```typescript
// src/web/sse-stream-manager.ts:282-314
/** Flush a single session's batched terminal data */
private flushSessionTerminalBatch(sessionId: string): void {
  if (this._isStopping) {
    this.terminalBatches.delete(sessionId);
    this.terminalBatchSizes.delete(sessionId);
    return;
  }
  const chunks = this.terminalBatches.get(sessionId);
  if (chunks && chunks.length > 0) {
    // Join chunks only at flush time (avoids O(n^2) string concatenation in batchTerminalData)
    const data = chunks.join('');
    // Wrap batched output in DEC 2026 synchronized output markers so xterm.js
    // renders the entire batch atomically. Ink spinner frames (cursor-up + redraw)
    // do NOT emit their own 2026 markers, so without this wrapper each partial
    // cursor update renders individually, causing visible flicker.
    // xterm.js 6.0+ handles DEC 2026 natively: it buffers everything between
    // 2026h/2026l and renders in one pass.
    const syncData = '\x1b[?2026h' + data + '\x1b[?2026l';
    // Fast path: build SSE message directly without JSON.stringify on wrapper object.
    // Only the terminal data string needs escaping; sessionId is a UUID (safe to template).
    const escapedData = JSON.stringify(syncData);
    // Append tunnel padding for immediate Cloudflare proxy flush —
    // terminal data is high-frequency and latency-sensitive.
    const padding = this._isTunnelActive ? SSE_PADDING : '';
    const message = `event: session:terminal\ndata: {"id":"${sessionId}","data":${escapedData}}\n\n` + padding;
    for (const [client, filter] of this.sseClients) {
      // Skip clients that have a session filter and aren't subscribed to this session
      if (filter && !filter.has(sessionId)) continue;
      this.sendSSEPreformatted(client, message);
    }
  }
  this.terminalBatches.delete(sessionId);
  this.terminalBatchSizes.delete(sessionId);
}
```

**What to port to EMA:**
Port verbatim into `new-build/packages/agent-runtime/src/TerminalStreamManager.ts`. This IS the EMA agent runtime's streaming layer. Keep the three-tier adaptive window (10ms/20ms gap → 50/32/16ms batch) and the per-session timer map (staggered flush prevents thundering herd). The DEC 2026 sync markers (`\x1b[?2026h` / `\x1b[?2026l`) are essential — without them xterm.js re-renders on every partial frame from Ink (Claude's TUI framework) and users see flicker.

**Adaptation notes:**
- EMA can skip Cloudflare padding (only relevant if EMA exposes via tunnel).
- Replace Fastify `reply.raw.write()` with whatever HTTP plumbing EMA's Electron main process chooses; the logic is transport-agnostic.
- Keep `BATCH_FLUSH_THRESHOLD = 32 * 1024` — chosen because "avg Ink events are ~14KB."
- Keep backpressure handling (`reply.raw.write` returns false → listen for `drain`). The on-drain fallback here is to emit `session:needsRefresh` so the client re-fetches the full buffer. EMA should do the same.

### Pattern 2: Dual-path PTY onData handler (hot-path fast, expensive parsers throttled)

**Files:**
- `src/session.ts:1120-1212` — the `onData` handler splits hot-path (idle detection) from throttled expensive parsers

**Snippet (verbatim from source):**
```typescript
// src/session.ts:1120-1211
this.ptyProcess.onData((rawData: string) => {
  // Filter out focus escape sequences and Ctrl+L (form feed)
  const data = rawData.replace(FOCUS_ESCAPE_FILTER, '').replace(CTRL_L_PATTERN, '');
  if (!data) return; // Skip if only filtered sequences

  this._handleTerminalOutput(data);

  // === Auto-accept workspace trust dialog ===
  if (!this._trustDialogAccepted && data.includes('trust this folder')) {
    this._trustDialogAccepted = true;
    this.writeViaMux('\r');
  }

  // === Idle/working detection runs on every chunk (latency-sensitive) ===
  // Detect if Claude is working or at prompt
  // The prompt line contains "❯" when waiting for input
  if (data.includes('❯') || data.includes('\u276f')) {
    if (!this._awaitingIdleConfirmation) {
      if (this.activityTimeout) clearTimeout(this.activityTimeout);
      this._awaitingIdleConfirmation = true;
      this.activityTimeout = setTimeout(() => {
        this._awaitingIdleConfirmation = false;
        const wasWorking = this._isWorking;
        const isInitialReady = this._status === 'busy' && !this._isWorking;
        if (wasWorking || isInitialReady) {
          this._isWorking = false;
          this._status = 'idle';
          this._lastPromptTime = Date.now();
          this.emit('idle');
        }
      }, IDLE_DETECTION_DELAY_MS);
    }
  }

  // Fast path: check spinner characters on raw data (Unicode, never in ANSI sequences)
  const hasSpinner = SPINNER_PATTERN.test(data);
  if (hasSpinner) {
    if (!this._isWorking) {
      this._isWorking = true;
      this._status = 'busy';
      this.emit('working');
    }
    this._awaitingIdleConfirmation = false;
    if (this.activityTimeout) clearTimeout(this.activityTimeout);
  }

  // === Expensive processing (ANSI strip, Ralph, bash parser) is throttled ===
  // Instead of running regex-heavy parsers on every PTY chunk, we accumulate
  // raw data and process at most every EXPENSIVE_PROCESS_INTERVAL_MS.
  const now = Date.now();
  const elapsed = now - this._lastExpensiveProcessTime;
  if (elapsed >= Session.EXPENSIVE_PROCESS_INTERVAL_MS) {
    this._lastExpensiveProcessTime = now;
    const accumulated = this._pendingCleanData ? this._pendingCleanData + data : data;
    this._pendingCleanData = '';
    if (this._expensiveProcessTimer) {
      clearTimeout(this._expensiveProcessTimer);
      this._expensiveProcessTimer = null;
    }
    this._processExpensiveParsers(accumulated);
  } else {
    this._pendingCleanData += data;
    // Cap accumulated size to prevent unbounded growth
    if (this._pendingCleanData.length > 64 * 1024) {
      this._pendingCleanData = this._pendingCleanData.slice(-32 * 1024);
    }
    if (!this._expensiveProcessTimer) {
      this._expensiveProcessTimer = setTimeout(() => {
        this._expensiveProcessTimer = null;
        this._lastExpensiveProcessTime = Date.now();
        const pending = this._pendingCleanData;
        this._pendingCleanData = '';
        if (pending) {
          this._processExpensiveParsers(pending);
        }
      }, Session.EXPENSIVE_PROCESS_INTERVAL_MS - elapsed);
    }
  }
});
```

**What to port to EMA:**
This is the blueprint for EMA's `AgentSession.onPtyData()`. Two-path design:
1. **Fast path** (every chunk): prompt detection (`❯`), spinner detection, idle timeout, auto-accept trust dialog.
2. **Slow path** (throttled every N ms with ~64KB cap): ANSI strip, tool parsing, token counting, task tracking.

The lazy `getCleanData()` closure (`_processExpensiveParsers`) only strips ANSI when a consumer asks for it. Copy this.

**Adaptation notes:**
- EMA's "slow path" parsers will differ (EMA adds intent tracking, proposal capture, vApp bridges).
- Keep the `_pendingCleanData` cap at 64KB → 32KB trim. Memory-safe for 24hr sessions.
- The focus-escape filter (`\x1b\[?1004[hl]|\x1b\[[IO]`) and Ctrl+L stripping are worth copying — Claude CLI emits these and they cause noise.

### Pattern 3: Three-step tmux creation with `remain-on-exit` (ghost recovery survives server restart)

**Files:**
- `src/tmux-manager.ts:411-584` — `createSession()` full flow
- `src/tmux-manager.ts:887-973` — `reconcileSessions()` discovers ghost sessions on boot
- `src/web/server.ts:1607-1798` — `restoreMuxSessions()` rebuilds `Session` wrappers for each discovered tmux session

**Snippet (verbatim from source):**
```typescript
// src/tmux-manager.ts:474-514
// Build the full command to run inside tmux
const fullCmd = `${pathExport}${envExportsStr} && ${cmd}`;

// Create tmux session in three steps to handle cold-start (no server running)
// and avoid the race where the command exits before remain-on-exit is set:
// 1. Create session with default shell (starts tmux server, stays alive)
// 2. Set remain-on-exit (server now exists, session won't vanish on exit)
// 3. Replace shell with actual command via respawn-pane (no terminal echo)
// Unset $TMUX so nested sessions work when the dev server itself runs inside tmux.
const cleanEnv = { ...process.env };
delete cleanEnv.TMUX;
execSync(`tmux new-session -ds "${muxName}" -c "${workingDir}" -x 120 -y 40`, {
  cwd: workingDir,
  timeout: EXEC_TIMEOUT_MS,
  stdio: 'ignore',
  env: cleanEnv,
});

// Set remain-on-exit now that the server is running — must be before respawn-pane
try {
  execSync(`tmux set-option -t "${muxName}" remain-on-exit on`, {
    timeout: EXEC_TIMEOUT_MS,
    stdio: 'ignore',
  });
} catch {
  /* Non-critical */
}

// Replace the shell with the actual command (no echo in terminal)
execSync(`tmux respawn-pane -k -t "${muxName}" bash -c ${JSON.stringify(fullCmd)}`, {
  timeout: EXEC_TIMEOUT_MS,
  stdio: 'ignore',
});
```

```typescript
// src/tmux-manager.ts:890-973
async reconcileSessions(): Promise<{ alive: string[]; dead: string[]; discovered: string[] }> {
  const alive: string[] = [];
  const dead: string[] = [];
  const discovered: string[] = [];

  // Batch: single tmux call to get all session names + pane PIDs (replaces N per-session subprocess calls)
  const activeSessions = new Map<string, number>();
  try {
    const output = execSync("tmux list-panes -a -F '#{session_name}\t#{pane_pid}' 2>/dev/null || true", {
      encoding: 'utf-8',
      timeout: EXEC_TIMEOUT_MS,
    }).trim();

    for (const line of output.split('\n')) {
      if (!line) continue;
      const sep = line.indexOf('\t');
      if (sep === -1) continue;
      const name = line.slice(0, sep);
      const pid = parseInt(line.slice(sep + 1), 10);
      if (name && !Number.isNaN(pid)) {
        activeSessions.set(name, pid);
      }
    }
  } catch (err) {
    console.error('[TmuxManager] Failed to list tmux panes:', err);
  }

  // Check known sessions against the batch result (O(1) map lookup instead of subprocess per session)
  for (const [sessionId, session] of this.sessions) {
    const pid = activeSessions.get(session.muxName);
    if (pid !== undefined) {
      alive.push(sessionId);
      if (pid !== session.pid) {
        session.pid = pid;
      }
    } else {
      dead.push(sessionId);
      this.sessions.delete(sessionId);
      this.emit('sessionDied', { sessionId });
    }
  }

  // Discover unknown codeman/claudeman sessions from the same batch result
  const knownMuxNames = new Set<string>();
  for (const session of this.sessions.values()) {
    knownMuxNames.add(session.muxName);
  }

  for (const [sessionName, pid] of activeSessions) {
    if (!sessionName.startsWith('codeman-') && !sessionName.startsWith('claudeman-')) continue;
    if (knownMuxNames.has(sessionName)) continue;

    const fragment = sessionName.replace(/^(?:codeman|claudeman)-/, '');
    const sessionId = `restored-${fragment}`;
    const session: MuxSession = {
      sessionId,
      muxName: sessionName,
      pid,
      createdAt: Date.now(),
      workingDir: process.cwd(),
      mode: 'claude',
      attached: false,
      name: `Restored: ${sessionName}`,
    };
    this.sessions.set(sessionId, session);
    discovered.push(sessionId);
    console.log(`[TmuxManager] Discovered unknown tmux session: ${sessionName} (PID ${pid})`);
  }

  if (dead.length > 0 || discovered.length > 0) {
    this.saveSessions();
  }

  return { alive, dead, discovered };
}
```

**What to port to EMA:**
This gives EMA's agent runtime the "persistence across daemon restart" property: a user starts an agent, kills the EMA main process, and on restart EMA reattaches to the still-running tmux pane. Three pieces:
1. **`tmux new-session -ds` + `remain-on-exit on` + `respawn-pane -k`** — avoid the race where the command exits before remain-on-exit is set.
2. **Single `tmux list-panes -a -F '#{session_name}\t#{pane_pid}'`** call replaces N subprocess calls for N sessions. Critical for 20+ session scale.
3. **Name prefix convention** (`codeman-<uuid-fragment>`) lets `reconcileSessions()` discover unknown sessions without any state file.

**Adaptation notes:**
- EMA uses its own prefix: `ema-<sessionId.slice(0,8)>` in `AgentRuntime.createSession`.
- The `isValidMuxName` regex `/^codeman-[a-f0-9-]+$/` + `isValidPath` blocks command injection through session ID / working dir. Port this too — EMA exposes these from the CLI.
- Keep the `VITEST` env guard: tests must never invoke real tmux. Codeman's `IS_TEST_MODE = !!process.env.VITEST` short-circuits every shell call in this file.

### Pattern 4: `TerminalMultiplexer` interface — backend-agnostic pluggability

**Files:**
- `src/mux-interface.ts:22-196` — full interface

**Snippet (verbatim from source):**
```typescript
// src/mux-interface.ts:93-196
export interface TerminalMultiplexer extends EventEmitter {
  /** Which backend this instance uses */
  readonly backend: 'tmux';

  // ========== Lifecycle ==========
  createSession(options: CreateSessionOptions): Promise<MuxSession>;
  killSession(sessionId: string): Promise<boolean>;
  destroy(): void;

  // ========== Queries ==========
  getSessions(): MuxSession[];
  getSession(sessionId: string): MuxSession | undefined;
  getSessionsWithStats(): Promise<MuxSessionWithStats[]>;
  getProcessStats(sessionId: string): Promise<ProcessStats | null>;

  // ========== Input ==========
  sendInput(sessionId: string, input: string): Promise<boolean>;

  // ========== Metadata ==========
  updateSessionName(sessionId: string, name: string): boolean;
  setAttached(sessionId: string, attached: boolean): void;
  registerSession(session: MuxSession): void;
  updateRespawnConfig(sessionId: string, config: PersistedRespawnConfig | undefined): void;
  clearRespawnConfig(sessionId: string): void;
  updateRalphEnabled(sessionId: string, enabled: boolean): void;

  // ========== Discovery ==========
  reconcileSessions(): Promise<{ alive: string[]; dead: string[]; discovered: string[] }>;

  // ========== Stats Collection ==========
  startStatsCollection(intervalMs?: number): void;
  stopStatsCollection(): void;

  // ========== PTY Attachment ==========
  getAttachCommand(): string;
  getAttachArgs(muxName: string): string[];

  // ========== Availability ==========
  isAvailable(): boolean;
  muxSessionExists(muxName: string): boolean;
  isPaneDead(muxName: string): boolean;
  respawnPane(options: RespawnPaneOptions): Promise<number | null>;
}
```

**What to port to EMA:**
Copy this interface almost verbatim into `new-build/packages/agent-runtime/src/types/TerminalMultiplexer.ts`. EMA needs tmux-first but the interface lets a `ZellijMultiplexer` or `ScreenMultiplexer` be dropped in later without touching the Session class. The distinction Codeman makes between `getAttachCommand()` + `getAttachArgs()` (returning shell-agnostic command+args) and the caller's `pty.spawn(cmd, args)` is critical — it's what makes the muxer replaceable.

**Adaptation notes:**
- Drop Ralph-specific methods (`updateRalphEnabled`) for the first port. EMA doesn't have Ralph loops yet; add them when the loop subsystem lands.
- Widen `readonly backend: 'tmux'` to `'tmux' | 'zellij' | 'screen' | 'none'` from day one to avoid a breaking change later.
- `respawnPane` is the autonomous-run primitive: restart a dead Claude process without tearing the PTY down. EMA needs this for long-running agents.

### Pattern 5: Mux-first PTY attachment with direct-PTY fallback

**Files:**
- `src/session.ts:991-1112` — `startInteractive()`

**Snippet (verbatim from source):**
```typescript
// src/session.ts:1003-1112 (abridged)
// If mux wrapping is enabled, create or attach to a mux session
if (this._useMux && this._mux) {
  try {
    const { isRestored } = await this._setupOrAttachMuxSession({ /* ... */ });
    // ... prompt readiness detection ...
  } catch (err) {
    console.error('[Session] Failed to create mux session, falling back to direct PTY:', err);
    this._useMux = false;
    this._muxSession = null;
  }
}

// Fallback to direct PTY if mux is not used
if (!this.ptyProcess) {
  if (this.mode === 'opencode') {
    throw new Error('OpenCode sessions require tmux. Direct PTY fallback is not supported.');
  }
  try {
    // Pass --session-id to use the SAME ID as the Codeman session
    // This ensures subagents can be directly matched to the correct tab
    const args = buildInteractiveArgs(this.id, this._claudeMode, this._model, this._allowedTools);
    this.ptyProcess = pty.spawn('claude', args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: this.workingDir,
      env: buildClaudeEnv(this.id),
    });
  } catch (spawnErr) {
    console.error('[Session] Failed to spawn Claude PTY:', spawnErr);
    this._status = 'stopped';
    this.emit('error', `Failed to start Claude: ${spawnErr}`);
    throw new Error(`Failed to spawn Claude process: ${spawnErr}`);
  }
}
```

```typescript
// src/tmux-manager.ts:1537-1543
getAttachCommand(): string {
  return 'tmux';
}

getAttachArgs(muxName: string): string[] {
  return ['attach-session', '-t', muxName];
}
```

**What to port to EMA:**
EMA's `AgentSession` should try mux first, fall back to direct `pty.spawn('claude', …)` on failure. When mux is used, `pty.spawn('tmux', ['attach-session', '-t', muxName])` — the local PTY attaches to the already-running tmux pane. When mux is not used, the PTY runs `claude` directly. Both code paths then register the same `onData` handler.

**Adaptation notes:**
- Codeman uses `cols: 120, rows: 40` as default PTY geometry. EMA should let the xterm.js frontend dictate this per the `AgentRuntime.createSession({ cols, rows })` signature.
- The `--session-id` flag for Claude CLI is important: it makes Claude use a stable session UUID instead of generating one, so Codeman can match subagents to tabs. EMA should forward its own session UUID the same way.
- OpenCode cannot do direct PTY because it needs tmux's `setenv` for API keys. EMA should respect this — store the constraint in the adapter per backend.

### Pattern 6: Mutex-guarded session creation

**Files:**
- `src/session-manager.ts:109-176`

**Snippet (verbatim from source):**
```typescript
// src/session-manager.ts:109-176
async createSession(workingDir: string): Promise<Session> {
  // Wait for any pending session creation to complete (mutex pattern)
  while (this._sessionCreationLock) {
    await this._sessionCreationLock;
  }

  // Create a new lock promise that others will wait on
  let unlock!: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  this._sessionCreationLock = lockPromise;

  try {
    const config = this.store.getConfig();

    // Check limit INSIDE the lock to prevent race conditions
    if (this.sessions.size >= config.maxConcurrentSessions) {
      throw new Error(`Maximum concurrent sessions (${config.maxConcurrentSessions}) reached`);
    }

    const session = new Session({ workingDir });
    // ... wire event forwarding with stored handlers for cleanup ...
    await session.start();
    this.sessions.set(session.id, session);
    this.store.setSession(session.id, session.toState());
    this.emit('sessionStarted', session);
    return session;
  } finally {
    this._sessionCreationLock = null;
    unlock();
  }
}
```

**What to port to EMA:**
Drop this pattern straight into `new-build/packages/core/src/SessionRegistry.ts`. Without the mutex, two concurrent `POST /sessions` calls with `maxConcurrentSessions=1` BOTH see `sessions.size === 0`, both pass the check, both create a session. EMA will hit this the first time a vApp spawns an agent while a CLI `ema spawn` is also running.

**Adaptation notes:**
- The comment "Define unlock first to ensure it's always in scope before promise assignment" hints at a TS strict-mode gotcha — without `let unlock!:` TS complains `unlock` might be undefined.
- Also note: listener handlers are stored in a separate `sessionHandlers: Map<string, SessionHandlers>` specifically so they can be removed on `stopSession()`. Event listener leaks are the #1 source of 24hr memory growth in Node EventEmitters.

## Gotchas found while reading

- **Claude CLI needs a specific env dance.** `buildClaudeEnv(sessionId)` in `session-cli-builder.ts` builds a specific env map; `cleanEnv = { ...process.env }; delete cleanEnv.TMUX;` is required to unset `$TMUX` when Codeman itself runs inside tmux (dev server nesting).
- **DEC 2026 is load-bearing.** Without `\x1b[?2026h` + `\x1b[?2026l` wrapping each batched flush, xterm.js renders Ink's cursor-up-and-redraw frames individually → visible flicker. This is not well-known outside Codeman; the comment at `sse-stream-manager.ts:292-297` is the only write-up.
- **Focus escape sequences break input counts.** The `\x1b[?1004[hl]` + `\x1b[[IO]` filter at `session.ts:104` is necessary because tmux/xterm emit focus-in/out reports that Claude CLI then prints back to the terminal, looking like user-generated output. Without filtering, the idle detection gets confused.
- **Ghost session discovery is name-prefixed, not state-file-tracked.** `reconcileSessions()` treats any tmux session named `codeman-<hex>` or `claudeman-<hex>` as potentially restorable, even if it's not in `mux-sessions.json`. This is how Codeman recovers from a corrupt state file.
- **Single-line input only.** `writeViaMux` sends text + Enter as separate tmux `send-keys` calls; multi-line breaks Ink. Codeman enforces this by design (see CLAUDE.md line 7 of "Common Gotchas").
- **Static file cache + SSE ≠ same headers.** `server.ts` sets `maxAge: '1y'` on static assets but SSE response must never cache; this is easy to get wrong with a single middleware.
- **Backpressure recovery = full buffer reload.** When a client's TCP buffer fills, `sendSSEPreformatted` adds it to `backpressuredClients` and on `drain` emits `SessionNeedsRefresh` so the client re-fetches the full terminal buffer. This is cheaper than replaying dropped chunks. Port this policy.
- **`BufferAccumulator` auto-trims.** Used for `_terminalBuffer`; not shown but `utils/index.ts` has `MAX_TERMINAL_BUFFER_SIZE` and `TRIM_TERMINAL_TO` constants that prevent unbounded growth over 24hr runs.
- **Trust dialog auto-accept.** `if (data.includes('trust this folder')) { this.writeViaMux('\r'); }` — Claude CLI 2.x shows a one-time per-directory trust prompt that will deadlock an autonomous session if not auto-accepted.
- **vitest full-suite is lethal inside a managed session.** Don't ask why they know this. Tests spawn/kill real tmux sessions and there's no isolation between "real" and "test" panes except the `VITEST` env guard.

## Port recommendation

Concrete next steps for EMA's port:

1. **Create `new-build/packages/agent-runtime/`** and port in this order:
   1. `TerminalMultiplexer` interface from `mux-interface.ts` — the entire file.
   2. `TmuxMultiplexer` implementation from `tmux-manager.ts` — extract `createSession`, `killSession`, `reconcileSessions`, `sendInput`, `respawnPane`, `getAttachCommand`/`getAttachArgs`, and the shell-escape helpers.
   3. `AgentSession` from `session.ts` — take the `startInteractive` path and the dual-path `onData` handler. Strip Ralph/Ink parsers for v1; add them back when EMA has its own loop system.
   4. `TerminalStreamManager` from `sse-stream-manager.ts` — the adaptive batch loop. Swap Fastify `reply.raw.write` for EMA's transport (Electron IPC or HTTP).
   5. `SessionRegistry` from `session-manager.ts` — mutex + event forwarding.
2. **Port `config/server-timing.ts` verbatim** into `new-build/packages/agent-runtime/src/config/timing.ts`. These constants are tuned.
3. **Dependency decisions:**
   - `node-pty` — use exact version Codeman uses to get prebuilt binaries. Check `package.json`.
   - `uuid` — already in Codeman; EMA can use `crypto.randomUUID()`.
   - No Fastify needed for the agent-runtime package.
4. **Testing approach:**
   - Copy Codeman's `VITEST` env-guard into `TmuxMultiplexer`. Tests must NEVER run real tmux.
   - Add a `MockTerminalMultiplexer` implementing the interface for unit tests.
   - Mirror `test/respawn-test-utils.ts`: `MockSession` class that simulates PTY output without spawning.
5. **Risks:**
   - Node-pty prebuilt binaries may not exist for Electron's specific Node ABI. EMA may need `electron-rebuild`.
   - DEC 2026 support in xterm.js — confirm version >= 6.0 when picking the frontend xterm version.
   - `pty.spawn` errors in `node-pty` bubble as synchronous throws, not promise rejections. Wrap in try/catch per Codeman's pattern.
   - EMA's CLI+GUI dual path means two clients may both subscribe to the same session's SSE — verify the `sseClients` map keyed by `FastifyReply` translates cleanly to whatever EMA uses (probably `WebContents.send` for the Electron side).

## Related extractions

- `[[research/_extractions/Dicklesworthstone-coding_agent_session_search]]` — session indexer, complementary to live session runtime
- `[[research/_extractions/Dicklesworthstone-ntm]]` — Named Tmux Manager, alt mux abstraction
- `[[research/_extractions/generalaction-emdash]]` — 23-provider adapter catalog
- `[[research/_extractions/Dicklesworthstone-claude_code_agent_farm]]` — JSON file-lock coordination for multi-agent

## Connections

- `[[research/agent-orchestration/Ark0N-Codeman]]` — original research node
- `[[research/_clones/INDEX]]`

#extraction #agent-orchestration #codeman #primary-steal
