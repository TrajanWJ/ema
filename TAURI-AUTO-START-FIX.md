# TAURI-AUTO-START-FIX.md

## Summary

Tauri daemon auto-start for EMA is fully implemented and functional. This document captures the investigation and one bug fix found during the audit.

---

## Auto-Start Architecture

### Rust Side (`app/src-tauri/src/lib.rs`)

The daemon starts automatically in two places:

1. **`setup()` hook** — runs during Tauri app initialization before any window opens:
   ```rust
   if let Some(child) = start_daemon() {
       *daemon_child().lock().unwrap() = Some(child);
       wait_for_daemon(); // blocks up to 15s for port :4488
   }
   ```

2. **`ensure_daemon` command** — callable from frontend via `invoke("ensure_daemon")` as a fallback.

Key implementation details:
- `daemon_is_running()` does a TCP connect to `127.0.0.1:4488` (200ms timeout) before spawning
- `build_path()` injects mise shims + erlang/elixir bin dirs into PATH so `mix` is found
- `daemon_dir()` resolves from `CARGO_MANIFEST_DIR → app/ → project root → daemon/`
- `wait_for_daemon()` polls :4488 every 500ms, up to 15s, then lets the frontend retry
- On exit, the spawned child process is killed cleanly via `RunEvent::Exit`

### Frontend Side (`app/src/components/layout/Shell.tsx`)

Shell.tsx has a robust retry loop:
1. Pings `http://localhost:4488/api/settings` (2s timeout)
2. If not alive: calls `ensure_daemon` on first attempt, then exponential backoff (500ms → 5s max)
3. Once alive: loads all 28 stores, connects WebSockets, restores workspace
4. Background health check re-triggers connect loop if daemon comes back after being down

---

## "Connection failed" Root Cause (Historical)

The error came from the **old Shell.tsx** (still visible in `.claude/worktrees/`):
```tsx
// OLD: fail immediately if daemon not running
try {
  await Promise.all([useDashboardStore.getState().loadViaRest(), ...]);
  setReady(true);
} catch (err) {
  setError(err instanceof Error ? err.message : "Connection failed"); // ← this
}
```

**Fix already applied** (commit `47799ff`): Shell.tsx was rewritten with the retry loop + `ensure_daemon` invoke. The "Connection failed" is no longer shown — instead it shows "Waiting for daemon on :4488… (attempt N)" with a Retry button.

---

## Bug Fixed During This Audit

**File:** `daemon/lib/ema_cli/health.ex`
**Commit:** `aa39498`

The CLI health check was using wrong endpoint URLs:

| Check | Old URL (broken) | New URL (correct) |
|---|---|---|
| Intent nodes | `/intelligence/intent_nodes?limit=1` | `/intent/nodes?limit=1` |
| Superman | `/intelligence/superman/status` | `/superman/status` |

Result before fix: 6/8 health checks passed  
Result after fix: 7/8 health checks passed  
(Superman shows HTTP 502 — expected, it requires the external Superman IDE service to be running)

---

## Verification

### Daemon auto-start works:
```bash
# Kill daemon, restart Tauri — daemon starts automatically
pkill -f 'mix phx.server'
cd app && npx tauri dev  # daemon spawns during setup()
curl http://localhost:4488/api/settings  # → {"settings": {...}}
curl http://localhost:4488/api/context   # → {"session": null}
```

### CLI escript works:
```bash
cd daemon && mix escript.build
./ema health check    # → 7/8 passed
./ema session state   # → Session State: ID: none, ...
./ema session list    # → (empty list)
```

### Smoke tests pass:
```bash
./scripts/smoke-test.sh  # → 8/8 passed
```

---

## Notes

- The daemon is a Phoenix app using `mix phx.server`, not a compiled release
- In dev mode, Tauri runs `npx tauri dev` which also starts the Vite dev server
- `EMA_DAEMON_DIR` env var can override the daemon path if needed
- The daemon is managed as a child process of the Tauri app; when Tauri exits, daemon is killed
