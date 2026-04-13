---
id: RES-logseq
type: research
layer: research
category: knowledge-graphs
title: "logseq/logseq — markdown-to-DB cautionary tale + DataScript Datalog insight"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/logseq/logseq
  stars: 42051
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: A
tags: [research, knowledge-graphs, signal-A, logseq, cautionary-tale, datalog]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/knowledge-graphs/silverbulletmd-silverbullet]]", relation: references }
  - { target: "[[research/knowledge-graphs/cozodb-cozo]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
---

# logseq/logseq

> 42k stars. Cautionary tale + Datalog insight. Started as pure markdown, hit scale limits, pivoting to a DB version backed by SQLite + DataScript. The lesson: **you can't avoid the query-engine question forever**, but you can pick a starting point with a clean migration path.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/logseq/logseq> |
| Stars | 42,051 (verified 2026-04-12) |
| Last activity | 2026-04-11 |
| Signal tier | **A** |

## What to steal

### 1. The cautionary lesson

Logseq started file-native. Hit scale limits (large vaults, complex queries). Shipped a "DB Version" using **DataScript** — an immutable Datalog database. Now they have two parallel data stories: file graphs and DB graphs. **Don't be Logseq** — pick the right starting point so the migration is clean.

### 2. Block-level addressing

Every block has a UUID. Blocks are first-class over files. The smallest addressable unit is not the file or paragraph but the block (a single bullet, header, or paragraph).

EMA's `[[research/context-memory/Paul-Kyle-palinode]]` `<!-- fact:slug -->` pattern is the markdown-native version of this. Same idea, different addressability mechanism.

### 3. DataScript / Datalog as the future query target

When markdown bottlenecks, Logseq picked Datalog (via DataScript). For EMA, the analog is `[[research/knowledge-graphs/typedb-typedb]]` (Datalog-style with rule inference) or `[[research/knowledge-graphs/cozodb-cozo]]` (CozoScript Datalog, going stale).

### 4. Two-mode dual deployment

Logseq's DB version coexists with file version. Users can pick. EMA should design the Object Index so it can back onto Datalog later **without rewriting producers**. The producers stay the same; only the storage swaps.

## Changes canon

| Doc | Change |
|---|---|
| `[[DEC-001]]` graph engine | Logseq is the cautionary reference for "what happens if you don't plan for scale." TypeDB is the live future-DB target. |
| `EMA-GENESIS-PROMPT.md §5` | Note: CRDT sync is harder on a DB-backed store than a file-backed one. Logseq's struggle with RTC alpha is live evidence. |

## Gaps surfaced

- EMA's existing `VaultWatcher`/`GraphBuilder`/`SystemBrain` already does file→DB sync. The missing piece is the query layer.
- Logseq shows you can't avoid this decision forever. Pick SilverBullet's Object Index pattern + DQL-style query and EMA can scale to Logseq's size without rewriting.

## Notes

- 42k stars proves the market for personal-graph PKM is huge.
- DataScript link: https://github.com/tonsky/datascript
- Elixir doesn't have a direct DataScript port — closest equivalents are TypeDB or rolling a Datalog subset on TS.
- Not urgent to pick a Datalog engine; flag as future path.

## Connections

- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — file-native alternative (recommended)
- `[[research/knowledge-graphs/typedb-typedb]]` — live Datalog-style alternative
- `[[research/knowledge-graphs/cozodb-cozo]]` — historical Datalog candidate (going stale)
- `[[DEC-001]]`

#research #knowledge-graphs #signal-A #logseq #cautionary-tale #datalog
