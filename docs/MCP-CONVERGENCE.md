# MCP Convergence Audit

Status: 2026-04-06 — This document captures the audited MCP/Codex wiring so future work can rely on a single contract.

## 1. The canonical MCP server

- **JSON-RPC core**: `daemon/lib/ema/mcp/server.ex` implements the MCP JSON-RPC loop, handles `initialize`, `resources/*`, and `tools/*` calls, and guards recursion depth via `Ema.MCP.RecursionGuard`.
- **Tool registry**: `Ema.MCP.Tools` defines the actionable API surface (`create_task`, `create_proposal`, `ema_get_intents`, `ema_create_intent`, the context queries, etc.) and all request handling now mirrors the REST controllers (the recent `ema_create_task` patch publishes the flat payload the `/api/tasks` controller expects).
- **Session tools**: `Ema.MCP.SessionTools` wraps the `Ema.Sessions.Orchestrator` calls — the same verbs (`ema_spawn_session`, `ema_check_session`, etc.) that Codex/Claude use when orchestrating additional agent work.

## 2. Synchronous HTTP surfaces

- **Controller bridge**: `daemon/lib/ema_web/controllers/mcp_controller.ex` exposes `GET /api/mcp/tools` and `POST /api/mcp/tools/execute`, reusing the same `Tools` and `SessionTools` APIs, so everything exercised over stdio also works directly via HTTP for quick smoke tests.
- **CLI wrapper**: `daemon/lib/ema/cli/commands/mcp_serve.ex` exposes those tools via the `ema` CLI and mirrors the JSON-RPC schema — it now posts tasks directly to `/api/tasks`, so the CLI/MCP wrapper no longer injects a `{"task": ...}` envelope.

## 3. Codex/Claude integration

- **Wiki MCP server**: `daemon/priv/mcp/wiki-mcp-server.js` proxies vault operations over HTTP, so Claude Code and Codex share the same outputs as the daemon REST API but in MCP format. That script is what Claude currently launches (see `~/bin/ema-mcp-server.js` in `docs/CLAUDE-CODEX-ENGINE-LAUNCH.md`), and Codex points at the same trio via `~/.codex/config.toml`.
- **Safety note**: Because the Node wrapper hits the REST bridge, any change to `EmaWeb.MCPController`, `Tools`, or the underlying controllers (e.g., `/api/tasks`, `/api/intents`) is instantly reflected over MCP/Codex without touching the stdio server.

## 4. Validation ledger

- `mix phx.server` + a quick `POST /api/tasks` or `ema_create_task` call now succeeds because the MCP CLI posts the flat fields, and the controller reads them directly.
- Tools that mutate intents, executions, or sessions continue to log via `log_mcp_call/4`, so both the stdio server and HTTP bridge emit the same audit trail into the outcome tracker.

Keep this note next to the readiness checklist so future convergence passes know where to look for the live wiring.
