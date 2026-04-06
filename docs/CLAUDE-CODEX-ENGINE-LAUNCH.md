# Claude Codex Engine Launch

## Status

Prepared on 2026-04-06 from the live local setup.

This is the operator runbook for starting the next engine pass with both Claude Code and Codex pointed at the same EMA MCP surfaces.

## Verified Local Reality

- EMA daemon health: `http://localhost:4488/api/health` returns `{"status":"ok","daemon":"ema"}`
- `codex` installed: `codex-cli 0.118.0`
- `claude` installed: `Claude Code 2.1.92`

## Canonical Local MCP Setup

### Claude Code

Claude is currently configured via:

- `~/.claude/settings.json`
- `~/.claude/mcp.json`

The active MCP trio is:

1. `ema`
   - command: `node /home/trajan/bin/ema-mcp-server.js`
   - env: `EMA_URL=http://localhost:4488/api`
2. `filesystem`
   - command: `npx -y @modelcontextprotocol/server-filesystem /home/trajan/Projects /home/trajan/vault`
3. `qmd`
   - command: `/usr/bin/qmd mcp`

### Codex

Codex is currently configured via:

- `~/.codex/config.toml`

The active MCP trio is:

1. `ema`
   - command: `/home/trajan/bin/ema-mcp.sh`
   - wrapper sets `EMA_URL=http://localhost:4488/api`
2. `filesystem`
   - command: `npx -y @modelcontextprotocol/server-filesystem /home/trajan/Projects /home/trajan/vault`
3. `qmd`
   - command: `/usr/bin/qmd mcp`

## Important Reality Checks

- The local launcher path is the current truth, not the older wiki wording.
- Claude is using the Node wrapper `~/bin/ema-mcp-server.js` right now, not direct `mix ema.mcp.stdio`.
- Codex is already pointed at the same local EMA/filesystem/QMD MCP trio through `~/.codex/config.toml`.
- The daemon is reachable on `localhost:4488`, so local engine work should target the local EMA, not the old SSH bridge path.

## Known Caveats Before Starting

- `ema_create_task` now submits the same flat payload as `/api/tasks`, so the controller accepts MCP/CLI traffic without a wrapper.
- Some wiki pages still overstate system breadth or use stale terminology.
- MCP intent tools exist, but some response-envelope handling was recently identified as a likely seam to verify first.
- Runtime auto-linking exists, but convergence validation is still in progress.

## Recommended Launch Shape

Use one fresh Codex instance as the bounded engine operator for convergence work.

It should:

1. Trust runtime code in `daemon/lib/` over stale docs
2. Use EMA MCP for orchestration state and lightweight write-backs
3. Use filesystem MCP for direct repo/vault reads
4. Use QMD only for broader vault retrieval when local project docs are insufficient
5. Focus on correctness and convergence, not feature expansion

## Open A New Codex Instance

From `/home/trajan/Projects/ema`:

```bash
cd /home/trajan/Projects/ema
codex
```

The new Codex instance should automatically pick up MCP servers from `~/.codex/config.toml`.

If you want a fully autonomous local run:

```bash
cd /home/trajan/Projects/ema
codex --profile yolo
```

## Recommended First Inputs

Feed the new Codex instance these files first:

- `docs/INTENT-ENGINE-BOOTSTRAP-START.md`
- `docs/INTENT-ENGINE-SPEC.md`
- `docs/INTENT-ACTOR-SESSION-CONTRACT.md`
- `docs/INTENT-ATTACHMENT-IMPLEMENTATION-SPEC.md`
- `docs/INTENT-ENGINE-READINESS-AUDIT.md`
- `docs/CLAUDE-CODEX-ENGINE-LAUNCH.md`
- `docs/CODEX-ENGINE-SYSTEM-PROMPT.md`

Then let it inspect:

- `daemon/lib/ema/intents/`
- `daemon/lib/ema/executions/`
- `daemon/lib/ema/mcp/`
- `daemon/lib/ema_web/controllers/`
- `~/.local/share/ema/vault/wiki/Architecture/Intent-System.md`
- `~/.local/share/ema/vault/wiki/Architecture/Context-Assembly.md`
- `~/.local/share/ema/vault/wiki/Architecture/Knowledge-Topology.md`

## Success Condition

The new Codex instance begins as an EMA-aware convergence operator with the right MCP surfaces, accurate startup assumptions, and a bounded mission.
