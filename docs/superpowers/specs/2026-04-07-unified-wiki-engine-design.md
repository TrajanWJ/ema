# Unified Wiki Engine — Multi-Layer Knowledge System

**Date:** 2026-04-07
**Status:** Spec (design phase)

## Summary

The EMA wiki becomes a **unified knowledge engine** — a Wikipedia-style navigable surface where every page is a multi-layered node carrying different types of information. Each page can have one or more **layers** active simultaneously. The UI renders 1:1 like MediaWiki with EMA design tokens, supporting inline highlighting, commenting, and per-page agent chat.

This replaces/absorbs: superpowers specs/plans, CodeGraphContext, disconnected vault sections, and .superman intent definitions — while keeping their operational backends as data sources.

## The Problem

Knowledge is scattered across 6 disconnected systems:
1. **Superpowers specs** — static markdown files in `docs/superpowers/`, not navigable, not linked to intents
2. **CodeGraphContext/Superman** — ETS-based code intelligence, no human-readable surface
3. **.superman/intents/** — durable but hidden in dotfiles
4. **vault/wiki/** — curated but small (41 pages), not typed by purpose
5. **Agent_VM vault** — 1,368 pages of rich knowledge, inaccessible from EMA
6. **DB tables** — intents, proposals, tasks — queryable but not browsable

No unified surface where all these knowledge types converge.

## The Model: Multi-Layer Wiki Nodes

Every wiki page is a **node** that can carry multiple **layers**. A layer defines what type of information the page holds and how it behaves.

### Layer Types

| Layer | Purpose | Replaces | Color | Frontmatter key |
|-------|---------|----------|-------|-----------------|
| **Knowledge** | Facts, reference, context. Timestamped, sourced, citable. | Agent_VM research/, wiki/Architecture/ | `#6b95f0` (blue) | `layer_knowledge: true` |
| **Intent** | Aspirations, goals, what we're trying to do. Hierarchical. | .superman/intents/, DB intents | `#a78bfa` (purple) | `intent_level: 0-5` |
| **Plan** | Source of truth for project specs, roadmaps, decisions. | superpowers specs/plans | `#2dd4a8` (teal) | `layer_plan: true` |
| **Code** | Code architecture, module maps, dependency graphs. | CodeGraphContext, Superman | `#f59e0b` (amber) | `layer_code: true` |
| **Reference** | Long documents, uploads, external sources. Static. | vault/imports/, research-ingestion/ | `#64748b` (slate) | `layer_reference: true` |
| **Operational** | Runbooks, procedures, how-to guides. Living. | wiki/Operations/, agent-learnings/ | `#22c55e` (green) | `layer_ops: true` |

### How Layers Compose

A single wiki page can have multiple layers active:

```markdown
---
title: "Actor Workspace"
intent_level: 2
intent_kind: task
intent_status: implementing
layer_plan: true
layer_code: true
project: ema
tags: ["actors", "workspace"]
---

# Actor Workspace

<!-- INTENT LAYER: what we're trying to do -->
## Intent
Human and agent actors operating on the same entity graph...

<!-- PLAN LAYER: source of truth spec -->
## Spec
See design decisions D1-D10. Current phase: execute.
Migration strategy: ...
Schema changes: ...

<!-- CODE LAYER: module architecture -->
## Architecture
### Modules
- `Ema.Actors` — context module (CRUD, phase transitions, tags, entity_data)
- `Ema.Actors.Bootstrap` — startup sync (18 actors)
### Schema
| Table | Key fields |
|-------|-----------|
| actors | id, slug, actor_type, phase, space_id |

<!-- KNOWLEDGE LAYER: what we've learned -->
## Notes
- StructuralDetector keyword list is too aggressive (2026-04-06)
- MCP create_task tool has param mapping bug
```

### Layer Rendering

The UI shows **layer tabs** at the top of each page. Each layer renders differently:

| Layer | Rendering | Special features |
|-------|-----------|-----------------|
| Knowledge | Standard wiki article | Timestamped sources, citation links |
| Intent | Status badge + hierarchy nav + children list | Phase progress bar, completion % |
| Plan | Structured sections (spec, decisions, milestones) | Decision log, milestone tracker |
| Code | Module map, dependency graph, schema tables | Syntax highlighting, file links |
| Reference | Document viewer, attachment list | Upload support, external links |
| Operational | Procedure steps, checklist | Runbook execution tracking |

## Page Structure

### Frontmatter (extended)

```yaml
---
title: "Page Title"
# Identity
slug: page-title
space: wiki
project: ema

# Layers (at least one required)
intent_level: 3          # activates Intent layer (0-5)
intent_kind: feature
intent_status: active
intent_priority: 2
layer_plan: true          # activates Plan layer
layer_code: true          # activates Code layer
layer_knowledge: true     # activates Knowledge layer
layer_reference: true     # activates Reference layer
layer_ops: true           # activates Operational layer

# Metadata
parent: "[[Parent-Page]]"
tags: ["feature", "actors"]
created: 2026-04-06
updated: 2026-04-07
author: trajan
confidence: high          # high | medium | low
---
```

### Folder Structure

```
vault/wiki/
├── _index.md                    ← Main page (like Wikipedia Main Page)
├── Intents/                     ← Intent hierarchy (existing)
│   ├── Vision/, Goals/, Projects/, Features/, Tasks/, Active/
├── Architecture/                ← Knowledge + Code layers
├── Projects/                    ← Plan + Intent layers
├── Operations/                  ← Ops layer
├── Research/                    ← Knowledge + Reference layers
├── Specs/                       ← Plan layer (absorbs superpowers specs)
├── Code/                        ← Code layer (absorbs CodeGraphContext)
├── Reference/                   ← Reference layer (long docs, uploads)
├── Agents/                      ← Knowledge + Ops layers
├── User/                        ← Knowledge layer
└── Archive/                     ← Reference layer (immutable)
```

## Wiki Engine (Backend)

### VaultWatcher Enhancement

Current: parses `intent_level` from frontmatter.
Enhancement: parse ALL layer frontmatter keys. Store in `vault_notes.metadata` JSON field.

```elixir
# In VaultWatcher.parse_frontmatter/1 (already exists)
# Result includes: intent_level, layer_plan, layer_code, etc.
# Populator creates intents from intent_level pages
# NEW: LayerIndexer creates layer records from layer_* pages
```

### Layer Index (new table)

```sql
CREATE TABLE wiki_layers (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES vault_notes(id),
  layer_type TEXT NOT NULL,   -- 'knowledge' | 'intent' | 'plan' | 'code' | 'reference' | 'ops'
  metadata TEXT DEFAULT '{}', -- JSON: layer-specific data
  inserted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(note_id, layer_type)
);
CREATE INDEX idx_wiki_layers_type ON wiki_layers(layer_type);
CREATE INDEX idx_wiki_layers_note ON wiki_layers(note_id);
```

### REST API

Extend existing vault endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/vault/note?path=...` | Returns note + content + layers (existing, enhanced) |
| GET | `/api/vault/layers?type=code` | List all notes with a specific layer |
| GET | `/api/vault/layers/:note_id` | Get all layers for a note |
| PUT | `/api/vault/note` | Update note content (existing) |
| POST | `/api/vault/note/:id/highlight` | Add inline highlight/comment |
| GET | `/api/vault/note/:id/highlights` | Get all highlights for a note |

### Highlight Storage

Inline highlights stored as entity_data on the vault_note:

```elixir
# Using existing Ema.Actors entity_data system
Ema.Actors.set_data(actor_id, "vault_note", note_id, "highlight:#{offset}", %{
  text: "selected text",
  comment: "annotation",
  color: "#a78bfa",
  created_at: DateTime.utc_now()
})
```

No new table needed — reuses the entity_data system that's already working.

## Wiki Engine (Frontend)

### MediaWiki-Style Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [☰] EMA Wiki    [Search...]           [Read] [Edit] [Talk]     │
├──────────┬──────────────────────────────────────────────────────┤
│          │ Intents / Goals / Agent-Collaboration                │
│ Nav      │                                                      │
│ sidebar  │ ┌─ Layer tabs ─────────────────────────────────────┐ │
│          │ │ [Intent] [Plan] [Code] [Knowledge]               │ │
│ Contents │ └──────────────────────────────────────────────────┘ │
│ tree     │                                                      │
│          │ # Agent Collaboration                                │
│          │                                                      │
│ Sections │ Human and agent actors collaborating through shared  │
│ ├ Intent │ workspace model.                                     │
│ ├ Spec   │                                                      │
│ ├ Arch   │ ## Intent                                            │
│ └ Notes  │ Level: Goal | Status: active | Priority: P1          │
│          │ Parent: [[EMA-Life-OS]]                              │
│          │ Children: [[Actor-Workspace]], [[Intent-Wiki]]       │
│          │                                                      │
│ ──────── │ ## Spec                         [highlighted text]   │
│ Metadata │ Design decisions D1-D10...      └─ "needs update" ← │
│ Layer: I │                                                      │
│ Status:  │ ## Architecture                                      │
│ Phase:   │ ```elixir                                            │
│ Actor:   │ defmodule Ema.Actors do ...                          │
│          │ ```                                                   │
│          │                                                      │
│          │ ┌─ Talk ─────────────────────────────────────────┐   │
│          │ │ Agent: Updated status section per your request  │   │
│          │ │ You: Also add the migration notes               │   │
│          │ │ [Ask about this page...]              [Send]    │   │
│          │ └─────────────────────────────────────────────────┘   │
├──────────┴──────────────────────────────────────────────────────┤
│ Categories: actors · workspace · collaboration                  │
│ Last edited: 2026-04-07 by agent:coder                         │
└─────────────────────────────────────────────────────────────────┘
```

### Query Parameter Slider

URL: `/wiki?page=Actor-Workspace&context=3`

The `context` parameter controls how much surrounding context is loaded:

| Value | What's loaded |
|-------|---------------|
| 0 | Just the page content |
| 1 | + parent page summary |
| 2 | + sibling pages summaries |
| 3 | + children summaries |
| 4 | + linked pages (via wikilinks) summaries |
| 5 | + project-wide context (all pages in same project) |

A **slider** in the UI lets you adjust this in real-time. Higher context = more surrounding knowledge loaded into the sidebar/footer. Agent chat uses the current context level when assembling prompts.

### Section-Level Table of Contents

Like Wikipedia's TOC — auto-generated from headings, with section numbers. Each section corresponds to a layer's content block. Clicking a TOC entry scrolls to that section.

## Implementation Order

### Phase 1: Layer Schema + Backend (smallest credible)
1. Migration: create `wiki_layers` table
2. Enhance VaultWatcher to parse `layer_*` frontmatter keys
3. LayerIndexer: auto-create wiki_layers records from parsed frontmatter
4. REST: extend `/api/vault/note` response to include layers
5. REST: add `/api/vault/layers` endpoints

### Phase 2: MediaWiki UI
6. Rebuild IntentSchematicApp as full WikiEngine component
7. MediaWiki CSS: article typography, TOC, categories footer, edit history link
8. Layer tabs: render different sections based on active layers
9. Context slider: query parameter + surrounding page loading
10. Section-level TOC auto-generation

### Phase 3: Inline Interaction
11. Highlight system: text selection → annotation popup → entity_data storage
12. Talk page: agent chat scoped to current page + context level
13. Edit with preview: side-by-side markdown editor + rendered preview
14. History: show recent edits from VaultWatcher (note update events)

### Phase 4: Knowledge Migration
15. Migrate superpowers specs → wiki/Specs/ pages with `layer_plan: true`
16. Migrate Superman code intelligence → wiki/Code/ pages with `layer_code: true`
17. Import agent_vm vault research → wiki/Research/ pages with `layer_knowledge: true`
18. Migrate .superman intent definitions → wiki/Intents/ (already partially done)

## Relation to Existing Systems

| System | After this change |
|--------|------------------|
| **Superpowers specs** | Absorbed into wiki/Specs/ pages with `layer_plan: true` |
| **Superman/CodeGraph** | Code intelligence exposed as wiki/Code/ pages with `layer_code: true`. Superman backend remains as data source. |
| **.superman/intents/** | Intent definitions → wiki/Intents/ pages. .superman narrows to execution workspace (status.json, result.md). |
| **VaultWatcher** | Enhanced to parse all layer frontmatter keys |
| **Populator** | Already syncs intent pages → DB. Extended for layer indexing. |
| **IntentProjector** | Already syncs DB → wiki. No change needed. |
| **ContextInjector** | `:wiki` key already loads intent pages. Extended to load by layer type. |
| **Agent_VM vault** | Imported into wiki/Research/ and wiki/Reference/ with provenance labels |

## Key Invariants

- Every wiki page has at least one layer active
- Layer composition is additive — any combination of layers on any page
- Frontmatter is the single source of truth for layer activation
- Highlights stored in entity_data — no new tables beyond wiki_layers
- Context slider affects what agents see, not what's stored
- Wiki remains markdown — no proprietary format, always readable without EMA
- Agent-writability rules from Vault-Structure.md still apply per directory
