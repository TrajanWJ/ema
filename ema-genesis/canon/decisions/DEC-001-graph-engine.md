---
id: DEC-001
type: canon
subtype: decision
layer: canon
title: "Graph engine = derived Object Index over markdown + DQL + typed edges; Cozo as future escape valve"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
decided_by: human
supersedes:
  - "EMA-GENESIS-PROMPT.md §5 (graph engine TBD)"
  - "EMA-V1-SPEC.md §11 question 4 (frontmatter parser choice)"
  - "EMA-V1-SPEC.md §11 question 6 (context window budget)"
connections:
  - { target: "[[EMA-GENESIS-PROMPT]]", relation: supersedes }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: supersedes }
  - { target: "[[research/knowledge-graphs/silverbulletmd-silverbullet]]", relation: derived_from }
  - { target: "[[research/knowledge-graphs/iwe-org-iwe]]", relation: derived_from }
  - { target: "[[research/knowledge-graphs/SkepticMystic-breadcrumbs]]", relation: derived_from }
  - { target: "[[research/knowledge-graphs/blacksmithgu-obsidian-dataview]]", relation: derived_from }
  - { target: "[[research/knowledge-graphs/typedb-typedb]]", relation: references }
  - { target: "[[research/knowledge-graphs/cozodb-cozo]]", relation: historical }
  - { target: "[[research/knowledge-graphs/logseq-logseq]]", relation: references }
tags: [decision, graph-engine, canon, locked, knowledge-graph]
---

# DEC-001 — Graph Engine

> **Status:** Locked 2026-04-12. Closes the "graph engine TBD" gap that has been open since `EMA-GENESIS-PROMPT.md` v0.1.

## The Decision

EMA's graph engine is a **derived Object Index** computed over a folder of markdown files with YAML frontmatter and `[[wikilinks]]`. There is no separate database for the graph in v1. The folder is the source of truth, the index is rebuildable, and queries run against the index using a DQL-shape query language. Typed edges are first-class via a namespaced frontmatter field.

| Layer | Mechanism | Reference |
|---|---|---|
| **Source of truth** | Markdown files with YAML frontmatter, organized in folders per layer (wiki/canon/intents/research) | `[[canon/specs/EMA-V1-SPEC]]` §3 storage boundary |
| **Index** | SilverBullet-style **Object Index**: every parsed entity (page, header, item, attribute, link, tag, edge) becomes a typed Object with a unique `ref`, primary `tag`, explicit `tags`, and inherited `itags` | `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` |
| **Storage of index** | SQLite (single file, embedded) — `better-sqlite3` for the Node side | not Postgres, not Cozo, not IndexedDB |
| **Index build** | Incremental on file change via a chokidar watcher; full rebuild via `ema graph reindex` | matches old Elixir `SecondBrain.VaultWatcher` pattern |
| **Query language** | DQL-shape DSL: `TABLE fields FROM source WHERE filter SORT order` | `[[research/knowledge-graphs/blacksmithgu-obsidian-dataview]]` |
| **Typed edges** | Namespaced frontmatter field `ema-links: [{type: <edge-type>, target: <wikilink>}]` plus inline `[[type::target]]` syntax | `[[research/knowledge-graphs/SkepticMystic-breadcrumbs]]` |
| **Edge types (v1)** | `fulfills`, `produces`, `references`, `supersedes`, `derived_from`, `blocks`, plus an inverse map for backlinks | matches `[[canon/specs/EMA-V1-SPEC]]` §4 ontology |
| **Context assembly** | iwe-style `retrieve(ref, depth, include_parents, expand_context)` returning a squashed context document | `[[research/knowledge-graphs/iwe-org-iwe]]` |
| **Public render** | Quartz for research layer (garden aesthetic + graph view), MkDocs Material for canon layer (structured docs) | `[[research/knowledge-graphs/jackyzha0-quartz]]` |
| **Future escape valve** | If the Object Index ever bottlenecks at scale, swap the SQLite-backed index for an embedded graph DB. **Live candidates as of 2026-04-12: TypeDB** (active, schema-first, with rule inference). **Cozo** is the historical candidate (last commit Dec 2024 — going stale). **Kuzu is archived 2025-10-10 — do not use.** The producers stay the same; only the index storage changes. | `[[research/knowledge-graphs/typedb-typedb]]`, `[[research/knowledge-graphs/cozodb-cozo]]` |

## Why

### The TBD problem

`EMA-GENESIS-PROMPT.md` §5 left the graph engine "intentionally vague" with three named options (Superman, Yjs/Automerge/Loro, Gun.js/OrbitDB, SurrealDB). Round 1 cross-pollination research surfaced a fourth option that none of the four canon candidates capture: **the index doesn't need to be a database at all**. SilverBullet, iwe, Foam, and zk all prove that "folder of markdown → derived Object Index → query layer" is sufficient for production knowledge management at the scale EMA needs (1000s of notes, not 10^7).

### The cautionary tale

`[[research/knowledge-graphs/logseq-logseq]]` is the data point that forced this decision. Logseq started as pure markdown, hit scale limits, and pivoted to a "DB Version" backed by SQLite + DataScript. The lesson is **you can't avoid this question forever**, but you can pick a starting point that has a clean migration path. The Object Index pattern *is* that starting point — when scale demands real query semantics, the producers (parsers, indexers, frontmatter readers) stay the same; only the storage swaps from SQLite tables to Cozo Datalog rules.

### Why not the canon options

- **Yjs / Automerge / Loro** are CRDTs, not graph engines. They solve concurrent edits, not query semantics. (See `[[DEC-002]]` for where they actually belong.)
- **Gun.js / OrbitDB** are P2P graph DBs but their query semantics are weak and the storage format is opaque (not human-readable markdown).
- **SurrealDB** is a real multi-model DB but it's a separate process, requires a server, and breaks the "the folder is the truth" rule.
- **Superman** (the user's prior reference) is unspecified in canon. Treat as "available if it materializes, but not blocking."
- **Kuzu** was on the candidate list — **archived 2025-10-10. Do not use.**
- **Cozo** was the originally-named future-DB target — last commit December 2024, no release since 2023. **Going stale.** Re-evaluate before depending on it; treat as historical.
- **TypeDB** surfaced as the live alternative in Round 2-F. Schema-first, rule-inference, actively maintained (v3.8.3 March 2026). The right candidate if and when the SQLite Object Index ceiling is hit. See `[[research/knowledge-graphs/typedb-typedb]]`.

### Why SilverBullet over alternatives in the same niche

- **SilverBullet** has the cleanest Object Index abstraction with incremental reindex, plugin-emit-objects pattern, and a working query DSL.
- **iwe** has the best agent-facing API (MCP server, CLI verbs `find`/`retrieve`/`tree`/`squash`/`new`/`extract`/`inline`, LSP server). Worth either depending on directly or porting the API surface.
- **Foam** is the simplest reference implementation — the MVP version of "watch a folder, build a graph in memory, expose it." Good copy-target if SilverBullet's full pattern feels heavy.
- **zk** has the cleanest CLI ergonomics (`zk list`, `zk new`, `zk edit`, plus orphan detection). Steal the verb set.
- **Breadcrumbs** is the source for typed edges. Its v4 Graph Builders model is the right primitive: multiple edge sources (frontmatter, inline, hierarchical filenames, regex notes) all unified into one typed graph.

## Implementation Phases

### Phase 1 (Bootstrap v0.1) — manual

The current `ema-genesis/` folder IS the v0.1 implementation. There is no code. Every node is a markdown file. The "index" is `RESEARCH-MOC.md` and category MOC files maintained by hand. This is the Blueprint vApp operated manually, exactly as `[[canon/specs/BLUEPRINT-PLANNER]]` describes.

### Phase 2 — `ema-core` library

| Component | Source pattern | Notes |
|---|---|---|
| `parser` | gray-matter for YAML frontmatter + remark for markdown AST | Standard Node ecosystem |
| `indexer` | SilverBullet-style: hook-driven, page-scoped, batch-write to SQLite | One indexer per Object type (page, link, header, tag, edge) |
| `index store` | SQLite via better-sqlite3, schema: `objects(ref, tag, page, json, indexed_at)` + `tags(object_ref, tag)` + `edges(source_ref, target_ref, type, declared_in)` | Single file, embedded |
| `query DSL` | Hand-rolled tiny parser for `TABLE ... FROM ... WHERE ... SORT ...`, falling back to JS predicates for complex filters | Don't depend on a full SQL engine |
| `traverse` | iwe-style `retrieve(ref, depth, expand)` over the edges table | Returns a squashed context Markdown document |
| `watcher` | chokidar with debounced file events → indexer | Match the old Elixir 5s debounce |

### Phase 3 — Public render

| Layer | Renderer | Why |
|---|---|---|
| Research layer | Quartz (TypeScript, Vite-based, plugin pipeline) | Garden aesthetic, backlinks, graph view, supports per-page publish toggle |
| Canon layer | MkDocs Material (Python, mature) | Structured docs, search, versioning, polished |

Two renderers, one source folder, configurable per-space.

### Phase 4 — Future escape valve

If query latency or graph traversal complexity exceeds the SQLite-Object-Index ceiling, swap the storage layer for **TypeDB** (Cozo going stale as of Dec 2024 — last commit December 2024, no release since 2023, treat as historical; Kuzu archived 2025-10-10, do not use). TypeDB is schema-first, actively maintained through v3.8.3 (March 2026), and gives rule-inference as a bonus on top of the Datalog target the original decision named. The producers (parsers, indexers, frontmatter readers) stay the same; the consumers (query layer, traverse) gain TypeQL as a richer query target. **This is a v3+ concern.** Don't optimize for it now.

## What This Replaces in Old Build

| Old Elixir module | Status | Notes |
|---|---|---|
| `Ema.SecondBrain.VaultWatcher` | **PORT** to chokidar + indexer | Pattern is right; replace polling with event-driven |
| `Ema.SecondBrain.GraphBuilder` | **PORT** to SilverBullet-style indexer hooks | Generalize from "wikilink parser" to "hook-driven Object emitter" |
| `Ema.SecondBrain.SystemBrain` | **PORT** as projection emitter | The auto-generated state files (projects.md, intents.md) are derived Objects, write them via the same emitter pattern |
| `Ema.VaultIndex` (scaffolded) | **DROP** | Overlapped with SecondBrain anyway; the Object Index replaces both |
| `Ema.Notes` (scaffolded, simple notes) | **DROP** | Same reason — Object replaces Note as the atomic unit |

## Open Follow-Ups

These don't block Phase 1 (manual) but need answers before Phase 2 (`ema-core`):

1. **DQL grammar exact subset** — what's the minimum DQL we ship? Just `TABLE / FROM / WHERE / SORT`, or also `LIST`, `TASK`, `CALENDAR`, `FLATTEN`, `GROUP BY`? Recommend: `TABLE / FROM / WHERE / SORT / LIMIT` for v1, expand on demand.
2. **Edge inversion automatic vs explicit** — when A `fulfills` B, does the index auto-generate B `fulfilled_by` A as a backlink, or only on explicit declaration? Recommend: auto, with the inverse map maintained in code.
3. **Object schema validation** — strict YAML validation on write or advisory? Inherits from `[[canon/specs/EMA-V1-SPEC]]` §11 question 1: enforce on write, warn on read.
4. **Plugin hook priority** — multiple indexers on the same Object type — first-write-wins, last-write-wins, merge? Recommend: namespaced by indexer ID, no conflict possible.
5. **iwe as dependency or pattern** — should EMA *depend on* iwe (Rust binary, MCP server) or *re-implement* its API surface in TypeScript? This is a Round 2-C decision, see `[[research/knowledge-graphs/iwe-org-iwe]]` for the deep read.

## Connections

- `[[_meta/CANON-STATUS]]` — the ruling that says Genesis maximalist canon wins
- `[[canon/specs/EMA-V1-SPEC]]` §3 storage boundary — the hard split between canonical graph and workspace state
- `[[canon/specs/EMA-GENESIS-PROMPT]]` §5 graph wiki — what this decision closes
- `[[DEC-002]]` — CRDT vs file-sync split (the *other* "what's the engine" decision)
- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — primary source pattern
- `[[research/knowledge-graphs/iwe-org-iwe]]` — agent API surface source
- `[[research/knowledge-graphs/SkepticMystic-breadcrumbs]]` — typed edge grammar source
- `[[research/knowledge-graphs/blacksmithgu-obsidian-dataview]]` — query DSL source
- `[[research/knowledge-graphs/cozodb-cozo]]` — future escape valve

#decision #canon #graph-engine #locked #silverbullet #object-index #dql
