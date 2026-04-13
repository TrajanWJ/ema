---
id: RES-cr-sqlite
type: research
layer: research
category: p2p-crdt
title: "vlcn-io/cr-sqlite — SQLite extension adding CRDT columns"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/vlcn-io/cr-sqlite
  stars: 3679
  verified: 2026-04-12
  last_activity: 2024-10-25
signal_tier: A
tags: [research, p2p-crdt, signal-A, cr-sqlite, sqlite-extension, dormant]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/loro-dev-loro]]", relation: references }
---

# vlcn-io/cr-sqlite

> SQLite extension adding CRDT columns (causal-length-set, LWW, counters). Mark specific columns as CRDT-enabled, get merge-on-insert for free. **Dormant since Oct 2024 — flag.** But the architectural insight is sound.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/vlcn-io/cr-sqlite> |
| Stars | 3,679 (verified 2026-04-12) |
| Last activity | 2024-10-25 (semi-dormant) |
| Signal tier | **A** |

## What to steal

### 1. CRDT-as-SQLite-column model

Keep tables as normal SQLite tables. Mark specific columns as CRDT-enabled. Merge-on-insert. EMA could theoretically `LOAD EXTENSION cr_sqlite` under better-sqlite3 and make `tasks.status` or `intents.phase` CRDT-resolved without rewriting the schema layer.

### 2. The third-option insight

EMA canon assumed CRDT state lives in a separate sync store parallel to SQLite. cr-sqlite shows a third option: **CRDT inside SQLite as columns**. Less powerful (no movable-tree) but 10× simpler for the "make `tasks.status` conflict-free across machines" case.

## Changes canon

| Doc | Change |
|---|---|
| `[[DEC-002]]` | Evaluate cr-sqlite as a third-option spike alongside Loro |

## Gaps surfaced

- EMA canon assumes CRDT state lives parallel to SQLite. cr-sqlite shows it can live INSIDE SQLite.

## Notes

- **Last push Oct 2024 is a yellow flag.** Check if there's a maintained fork before committing.
- The ideas are sound regardless. Worth a spike even if dormant.

## Connections

- `[[research/p2p-crdt/loro-dev-loro]]` — primary alternative
- `[[research/p2p-crdt/electric-sql-electric]]`
- `[[DEC-002]]`

#research #p2p-crdt #signal-A #cr-sqlite #dormant
