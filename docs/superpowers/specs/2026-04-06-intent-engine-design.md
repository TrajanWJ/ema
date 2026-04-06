# Intent Engine — Unified Schema + Knowledge Architecture

**Date:** 2026-04-06  
**Status:** ARCHITECTURE COMPLETE, BOOTSTRAP PREP READY  
**Scope:** Sub-project 1 of 4 (Intent Schema → Vault Convergence → Wikipedia Frontend → CLI + Agent Ingestion)  
**Author:** Brainstorm session + operator refinement  
**Companion:** `docs/INTENT-ENGINE-SPEC.md` (narrow bootstrap spec), `docs/INTENT-ENGINE-BOOTSTRAP-PREP.md` (implementation prep), `.superpowers/brainstorm/1061313-1775471603/content/intent-schema-v3.html` (visual architecture pass)  
**Sources:** Superman IDE, OpenClaw, Life OS Architecture, Obsidian vault patterns, 14 GitHub repos, 3-system synthesis, host/agent VM vaults

---

## Three Core Truths

The Intent Engine sits at the intersection of three coequal truth domains. Getting this wrong — treating intents as the only truth — produces a brittle, intent-centric system that fights the rest of EMA.

| Domain | What lives here | Canonical store |
|--------|----------------|-----------------|
| **Semantic truth** | Intents, intent edges, intent events — *what you're trying to do and how it relates* | `intents`, `intent_edges`, `intent_events` tables |
| **Operational truth** | Executions, sessions, proposals, tasks, brain dumps — *what actually happened* | Their home domain tables (unchanged) |
| **Knowledge truth** | Curated wiki, indexed vault, project docs, host/agent VM memory — *what you know* | Vault filesystem + SecondBrain index |

**Bridges:**
- `intent_links` bridges semantic → operational (connects an intent to executions, proposals, sessions)
- Context assembly bridges semantic → knowledge (pulls relevant wiki/vault content for an intent)
- Projections (vault/intents/, system/state/intents.md, .superman/intents/) are **downstream of these truths, not peers to them**

---

## Canonical vs Derived Stores

| Store | Type | Rebuildable? |
|-------|------|-------------|
| `intents` table | **Canonical** | No — source of graph truth |
| `intent_edges` table | **Canonical** | No — source of relationship truth |
| `intent_events` table | **Canonical** | No — source of lineage truth |
| `intent_links` table | **Canonical** | No — bridges semantic ↔ operational |
| `.superman/intents/<slug>/` | Derived | Yes — regenerated from intents + executions |
| `vault/intents/` notes | Derived | Yes — projected from intents table |
| `vault/system/state/intents.md` | Derived | Yes — SystemBrain snapshot |
| `ema intent tree` output | Derived | Yes — rendered view |

All mutations go through `Ema.Intents` context module. No other module writes to canonical intent tables directly.

---

## Unified Intent Schema

### intents — durable identity + mutable state

```
── DURABLE IDENTITY (rarely changes after creation) ──
id                  string   "int_<ts>_<rand>"
title               string   required
slug                string   unique, auto-from-title
description         text     optional
level               integer  0-5 (vision→execution)
kind                string   goal|question|task|exploration|fix|audit|system
parent_id           FK → intents
project_id          FK → projects
source_fingerprint  string   unique (dedup key)
source_type         string   brain_dump|proposal|execution|harvest|goal|
                             structural|crystallized|manual
inserted_at         datetime

── MUTABLE STATE (changes as work progresses) ──
status              string   planned|active|researched|outlined|
                             implementing|complete|blocked|archived
phase               integer  1-5 (research→harvest)
completion_pct      integer  0-100 (propagated from children)
clarity             float    0.0-1.0
energy              float    0.0-1.0
priority            integer  0-4 (P0=immediate → P4=someday)
confidence          float    0.0-1.0 (how trusted this intent's structure is)
provenance_class    string   high|medium|low
confirmed_at        datetime (null until operator or threshold confirms)
tags                text     JSON array
updated_at          datetime
```

**Level hierarchy:** 0=vision, 1=goal, 2=project, 3=feature, 4=task, 5=execution

**Status propagation (from Superman):** When all children are complete → parent completion_pct = 100. Some complete → proportional. None → 0. Propagates recursively up the tree.

### intent_links — polymorphic join (semantic ↔ operational bridge)

```
intent_id       FK → intents
linkable_type   string  "execution"|"proposal"|"task"|"goal"|
                        "brain_dump"|"session"|"harvest"|
                        "vault_note"|"doc"
linkable_id     string  the foreign ID
role            string  "origin"|"evidence"|"derived"|"related"|
                        "superseded"|"context"
provenance      string  "manual"|"approved"|"execution"|"harvest"|
                        "cluster"|"import"
inserted_at     datetime
```

An intent accumulates many operational attachments over time. The intent graph remains semantically stable even as operational history churns beneath it. Fixed FK columns can't express this — an intent may have multiple executions, multiple sessions contributing, a proposal AND a brain dump as co-origins.

### intent_edges — typed relationships

```
id          string
source_id   FK → intents (cascade)
target_id   FK → intents (cascade)
edge_type   string   hierarchy|depends-on|blocks|enables|supersedes|
                     implements|related-to|part-of|contradicts|
                     crystallized-from
weight      float    0.0-1.0
context     text     line/paragraph where link was found
inserted_at datetime
```

Edge types match SecondBrain GraphBuilder vocabulary so the same rendering and query code works across intents and wiki notes.

### intent_events — lineage spine (append-only)

```
id              string   auto
intent_id       FK → intents
event_type      string   created|status_changed|phase_advanced|linked|
                         unlinked|reparented|merged|split|archived|
                         execution_started|execution_completed|
                         confirmed|promoted|demoted|
                         outcome_recorded|imported
payload         text     JSON — what changed
actor           string   "system"|"user"|"agent:<slug>"|"harvest"|
                         "cluster"|"migration"
inserted_at     datetime
```

**What must emit lineage events:**
- Creation (always — includes source_type and origin ID)
- Status changes (planned→active, active→complete, etc.)
- Phase advances (research→outline, etc.)
- Links added/removed (operational attachments)
- Reparenting, merging, splitting
- Imports and migrations (actor: "migration")

**What should NOT emit lineage events:**
- Cosmetic edits (typo in description, tag reorder)
- Derived projection regeneration
- Read-only queries or tree renders
- Transient computation (completion_pct recalc)

**Semantics:** Events support provenance, replay, and audit, but correctness lives in the canonical tables. Old events can be pruned. This is an audit trail, not event sourcing.

---

## Provenance, Confidence, and Confirmation

Not all sources are equally trustworthy. Some create intents directly; some should create lower-confidence candidates first.

| Confidence | Sources | Behavior |
|------------|---------|----------|
| **High** | Manual creation, approved proposal, execution-backed signal, goal creation | Creates intent directly at stated level |
| **Medium** | Brain dump, harvested intent from session | Creates intent at level 4-5. Promoted to higher level only via operator or clustering confirmation |
| **Lower until confirmed** | Cluster inference, structural auto-analysis, crystallization, kill-memory patterns | Creates intent with `status: planned` and `tags: ["candidate"]`. Requires confirmation threshold before influencing graph structure |

**Confirmation thresholds for lower-confidence sources:**
- Cluster → intent promotion: readiness_score ≥ 0.7 AND item_count ≥ 3
- Crystallization → workflow intent: 5+ successful executions at 70%+ success rate
- Structural analysis → system intent: corroborated by at least one operational signal (execution, task, or brain dump touching the same domain)
- No single cluster or kill-pattern creates level 0-2 graph truth by itself

**Anti-intents and failure patterns:** These are normal intents with `kind: audit` and specific metadata, not a separate ontology. A kill-memory pattern creates `{kind: "audit", tags: ["failure-pattern"], metadata: {pattern_type: "repeated_kill", ...}}`. They participate in the same graph, same queries, same tree rendering — just filtered by kind when needed.

---

## Merge/Split Discipline

Intents can be merged or split, but only with guardrails to prevent graph rot.

**Merge:** Only when semantic identity is actually shared — two intents describe the same goal from different entry points (e.g., a brain dump and a harvested session both capturing "add auth to agent channels"). The newer intent's links transfer to the surviving intent. The merged intent gets `status: archived` with a lineage event `{event_type: "merged", payload: {into: surviving_id}}`. Old identity remains queryable via lineage.

**Split:** Only when a single intent contains multiple independently executable futures. Creates N new child intents, original becomes their parent (not archived). Lineage event: `{event_type: "split", payload: {into: [child_ids]}}`.

**Both require:** Lineage event emission. Old identities remain traceable. No silent disappearance.

---

## Knowledge / Wiki / Vault Topology

### A. Host Machine Knowledge Space

The human-rich source environment. Richest long-horizon knowledge substrate.

| Location | Content | Agent access |
|----------|---------|--------------|
| `~/Documents/obsidian_first_stuff/twj1/` | Legacy Obsidian vault — Agent Context (32 files), AI Knowledge (24), Session Logs, Workflows, Contacts, Preferences | **Read-only ingest.** Indexed by QMD. Not writable by agents. |
| `~/vault/` | QMD-indexed knowledge base (168 docs) — architecture blueprints, stack decisions, project notes, agentic patterns research, prompt library sources | **Read-only reference.** Searched via QMD MCP. |
| `~/Projects/*/` | Project repos with CLAUDE.md, docs/, .superman/ | **Read per-project.** Scoped by project_id. |
| `~/shared/inbox-host/` | Cross-VM artifacts — bridge files, course outputs, brainstorm HTMLs, EMA batch files | **Selective ingest.** Imported with provenance labels. |

**Rules:** Not all host knowledge should be writable by agents. EMA treats this as a source to selectively ingest/index/reference, not blindly flatten. Curated operator-authored docs (conventions, architecture, preferences) are authoritative.

### B. Agent VM Knowledge Space

The agent-operational environment. High-churn, provisional, useful for continuity.

| Location | Content | Agent access |
|----------|---------|--------------|
| `~/shared/inbox-vm/` | Cross-VM artifacts — synthesis docs, agent integration design, discord patterns, EMA PAP | **Selective ingest.** Provisional until promoted. |
| `~/Desktop/JarvisAI/vault/` | Agent VM vault — architecture, agents (OpenClaw, Mission Control), research (Superman deep dive), operations, security | **Read-only reference.** Research and operational docs. |
| `~/Desktop/superman/` | Superman IDE source — intent-engine.ts, intent-graph.ts, IntentGraphPanel.tsx, autonomous-engine, retrieval pipeline | **Code reference.** Pattern source for porting. |
| Agent session `.jsonl` files | Claude Code, Codex CLI session histories | **Harvested by IntentionFarmer.** |

**Rules:** Agent VM scratch material is provisional unless promoted. Should not automatically outrank curated host knowledge. Useful for operational continuity and recent working state.

### C. EMA Canonical Knowledge Layer

The EMA-owned semantic/knowledge bridge layer. Not a raw mirror — a selective, typed convergence layer.

```
~/.local/share/ema/vault/
├── wiki/                        ← CURATED, operator-facing, mostly stable
│   ├── Architecture/            11 pages (EMA overview, babysitter, dispatch, etc.)
│   ├── User/                    4 pages (profile, stack decisions, learnings, setup)
│   ├── Projects/                4 pages (EMA, ProSlync, place.org, active projects)
│   ├── Agents/                  2 pages (agent network, OpenClaw)
│   ├── Apps/                    5 pages (brain dump, tasks, vault, focus, pipes)
│   ├── Tools/                   2 pages
│   ├── Operations/              6 pages (quick ref, infra, audit, Claude Code setup)
│   ├── Contacts/                1 page
│   └── _index.md                Master MOC (updated on every write)
│
├── intents/                     ← GENERATED, semantic working projections
│   ├── by-project/              Mirror of wiki/Projects/ structure
│   │   └── ema/
│   │       ├── vision.md        → [[wiki/Architecture/EMA-Overview]]
│   │       └── intent-engine.md → [[wiki/Architecture/Intent-System]]
│   ├── by-level/                Zoom view (vision/ goal/ project/ feature/)
│   ├── by-status/               Kanban view (active/ blocked/ complete/)
│   └── _index.md                Auto-generated MOC
│
├── imports/                     ← IMPORTED, source-labeled mirrors
│   ├── host/                    Selective extracts from host machine knowledge
│   ├── agent-vm/                Selective extracts from agent VM workspace
│   └── _provenance.md           Import log (source, date, fingerprint)
│
├── system/state/                ← GENERATED, machine state snapshots
│   ├── projects.md              Existing (SystemBrain)
│   ├── proposals.md             Existing (SystemBrain)
│   └── intents.md               NEW — live intent tree state
│
└── archive/                     ← IMMUTABLE, append-only historical
    ├── sessions/                Archived session summaries
    ├── retrospectives/          Completed intent retrospectives
    └── promoted/                Snapshots of promoted content (before edit)
```

**Folder discipline:**

| Folder | Canonical? | Rebuildable? | Agent-writable? | Purpose |
|--------|-----------|-------------|-----------------|---------|
| `wiki/` | Yes | No | Limited (Projects/, Apps/ = full; Architecture/, User/ = propose only; Conventions = read-only) | Curated operator knowledge |
| `intents/` | No | Yes | Full | Generated projections from intents DB |
| `imports/` | No | Yes | Full | Source-labeled mirrors of external knowledge |
| `system/state/` | No | Yes | Full | Machine-generated state reports |
| `archive/` | Yes | No | Append-only | Historical records, never overwritten |

**Also on disk (execution layer):**
```
daemon/.superman/intents/<slug>/     ← DERIVED, execution scratchpads
├── intent.md                        Created on brain dump
├── status.json                      Updated on execution completion
├── execution-log.md                 Appended per execution run
└── result.md                        Written on completion
```

### D. Projection Rules

| Output | Source | Trigger | Overwrite policy |
|--------|--------|---------|-----------------|
| `vault/intents/` notes | intents DB | SystemBrain debounce (5s) | Regenerated freely — these are projections |
| `vault/system/state/intents.md` | intents DB | SystemBrain debounce (5s) | Regenerated freely |
| `.superman/intents/<slug>/` | intents + executions | On brain dump create / execution complete | intent.md regenerated; execution-log.md append-only |
| `vault/imports/host/` | Host machine vault | Manual or scheduled ingest | Source-labeled, never overwrites curated wiki |
| `vault/imports/agent-vm/` | Agent VM workspace | Manual or scheduled ingest | Source-labeled, provisional until promoted |

---

## Cross-Pollination: Host ↔ EMA ↔ Agent VM

### host_machine → EMA

| What flows | How | Landing zone |
|------------|-----|-------------|
| Curated vault notes, architecture blueprints, stack decisions | QMD search (read-only) or selective file copy | `vault/imports/host/` or direct wiki reference via path |
| Project docs, CLAUDE.md files | IntentionFarmer SourceRegistry discovery | Harvested intents (level 4-5) |
| Archived research, prompt library sources | Manual import or scheduled sync | `vault/imports/host/` with provenance |
| Operator preferences, conventions | Referenced in CLAUDE.md hierarchy | Never copied — referenced in place |

### agent_vm → EMA

| What flows | How | Landing zone |
|------------|-----|-------------|
| Session memory, execution notes | IntentionFarmer harvest pipeline | Harvested intents → intents table |
| Scratch analyses, temporary syntheses | Selective import (manual or agent-triggered) | `vault/imports/agent-vm/` |
| Distilled lessons from active runs | Execution completion → outcome recording | intent_events lineage + intent metadata |
| Superman research, OpenClaw patterns | One-time reference reads | Inform schema design (already done this session) |

### EMA → host_machine

| What flows | How | Landing zone |
|------------|-----|-------------|
| Promoted insights, stable wiki updates | Explicit operator promotion command | Host vault curated sections |
| Architectural syntheses | Export from wiki/ when stabilized | Host vault Architecture/ |
| Intent summaries, retrospectives | `ema intent export` → markdown | Host vault Session Log/ or Projects/ |
| Crystallized workflows | Workflow crystallization pipeline (deferred) | Host vault Workflows/ |

### EMA → agent_vm

| What flows | How | Landing zone |
|------------|-----|-------------|
| Execution-ready context bundles | ContextInjector + Dispatcher delegation packets | Agent working directory |
| Intent projections | MCP `ema_get_intents` tool | Agent session context |
| Task-local memory packets | Execution dispatch enrichment | `.superman/intents/<slug>/` in project |
| Distilled project context | Superman.Context.for_project/2 | Agent prompt injection |

### Guardrails

- Host machine curated docs are **never overwritten** by generated projections
- Agent VM scratch material is **provisional unless explicitly promoted**
- Imported material **always keeps provenance labels** (source, date, fingerprint in `_provenance.md`)
- No blind merge of semantically conflicting sources — conflicts surface to operator
- Generated notes land in **generated spaces** (`intents/`, `system/state/`, `imports/`), not curated spaces (`wiki/`), unless explicitly promoted
- Promotion into curated wiki requires **operator confirmation** for level 0-2 content

---

## Context Assembly / Knowledge Selection

When an intent needs context for execution, EMA assembles a bounded, provenance-aware context bundle.

### Selection layers (in precedence order)

1. **Semantic selection** — the intent itself, its parent chain, and direct edge neighbors from `intent_edges`
2. **Operational selection** — linked executions, proposals, sessions, tasks via `intent_links`. Most recent first. Include outcome data (what_worked/what_failed) from prior runs.
3. **Project-scoped knowledge** — curated wiki pages matching `project_id`. Architecture docs, decision records, conventions for the relevant project.
4. **Host machine knowledge** — QMD semantic search against indexed vault, bounded to top-5 results above similarity threshold 0.5. Prefer curated over noisy.
5. **Agent VM scratch** — only if explicitly referenced or if the intent was harvested from an agent VM session. Not included by default.

### Precedence rules

- Curated wiki > generated projections > imported mirrors > agent scratch
- Project-local docs > cross-project general knowledge
- Recent operational data > historical
- High-confidence sources > lower-confidence candidates

### Budget

Context assembly targets a bounded token budget (configurable, default ~4000 tokens). Layers are included in precedence order until budget is exhausted. Each included item carries a provenance tag (source_type, confidence, freshness).

### Implementation

This maps directly to the existing `Ema.Claude.ContextInjector` pattern — extend its key set to include `:intents` and `:host_knowledge`:

```
context_keys = [:intents, :project, :goals, :vault, :tasks, :energy]
```

The `:intents` key fetches the intent's parent chain + edge neighbors + linked operational history. Slotted into the existing 5-stage dispatch pipeline at Stage 2 (Enrich).

---

## Population Pipeline

### Direct creation (high confidence)

| Event | Creates | Level | Source type |
|-------|---------|-------|-------------|
| `brain_dump:item_created` | Leaf intent + IntentFolder + Execution | 4-5 | brain_dump |
| `proposals:approved` | Intent linked to proposal | 2-3 | proposal |
| `goals:created` | Intent linked to goal | 1 | goal |
| `tasks:created` | Intent linked to task | 4 | manual |
| Manual `ema intent create` | Intent at specified level | any | manual |

### Harvested (medium confidence)

| Event | Creates | Level | Source type |
|-------|---------|-------|-------------|
| `intention_farmer:intent_loaded` | Intent linked to session + harvested_intent | 4-5 | harvest |

### Lifecycle updates

| Event | Effect |
|-------|--------|
| `executions:completed` | Updates linked intent: phase++, completion_pct, status. Writes to IntentFolder status.json. Propagates status up parent chain. |
| `intents:status_changed` | Emits pipe event. Updates vault/intents/ projection if active. |

### Deferred (lower confidence, needs confirmation thresholds)

| Source | Creates | Threshold | Deferred until |
|--------|---------|-----------|---------------|
| ClusterEvaluator | Parent intent grouping cluster members | readiness ≥ 0.7, items ≥ 3 | After bootstrap proves stable |
| Structural analysis (Superman port) | System-level intents from codebase | Corroborated by ≥ 1 operational signal | Vault Convergence phase |
| Workflow crystallization (OpenClaw) | Crystallized workflow intents | 5+ executions at 70%+ | After outcome tracking ships |
| Kill-memory patterns | Audit intents (kind: audit) | Pattern confirmed across ≥ 3 proposals | After proposal engine matures |

---

## Intent Identity vs Operational Churn

Intents are **durable semantic objects**. They represent what you're trying to accomplish, not individual attempts to accomplish it.

Executions, sessions, proposals, and tasks are **operational attachments**. They come and go. An intent may accumulate dozens of operational attachments over months — 5 execution attempts, 3 Claude Code sessions, 2 proposals, 1 approved task.

The intent graph should remain **semantically stable** even as operational history churns beneath it. An intent's identity (id, title, slug, level, kind, parent_id) changes rarely. Its mutable state (status, phase, completion_pct) changes as work progresses. Its operational attachments (via intent_links) change frequently.

This is why `intent_links` is a separate join table, not fixed FK columns on the intent.

---

## Bootstrap — Grounded in EMA Repo Reality

### What exists right now (verified this session)

| File | State |
|------|-------|
| `daemon/lib/ema/intelligence/intent_map.ex` | WORKING — CRUD + tree + export |
| `daemon/lib/ema/intelligence/intent_node.ex` | WORKING — 5-level schema |
| `daemon/lib/ema/intelligence/intent_edge.ex` | WORKING — limited queries |
| `daemon/lib/ema/intelligence/intent_cluster.ex` | WORKING — cluster→node bridge |
| `daemon/lib/ema/intention_farmer/` (12 files) | WORKING — wired in application.ex |
| `daemon/lib/ema/executions/intent_folder.ex` | WORKING — disk create/read/write |
| `daemon/lib/ema/brain_dump/brain_dump.ex` | WORKING — creates IntentFolder + Execution |
| `daemon/lib/ema/cli/commands/intent.ex` | WORKING — list/show/tree/export |
| `daemon/lib/ema_cli/intent.ex` | WORKING — search/list/graph/trace |
| `daemon/.superman/intents/` | 40+ folders on disk |
| `daemon/lib/ema/second_brain/graph_builder.ex` | WORKING — wikilink parsing + typed edges |
| `daemon/lib/ema/claude/context_injector.ex` | EXISTS — 6-key enrichment (in batch2) |
| `daemon/lib/ema/intelligence/router.ex` | EXISTS — event classification (in batch2) |

### What the migration actually touches

```
NEW FILES:
  daemon/priv/repo/migrations/2026040610xxxx_create_intents.exs
  daemon/lib/ema/intents/intent.ex           — new schema
  daemon/lib/ema/intents/intent_link.ex      — polymorphic join
  daemon/lib/ema/intents/intent_event.ex     — lineage
  daemon/lib/ema/intents/intents.ex          — context module (replaces IntentMap)
  daemon/lib/ema/intents/populator.ex        — PubSub subscriber GenServer

EDITED FILES:
  daemon/lib/ema/brain_dump/brain_dump.ex    — add intents:populate broadcast
  daemon/lib/ema/executions/executions.ex    — broadcast on complete
  daemon/lib/ema/intention_farmer/loader.ex  — create intent, not just brain dump
  daemon/lib/ema_web/router.ex               — add /api/intents routes
  daemon/lib/ema/cli/commands/intent.ex      — point to Ema.Intents
  daemon/lib/ema_cli/intent.ex               — point to /api/intents
  daemon/lib/ema/application.ex              — start Populator

KEPT (not dropped, remains readable):
  intent_nodes + intent_edges tables          — old data accessible during transition
  harvested_intents table                     — still used by IntentionFarmer
```

This is a **migration and consolidation**, not a blank-slate rebuild.

---

## Minimum Lovable Bootstrap

The smallest thing that proves the system works:

1. `intents` + `intent_links` + `intent_events` tables exist (migration runs clean)
2. `Ema.Intents` context module provides CRUD + tree + status propagation
3. Migration script reads `intent_nodes` → writes `intents` (preserving IDs where possible)
4. Migration script scans `.superman/intents/` → creates intent per folder (actor: "migration")
5. Populator subscribes to `brain_dump:item_created` → new brain dumps create leaf intents automatically
6. Populator subscribes to `executions:completed` → updates linked intent status
7. `ema intent tree --project=ema` shows populated hierarchy with status colors
8. `ema intent create "..." --level=4 --kind=task` works
9. `ema intent show <id>` displays lineage trail from intent_events
10. Wiki doc `Intent-System.md` updated to reflect current reality

**Done-when:** `ema intent tree --project=ema` shows a populated hierarchy with status colors, new brain dumps auto-appear as leaf intents, and `ema intent show` displays at least one lineage event per intent.

**Preparation complete when:** the wiki reflects this reality, the bootstrap prep checklist exists in-repo, and the implementation work can begin file-by-file without reopening architecture questions.

---

## Operator Superpowers — 10-Second Capabilities

### Intent operations

```
$ ema intent tree --project=ema
  → Full hierarchy with status colors and completion %

$ ema intent create "add WebSocket auth" --level=4 --kind=task
  → Creates intent + IntentFolder + lineage event. Ready to dispatch.

$ ema intent show int_abc123
  → Title, status, phase, linked executions/proposals, lineage trail

$ ema intent link int_abc --depends-on int_xyz
  → Creates typed edge. Logged in lineage.

$ ema intent status
  → 12 active, 3 blocked, 47 complete, 5 harvested today

$ ema dump "refactor vault watcher for intent scanning"
  → Brain dump → level-5 intent → IntentFolder → Execution. Auto-dispatches.
```

### Knowledge operations (deferred, but designed for)

```
$ ema intent context int_abc123
  → Assembled context bundle: intent chain + linked ops + wiki + host knowledge
  → Shows provenance per item (curated/generated/imported, confidence, freshness)

$ ema intent provenance int_abc123
  → Full lineage chain: created from brain dump → linked to execution → phase advanced → completed

$ ema vault imports --source=host
  → List all imported host machine content with provenance labels

$ ema vault stale --space=intents
  → Show generated projections older than their source data

$ ema vault promote vault/imports/host/architecture-decision.md wiki/Architecture/
  → Promote imported content to curated wiki (operator confirmation required)
```

### MCP integration

```
MCP: ema_get_intents(project_id: "ema", level: 3, status: "active")
  → Any Claude Code session queries the intent graph via MCP
  → Context injection: agents see relevant intents before starting work
```

---

## Defer for Later

These are explicitly out of scope for the minimum lovable bootstrap:

- `vault/intents/` markdown projection (needs SystemBrain extension)
- `vault/imports/` cross-pollination sync (needs provenance pipeline)
- Structural auto-intent from codebase (Superman port)
- Workflow crystallization (needs execution outcome data)
- Reflexive capture (cluster patterns → intents)
- Embeddings + semantic similarity on intents
- Wikipedia frontend with inline chat agents
- TUI cockpit (lazygit-style dual-pane)
- MCP server discovery + probe
- Outcome journal (what_worked/what_failed)
- fitness_score computation
- autonomy_level enforcement
- GraphBuilder scanning vault/intents/
- Dynamic context assembler (full version)
- LaunchpadHQ Sprint 2

Each of these becomes an intent in the new system after bootstrap, tracked and prioritized within the engine itself.

---

## Design Lineage

Patterns cross-pollinated into this design:

| Source | What we took |
|--------|-------------|
| **Superman IDE** | IntentGraph 5-level hierarchy, status propagation (children→parent), zoom levels, auto-intent from structural analysis, linked_code pattern |
| **OpenClaw** | Priority queue (P0-P4), outcome journal pattern, workflow crystallization, circuit breaker per intent, fitness scoring |
| **Life OS Architecture** | Multi-space federation model, shadow notes concept, cross-space link index |
| **Obsidian Vault Patterns** | Graduated autonomy zones, 3-instance rule, archive-never-delete, consolidation cycles, content/framework separation |
| **Agentic Patterns Research** | Tiered autonomy (HITL/HOTL/HOOTL), 5-layer memory model, task sizing to 2hr units, spec-driven development |
| **3-System Synthesis** | Tiered hybrid agent model, 5-stage dispatch pipeline, ContextInjector with 6 source keys |
| **Open Source** | obra/knowledge-graph (MCP+SQLite+vectors), semiont (W3C annotations), gollum (git-backed wiki), codebase-to-course (interactive HTML) |
| **EMA Agent Integration Design** | Intelligence Router, ContextInjector, BridgeDispatch |
| **Prompt Library Sources (14 repos)** | Ralph Loop (self-correcting execution), PRP format, context synthesis, delegation protocols |
