---
id: META-STACK-SUMMARY
type: meta
layer: _meta
title: "Stack Summary — current, removed, and deferred tools (recovered from 2026-04-06 decisions)"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "~/.local/share/ema/vault/wiki/User/Stack-Decisions.md"
recovered_at: 2026-04-12
connections:
  - { target: "[[canon/decisions/DEC-007-unified-intents-schema]]", relation: references }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [meta, stack, tools, decisions, recovered, preliminary]
---

# Stack Summary

> Snapshot of tool choices as of **2026-04-06** from the old Elixir build era. The new Electron/TypeScript rebuild inherits the *philosophy* but replaces most of the *implementation*. Preserved here so future agents understand why things are the way they are.

## Current stack (as of 2026-04-06, old build)

| Layer | Tool | Notes |
|---|---|---|
| Daemon | Elixir / Phoenix 1.8 | Port 4488. **Replaced by TypeScript/Node in the rebuild.** |
| CLI | Elixir escript v3.0.0 | 55+ commands, 20+ groups. **Replaced by Node CLI.** |
| Frontend | Tauri 2 + React 19 + Zustand | 48 vApps (per wiki), 28 wired in renderer. **Replaced by Electron + React 19 + Zustand.** |
| Database | SQLite via Ecto (114 migrations) + dispatch.db (bash) | **Replaced by better-sqlite3 in TS.** |
| Vault | FTS5 markdown indexing | **Port target: SilverBullet Object Index pattern (DEC-001).** |

## Removed / deprecated tools (2026-04-06 cleanup)

These were explicitly killed. Listed so nobody tries to re-add them.

| Tool | Reason for removal |
|---|---|
| claude-mem | Replaced by vault-native memory (memory becomes regular notes, searchable via vault index) |
| CloudCLI | Out of scope for self-hosted first-ship |
| Mission Control | Dropped — competing agent-management surface |
| OpenClaw | Archived as an agent backend; gateway still running but pending kill |
| n8n | Deferred; pipes system covers the automation use case natively |
| LibreChat | Deferred |
| CopilotKit | Deferred |

## Three Core Truths model

See [[canon/decisions/DEC-007-unified-intents-schema]] for the full decision record. Summary: knowledge is three orthogonal domains — **Semantic** (intents), **Operational** (executions/tasks/proposals/sessions/goals), **Knowledge** (wiki/vault/docs) — connected by explicit bridges (`intent_links`, context assembly, projections).

## Load-bearing philosophies (carried forward to the rebuild)

1. **Vault-native memory** — knowledge is markdown, not a separate database. DEC-001 locks this in for the graph engine.
2. **Self-hosted first** — no external agent backends, no hosted tools in v1.
3. **"A simple CLAUDE.md followed 80% beats a comprehensive one followed 10%"** — operational principle for agent instructions. Keep CLAUDE.md small.
4. **Three Core Truths separation** — never collapse semantic/operational/knowledge into one table.

## Related

- [[canon/decisions/DEC-007-unified-intents-schema]] — primary 2026-04-06 decision
- [[canon/decisions/DEC-001-graph-engine]] — vault-native graph decision
- [[_meta/SELF-POLLINATION-FINDINGS]] — full porting inventory
- Original source: `~/.local/share/ema/vault/wiki/User/Stack-Decisions.md`

#meta #stack #tools #decisions #recovered #preliminary
