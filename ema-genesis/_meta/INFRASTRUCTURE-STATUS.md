---
id: META-INFRASTRUCTURE-STATUS
type: meta
layer: _meta
title: "Infrastructure Status (historical) — host + agent-VM topology as of 2026-04-06"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "~/.local/share/ema/vault/wiki/Operations/Infrastructure.md"
recovered_at: 2026-04-12
connections:
  - { target: "[[_meta/STACK-SUMMARY]]", relation: references }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [meta, infrastructure, operations, historical, recovered, preliminary]
---

# Infrastructure Status

> **Recovery status:** Preliminary. Snapshot of EMA's infrastructure topology as of 2026-04-06 from the old build era. Retained as historical context. The new Electron build is **host-only** by design until P2P sync ships ([[intents/INT-P2P-FEDERATED-SYNC]]).

## Topology (as of 2026-04-06)

### Host — FerrissesWheel (desktop)

- **Role:** primary user machine (Obsidian, Claude Code, SSH bridge)
- **Services:** Daemon on 4488, Claude Code interactive sessions, QMD search (72MB index, 9951 vectors)
- **Databases:** `ema_dev.db` (host, largely empty — schemas defined in code), FTS5 vault index (host)
- **Cron jobs active:** 2 — QMD update, OAuth sync
- **Status:** ✅ Online

### Agent-VM — 192.168.122.10

- **Role:** dedicated EMA daemon host, dispatch, and automation
- **Services (when online):** Daemon 4488, Observer 3200, ClaudeForge 3001, Wiki Engine 8093, MCP 8899, SearXNG 8082, Whisper 8178, Ollama 11434, Lightpanda 9223, Chrome MCP 8099
- **Databases (when online):** `dispatch.db` (agent-vm, inaccessible when offline), FTS5 vault index (agent-vm)
- **Cron jobs:** ~35 (all offline as of snapshot)
- **Status:** ❌ **OFFLINE as of 2026-04-06**

The agent-VM being offline was a critical blocker for all dispatch work in the old build. Host-only operation was feasible for most things but dispatch, scheduled automation, and the Observer surface were unreachable.

## Implications for the rebuild

1. **Single-machine v1.** The new Electron build targets host-only operation. P2P sync and multi-machine dispatch are explicitly deferred to [[intents/INT-P2P-FEDERATED-SYNC]].
2. **No VM dependency.** Don't architect around an always-on secondary machine. The daemon, worker, and renderer all run on the same host.
3. **Services consolidation.** The 10 services running on agent-VM in the old build need to consolidate. Observer and Wiki Engine move into the main daemon; SearXNG, Whisper, Ollama, Lightpanda, Chrome MCP become optional host-local dependencies if needed.
4. **Cron → Node worker.** The 35 cron jobs become Node workers driven by a scheduler module in the daemon. No OS-level cron dependency for core functionality.

## What was lost when agent-VM went offline

Retained as a reference of what to avoid re-losing:

- Dispatch.db (84+ tasks) — the dispatch engine's state
- 11+ REST endpoints on different services (consolidation target is 1 daemon)
- Historical execution logs
- Scheduled automation (35 cron jobs)
- Wiki Engine's processed vault state
- QMD index on agent-VM (host QMD still works)

## Related

- [[_meta/STACK-SUMMARY]] — tool choices
- [[intents/INT-P2P-FEDERATED-SYNC]] — the intent that eventually restores multi-machine
- [[_meta/SELF-POLLINATION-FINDINGS]] — replacement tooling inventory
- Original source: `~/.local/share/ema/vault/wiki/Operations/Infrastructure.md`

#meta #infrastructure #operations #historical #recovered #preliminary
