---
id: META-PROJECT-EMA-SUMMARY
type: meta
layer: _meta
title: "EMA Project Summary — system scale and subsystem inventory (ground truth as of 2026-04-06)"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "~/.local/share/ema/vault/wiki/Projects/EMA.md"
recovered_at: 2026-04-12
connections:
  - { target: "[[_meta/STACK-SUMMARY]]", relation: references }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
tags: [meta, project, summary, scale, inventory, recovered, preliminary]
---

# EMA Project Summary

> **Recovery status:** Preliminary. Ground truth on system scale and subsystem inventory from the 2026-04-06 snapshot of the old build. Useful for understanding "how big was the old build actually?" when planning the port.

## Project location

- **Path:** `~/Projects/ema`
- **Repository state (old):** Elixir/Phoenix 1.8 + Tauri 2 + React 19 + SQLite
- **Daemon port:** 4488
- **Phase at snapshot:** LaunchpadHQ frontend expansion active; backend mature.

## System scale (old build, 2026-04-06)

| Metric | Count |
|---|---|
| Elixir modules | ~673 |
| Ecto migrations | 117 |
| SQLite tables | 84 |
| REST routes | 318+ |
| Phoenix channels | 37 |
| MCP tools | 23 |
| CLI commands | 55+ across 20+ groups |
| Tauri vApps (wiki count) | 48 |
| Tauri vApps (wired in App.tsx) | 28 |
| LaunchpadHQ pages (web frontend) | 8 |
| Zustand stores (renderer) | ~79 |

## Surfaces (old build)

1. **Tauri desktop app** — 52+ vApp tile count reported; 28 actually route in `App.tsx`
2. **LaunchpadHQ web frontend** — 8 pages (Dashboard, Projects, Executions, Agents, BrainDump, Intents, Actors, Spaces, Orgs)
3. **CLI** — 55+ commands (Elixir escript)
4. **MCP server** — 23 tools
5. **Discord Bridge** — 7-channel integration
6. **Jarvis Orb** — stub only

## Major subsystems (old build)

From [[_meta/SELF-POLLINATION-FINDINGS]] and this summary combined:

| Subsystem | Role | Port status |
|---|---|---|
| Proposal Engine | 9-stage pipeline | TIER PORT |
| Agents | Supervisor + memory compression | TIER REPLACE (memory layer gets replaced) |
| Second Brain | Vault watcher + graph builder | TIER REPLACE (SilverBullet pattern) |
| Pipes | 22 triggers, 15 actions, 7 stock pipes | TIER PORT |
| Claude Sessions | Session tracking + runner | TIER REPLACE (Codeman-style pipeline) |
| Responsibilities | Role/ownership tracking | TIER PORT |
| Canvas | Freeform drawing/notes | TIER PORT |
| AI Bridge | Multi-provider routing + circuit breakers | TIER REPLACE (DBOS Transact) |
| IntentionFarmer | Multi-source intent harvesting | TIER PORT |
| Intent Engine | Unified intents schema | TIER PORT (core) |
| Intelligence layer | Cost / trust / VM / gaps tracking | Mixed |

## Three truth domains (the architectural spine)

Per [[canon/decisions/DEC-007-unified-intents-schema]]:
- **Semantic:** `intents` + `intent_links` + `intent_events`
- **Operational:** `executions`, `tasks`, `goals`, `proposals`, `sessions`
- **Knowledge:** wiki > projections > mirrors

## Why this doc exists

Whenever someone says "the old build was massive" or "the old build was already half-done," this doc is the concrete answer. 673 modules. 117 migrations. 84 tables. 318 REST routes. That's not a prototype — it was production-scale by any reasonable measure, and the rebuild inherits that ambition.

It also explains why **porting is slow**. At the old build's scale, even TIER PORT items (which lift cleanly) are nontrivial. The rebuild is not "rewrite in TS for fun" — it's a controlled migration of a real system.

## Related

- [[_meta/STACK-SUMMARY]] — tool choices that produced this scale
- [[_meta/SELF-POLLINATION-FINDINGS]] — per-subsystem porting decisions
- [[_meta/INFRASTRUCTURE-STATUS]] — where it all ran
- [[canon/specs/EMA-V1-SPEC]] — target spec for the rebuild
- Original source: `~/.local/share/ema/vault/wiki/Projects/EMA.md`

#meta #project #summary #scale #inventory #recovered #preliminary
