---
id: EXTRACT-microsoft-node-pty
type: extraction
layer: research
category: cli-terminal
title: "Source Extractions — microsoft/node-pty"
status: active
created: 2026-04-12
updated: 2026-04-12
author: agent-A7
clone_path: "../_clones/microsoft-node-pty/"
source:
  url: https://github.com/microsoft/node-pty
  sha: 6d10f37
  clone_date: 2026-04-12
  depth: shallow-1
  size_mb: 4.4
tags: [extraction, cli-terminal, node-pty, terminal-runtime]
connections:
  - { target: "[[research/cli-terminal/microsoft-node-pty]]", relation: source_of }
  - { target: "[[research/_clones/INDEX]]", relation: references }
---

# Source Extractions — microsoft/node-pty

> Companion extraction for `[[research/cli-terminal/microsoft-node-pty]]`. The reference IPty API + platform-specific implementations. EMA's agent runtime uses node-pty to spawn a pty per session (puppeteer model).

## Clone metadata

| Field | Value |
|---|---|
| URL | https://github.com/microsoft/node-pty |
| Clone depth | --depth=1 shallow |
| Clone date | 2026-04-12 |
| Clone size | ~4.4 MB |
| Language | TypeScript (+ C++ native binding) |
| License | MIT |
| Key commit SHA | `6d10f37` |

## Install attempt

- **Attempted:** no
- **Command:** N/A
- **Result:** skipped
- **If skipped, why:** Mission brief says `npm install node-pty` in a test dir is OK but not required. Install is expensive (triggers C++ binding build via node-gyp requiring python3 + platform SDK). The TypeScript source + typings file gave everything needed.

## Run attempt

- **Attempted:** no
- **Command:** N/A
- **Result:** skipped
- **If skipped, why:** No run needed — the source + examples in `fixtures/` documents usage.

## Key files identified

1. `typings/node-pty.d.ts` — **the public API surface**. This is what EMA's TypeScript code imports (via `import {IPty} from 'node-pty'`). Copy verbatim; it's the contract.
2. `src/index.ts` — runtime dispatcher that chooses Windows vs Unix implementation.
3. `src/unixTerminal.ts` — Unix (Linux/macOS) implementation using `forkpty(3)`.
4. `src/windowsTerminal.ts` — Windows implementation (ConPTY/winpty).
5. `src/terminal.ts` — shared base class with read/write buffer + flow control.
6. `src/interfaces.ts` — internal interfaces (options types, `ITerminal`).
7. `examples/electron/` — reference Electron wiring (uses `main.js` + `ipcMain` + `renderer.js`).

## Extracted patterns

### Pattern 1: IPty interface (the public contract)

**Files:**
- `typings/node-pty.d.ts:117-199` — the `IPty` interface
- `typings/node-pty.d.ts:20-77` — base fork options
- `typings/node-pty.d.ts:88-112` — Windows-specific fork options

**Snippet (verbatim):**
```typescript
// typings/node-pty.d.ts:114-199
/**
 * An interface representing a pseudoterminal.
 */
export interface IPty {
  /**
   * The process ID of the outer process.
   */
  readonly pid: number;

  /**
   * The column size in characters.
   */
  readonly cols: number;

  /**
   * The row size in characters.
   */
  readonly rows: number;

  /**
   * The title of the active process.
   */
  readonly process: string;

  /**
   * (EXPERIMENTAL)
   * Whether to handle flow control. Useful to disable/re-enable flow control during runtime.
   * Use this for binary data that is likely to contain the `flowControlPause` string by accident.
   */
  handleFlowControl: boolean;

  /**
   * Adds an event listener for when a data event fires. This happens when data is returned from
   * the pty.
   * @returns an `IDisposable` to stop listening.
   */
  readonly onData: IEvent<string>;

  /**
   * Adds an event listener for when an exit event fires. This happens when the pty exits.
   * @returns an `IDisposable` to stop listening.
   */
  readonly onExit: IEvent<{ exitCode: number, signal?: number }>;

  /**
   * Resizes the dimensions of the pty.
   * @param columns The number of columns to use.
   * @param rows The number of rows to use.
   * @param pixelSize Optional pixel dimensions of the pty. On Unix, this sets the `ws_xpixel`
   * and `ws_ypixel` fields of the `winsize` struct. Applications running in the pty can read
   * these values via the `TIOCGWINSZ` ioctl. This parameter is ignored on Windows.
   */
  resize(columns: number, rows: number, pixelSize?: { width: number, height: number }): void;

  /**
   * Clears the pty's internal representation of its buffer. This is a no-op
   * unless on Windows/ConPTY. This is useful if the buffer is cleared on the
   * frontend in order to synchronize state with the backend to avoid ConPTY
   * possibly reprinting the screen.
   */
  clear(): void;

  /**
   * Writes data to the pty.
   * @param data The data to write.
   */
  write(data: string | Buffer): void;

  /**
   * Kills the pty.
   * @param signal The signal to use, defaults to SIGHUP. This parameter is not supported on
   * Windows.
   * @throws Will throw when signal is used on Windows.
   */
  kill(signal?: string): void;

  /**
   * Pauses the pty for customizable flow control.
   */
  pause(): void;

  /**
   * Resumes the pty for customizable flow control.
   */
  resume(): void;
}
```

```typescript
// typings/node-pty.d.ts:18 — spawn signature
export function spawn(
  file: string,
  args: string[] | string,
  options: IPtyForkOptions | IWindowsPtyForkOptions
): IPty;
```

```typescript
// typings/node-pty.d.ts:20-77 — base options
export interface IBasePtyForkOptions {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: { [key: string]: string | undefined };
  encoding?: string | null;
  handleFlowControl?: boolean;
  flowControlPause?: string;
  flowControlResume?: string;
}

export interface IPtyForkOptions extends IBasePtyForkOptions {
  uid?: number;
  gid?: number;
}
```

**What to port to EMA:**
EMA does NOT reimplement node-pty — it *consumes* node-pty as a dependency. What lives in EMA's codebase is:
1. A `TerminalSession` wrapper around `IPty` (the `puppeteer` wrapper — agent runtime block spec).
2. A typed event emitter that converts `pty.onData((string) => {})` into EMA's event bus.
3. A `kill()` wrapper that catches Windows errors and falls back to process-tree kill.

**Port target:** `new-build/core/terminal/TerminalSession.ts`

**Adaptation notes:**
- The `onData`/`onExit` use oncreation-style `IDisposable` events. EMA should wrap these in EMA's own EventEmitter pattern (node's built-in `EventEmitter` or `mitt`).
- `encoding: 'utf8' | null` — keep as string for normal shells, flip to `null` (Buffer) only if streaming binary data or if need to capture ANSI bytes losslessly.
- `env` is per-process, merge carefully: `{...process.env, ...customEnv, TERM: 'xterm-256color'}`. Don't forget `LANG` / `COLORTERM`.

### Pattern 2: Platform dispatch

**Files:**
- `src/index.ts:1-53` — runtime dispatcher

**Snippet (verbatim):**
```typescript
// src/index.ts:11-53
let terminalCtor: any;
if (process.platform === 'win32') {
  terminalCtor = require('./windowsTerminal').WindowsTerminal;
} else {
  terminalCtor = require('./unixTerminal').UnixTerminal;
}

export function spawn(
  file?: string,
  args?: ArgvOrCommandLine,
  opt?: IPtyForkOptions | IWindowsPtyForkOptions
): ITerminal {
  return new terminalCtor(file, args, opt);
}

export function open(options: IPtyOpenOptions): ITerminal {
  return terminalCtor.open(options);
}

/**
 * Expose the native API when not Windows, note that this is not public API and
 * could be removed at any time.
 */
export const native = (process.platform !== 'win32' ? loadNativeModule('pty').module : null);
```

**What to port to EMA:**
No porting — just consume. But note: EMA is **Linux-first, macOS-second**. The Windows path is deferred. `windowsTerminal.ts` (+ ConPTY adapter) is ~600 lines; postpone.

### Pattern 3: Unix fork + Socket pipe

**Files:**
- `src/unixTerminal.ts:47-220` — `UnixTerminal` constructor + pty setup

**Snippet (verbatim):**
```typescript
// src/unixTerminal.ts:76-150
const encoding = (opt.encoding === undefined ? 'utf8' : opt.encoding);

const onexit = (code: number, signal: number): void => {
  // XXX Sometimes a data event is emitted after exit. Wait til socket is
  // destroyed.
  if (!this._emittedClose) {
    if (this._boundClose) {
      return;
    }
    this._boundClose = true;
    // From macOS High Sierra 10.13.2 sometimes the socket never gets
    // closed. A timeout is applied here to avoid the terminal never being
    // destroyed when this occurs.
    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      this._socket.destroy();
    }, DESTROY_SOCKET_TIMEOUT_MS);
    this.once('close', () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      this.emit('exit', code, signal);
    });
    return;
  }
  this.emit('exit', code, signal);
};

// fork
const term = pty.fork(file, args, parsedEnv, cwd, this._cols, this._rows, uid, gid, (encoding === 'utf8'), helperPath, onexit);

this._socket = new tty.ReadStream(term.fd);
if (encoding !== null) {
  this._socket.setEncoding(encoding);
}
this._writeStream = new CustomWriteStream(term.fd, (encoding || undefined) as BufferEncoding);
```

**What to port to EMA:**
Don't port — but **know** this shape: `pty.fork()` (C++ native call) returns a `{fd, pid, pty}` object. fd is wrapped in `tty.ReadStream` for onData callbacks and `tty.WriteStream` for write. The `DESTROY_SOCKET_TIMEOUT_MS = 200` (line 24) is a macOS bug workaround — applications querying IPty state need to know exit fires up to 200ms after the pty actually exits.

**Adaptation notes:**
- The `spawn-helper` binary (line 17) is a small C program shipped with node-pty — it handles the edge case where the child process terminates immediately before setsid. EMA's builder must not `asar`-pack `spawn-helper`; node-pty auto-rewrites `app.asar` → `app.asar.unpacked`. See `unixTerminal.ts:18-20`.

### Pattern 4: DataBatcher (from Hyper — batching pattern applied to node-pty)

Hyper's `session.ts` wraps node-pty with a data batcher (see `vercel-hyper/app/session.ts:43-85`). EMA should adopt this pattern for IPC performance — raw `pty.onData` fires at pty write granularity (~4KB chunks), and sending each chunk over an IPC channel has high overhead. The batcher collapses chunks into 16ms windows or 200KB batches.

**File:** `vercel-hyper/app/session.ts:43-85` (covered in the hyper extraction).

## Gotchas found while reading

- **`kill(signal)` on Windows throws.** The IPty contract says `@throws Will throw when signal is used on Windows`. EMA's TerminalSession.kill() must branch: `pty.kill(process.platform === 'win32' ? undefined : 'SIGHUP')`.
- **`encoding: null` yields Buffer data; any other encoding yields string.** If EMA needs to parse ANSI escape codes byte-by-byte, set `encoding: null`. Otherwise leave default `utf8` and onData provides a string.
- **`handleFlowControl: true`** intercepts XON/XOFF (default `'\x13'`, `'\x11'`) bytes in the stream and pauses/resumes the socket. DANGER: if EMA is streaming binary data (images, pipes), flow control bytes can appear legitimately and get eaten. Only enable flow control for text-only pty sessions.
- **`open(options)` creates an unconnected pty** (for when EMA wants to pre-allocate a pty and attach a process later). Unix-only; Windows throws.
- **`clear()` is a no-op on Unix**, only meaningful on Windows/ConPTY. EMA's terminal-clear implementation should also issue `xterm.clear()` on the browser side for cross-platform consistency.
- **ConPTY version mismatch is common on Windows.** `useConptyDll` (line 105) ships a specific conpty.dll with node-pty to avoid relying on the OS version. If EMA's Electron build is older than the node-pty version, ConPTY can deadlock. Set `useConptyDll: true` explicitly in Windows builds.
- **Double exit bug** on macOS High Sierra 10.13.2 — the 200ms socket-destroy timeout is a hack. Don't remove it.
- **env sanitization** — `unixTerminal.ts:67` calls `_sanitizeEnv` when inheriting `process.env`. This strips variables that would break child processes. In EMA, if passing custom env, don't call sanitize (it would only strip EMA-internal vars).
- **`parsedEnv`** is a string array (`"KEY=value"` format) passed to C++ fork, not a JS object. The `_parseEnv` method in base Terminal handles conversion.
- **PATH coercion** — node-pty doesn't add anything to PATH; if `PATH=/usr/bin:/bin` and you spawn `claude`, you need the full path. EMA should resolve executable paths with `which` before spawning.

## Port recommendation

1. **Do NOT port node-pty.** Add as dependency: `pnpm add node-pty` (must be rebuilt for Electron version via `electron-rebuild`).
2. **Create `new-build/core/terminal/TerminalSession.ts`** — a thin wrapper around `IPty`:
   ```ts
   export class TerminalSession extends EventEmitter {
     private pty: IPty
     readonly id: string
     readonly shell: string

     constructor(opts: SessionOptions) { ... }
     write(data: string): void { this.pty.write(data) }
     resize(cols: number, rows: number): void { this.pty.resize(cols, rows) }
     kill(): void {
       try {
         this.pty.kill(process.platform === 'win32' ? undefined : 'SIGHUP')
       } catch (err) { /* log + fall through */ }
     }
     // emit('data', data) + emit('exit', code)
   }
   ```
3. **Copy Hyper's `DataBatcher`** pattern (BATCH_DURATION_MS=16, BATCH_MAX_SIZE=200*1024).
4. **Wire to IPC**: Electron main process holds the `TerminalSession`, renderer holds `Xterm.Terminal`. Main forwards `onData` → IPC → renderer's `xterm.write()`. Renderer's `xterm.onData` → IPC → `session.write()`.
5. **Electron rebuild step** in `package.json`:
   ```json
   "scripts": { "postinstall": "electron-rebuild -m ." }
   ```
6. **Windows support** — deferred. For Linux-first MVP, only UnixTerminal matters.

## Related extractions

- `[[research/_extractions/vercel-hyper]]` — canonical Electron+pty wiring (reference)
- `[[research/_extractions/xtermjs-xterm_js]]` — renderer side of the pipe
- `[[research/_extractions/oclif-oclif]]` — CLI that spawns pty sessions

## Connections

- `[[research/cli-terminal/microsoft-node-pty]]` — original research node
- `[[research/_clones/INDEX]]`

#extraction #cli-terminal #node-pty
