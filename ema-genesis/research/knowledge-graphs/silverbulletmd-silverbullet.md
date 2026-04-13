---
id: RES-silverbullet
type: research
layer: research
category: knowledge-graphs
title: "silverbulletmd/silverbullet — Object Index over markdown with Lua Integrated Query"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
revised_by: research-round-2-c-deep-read
source:
  url: https://github.com/silverbulletmd/silverbullet
  stars: 5012
  verified: 2026-04-12
  last_activity: 2026-04-11
  license: MIT
signal_tier: S
tags: [research, knowledge-graphs, signal-S, silverbullet, object-index, primary-source]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/knowledge-graphs/iwe-org-iwe]]", relation: references }
  - { target: "[[research/knowledge-graphs/blacksmithgu-obsidian-dataview]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
---

# silverbulletmd/silverbullet

> **The primary source for `[[DEC-001]]`'s graph engine decision.** Self-hosted markdown PKM where a folder of `.md` pages IS the database — automatically indexed into queryable Objects with tags-as-types. Round 2-C deep read confirmed the architecture is exactly what EMA needs.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/silverbulletmd/silverbullet> |
| Stars | 5,012 (verified 2026-04-12) |
| Last activity | 2026-04-11 |
| Signal tier | **S** |
| License | MIT |
| Language | TypeScript (client) + Go (server) |

## What it is (deep read confirmed)

Local-first markdown notebook where pages are indexed into a typed object store and queried with an embedded Lua DSL. Plugs (JS bundles) hook events and register syscalls. The index is a KV store over `KvPrimitives` (IndexedDB in browser; the server uses a `SpacePrimitives` filesystem abstraction).

## What to steal (with R2-C deep-read details)

### 1. ObjectValue schema

```typescript
type ObjectValue<T = any> = {
  ref: string;       // unique id, usually a page reference
  tag: string;       // main tag (e.g. "page", "task", "header")
  range?: [number, number];
  tags?: string[];   // explicit tags
  itags?: string[];  // implicit/inherited tags from frontmatter
} & T;
```

`updateITags()` in `plugs/index/tags.ts` computes itags as the union of `obj.tag + frontmatter.tags + obj.tags + obj.itags`. Universal shape for every indexable thing across EMA domains.

### 2. KV namespace pattern (from R2-C source read)

```
[indexKey, type, ...key, page] → value      # forward: idx
[pageKey, page, ...key]        → true       # reverse: ridx
["type", type]                 → true       # fast type listing
```

**Two parallel key spaces.** On page reindex, the `ridx/<page>/*` query yields every key the page owns, then `clearFileIndex()` batch-deletes both the ridx entries AND the corresponding `idx/.../<page>` entries. Code in `client/data/object_index.ts` lines 386-398.

### 3. Hardcoded indexer pipeline

`allIndexers` in `plugs/index/indexer.ts` is an array of 10 indexer functions:

```typescript
[pageIndexPage, indexData, indexItems, indexHeaders, indexParagraphs,
 indexLinks, indexTables, indexSpaceLua, indexSpaceStyle, indexTags]
```

Each has signature `(pageMeta, frontmatter, tree, text) => Promise<ObjectValue<any>[]>`.

Entry point is the **`page:index` event** declared in `plugs/index/index.plug.yaml`. Plugs subscribe by name in YAML manifest. No code registration.

### 4. Space Lua Integrated Query DSL (R2-C source read)

```lua
from p = index.tag "page"
where p.name:startsWith("Person")
order by p.lastModified desc
limit 10
select { name = p.name, modified = p.lastModified }
```

Full grammar: `from <expr> [where] [group by] [having] [order by] [limit] [offset] [select]`. Clauses can appear in any order. Only `from` is mandatory.

Aggregates in `select`/`having`: `count`, `sum`, `min`, `max`, `avg`, `array_agg`. Each can have nested `order by` and `filter (where ...)` clauses.

`order by <expr> [asc|desc|using <cmp>] [nulls {first|last}]`. Custom comparators are Lua functions.

**For EMA: steal the query *shape*, not the Lua runtime.** EMA is TypeScript; embedding Lua is heavy. The DSL grammar (`from / where / order by / select`) ports cleanly to a TS parser.

### 5. Index version + reindex

Index version is a monotonic int at key `["$indexVersion"]`. Current `desiredIndexVersion = 9`. If current < desired, `reindexSpace()` queues every file with `batchSize: 3`.

**Caveat from R2-C:** `batchSet` operations are atomic at the IndexedDB primitive level (single transaction), but the higher-level `ObjectIndex.indexObjects → processObjectsToKVs → batchSet` can span multiple batches without atomicity. Port to EMA needs Ecto `Multi.run` or a SQLite transaction wrapper to fix this.

## Changes canon

| Doc | Change |
|---|---|
| `[[DEC-001]]` graph engine | The ObjectValue + KV namespace pattern is the canonical implementation |
| `EMA-V1-SPEC.md §9` | Context assembly via traversal over the index, not whole-vault dump |
| `vapps/CATALOG.md` Vault | Vault app exposes Objects (page/task/header/link/tag), not raw files |

## Gaps surfaced

- EMA's old `Ema.SecondBrain` is a flat wikilink graph. SilverBullet's tagged Object model is richer and the right abstraction.
- Canon doesn't specify a query language. SilverBullet provides one (DSL shape, not Lua).

## Notes from R2-C deep read

- **Client-side-only architecture.** The server never sees the index. EMA's port has to move the index to the daemon side (SQLite via better-sqlite3).
- **No atomic multi-batch writes.** Port must wrap in `Multi.run` or transactions.
- The `LuaCollectionQuery` parser graph is non-trivial — building TS equivalent would be a week+ for the full grammar. Start with subset: `from + where + order by + limit`.
- MIT licensed, clean to lift architecturally.

## Connections

- `[[research/knowledge-graphs/iwe-org-iwe]]` — agent-API cousin
- `[[research/knowledge-graphs/blacksmithgu-obsidian-dataview]]` — DQL DSL alternative
- `[[research/knowledge-graphs/SkepticMystic-breadcrumbs]]` — typed-edge cousin
- `[[research/context-memory/Paul-Kyle-palinode]]` — fact-level addressability cousin
- `[[DEC-001]]` — graph engine decision
- `[[canon/specs/EMA-V1-SPEC]]`

#research #knowledge-graphs #signal-S #silverbullet #object-index #primary-source #round-2-deep-read
