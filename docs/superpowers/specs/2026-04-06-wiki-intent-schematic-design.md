# Wiki Intent Schematic Design

**Date:** 2026-04-06
**Status:** Spec (pending implementation)

## Summary

Intents become wiki pages. The vault wiki IS the intent schematic — a navigable, annotatable, agent-writable knowledge surface where every intent is a markdown page with wikilinks, tags, and inline interaction points. DB intents are populated FROM wiki pages (not the other way around). .superman/intents/ narrows to execution workspace only.

## The Problem

Current intent system has three disconnected representations:
1. **DB intents table** — queryable but invisible to humans
2. **.superman/intents/** — durable but hidden in dotfiles, not navigable
3. **vault/system/state/intents.md** — flat projection, not interactive

No surface where human and agents can collaboratively browse, annotate, and evolve the intent hierarchy. The intent "schematic" exists only as CLI output or API responses.

## The Model

```
vault/wiki/Intents/                    ← CANONICAL intent schematic
├── _index.md                          ← navigable root (tree of all intents)
├── Vision/
│   └── EMA-Life-OS.md                 ← level-0 vision intent
├── Goals/
│   ├── Ship-Core-Loop.md              ← level-1 goal
│   └── Agent-Collaboration.md         ← level-1 goal
├── Projects/
│   ├── EMA-OS.md                      ← level-2 project intent
│   │   → [[links to children]]
│   └── Actor-Workspace.md             ← level-2 project intent
├── Features/
│   ├── Execution-Engine.md            ← level-3 feature
│   ├── Intent-Wiki-Schematic.md       ← level-3 feature (this one)
│   └── Proposal-Pipeline.md           ← level-3 feature
├── Tasks/
│   ├── Fix-ActorController-Crash.md   ← level-4 task
│   └── Bootstrap-Actor-Records.md     ← level-4 task
└── Active/                            ← hot view: currently active intents

.superman/intents/<slug>/              ← EXECUTION WORKSPACE per intent
├── status.json                        ← execution state (phase, completion_pct)
├── result.md                          ← latest execution output
├── execution-log.md                   ← execution history
└── (research.md, outline.md, etc.)    ← agent working files

DB intents table                       ← RUNTIME VIEW (populated from wiki)
← VaultWatcher detects wiki page
← Populator creates/updates DB intent
← Queryable via API/MCP/CLI
```

### What Lives Where

| Concern | Location | Why |
|---------|----------|-----|
| Intent definition (what + why) | `vault/wiki/Intents/<Level>/<Slug>.md` | Human-navigable, agent-writable, wikilinked |
| Intent hierarchy | Wiki wikilinks (`[[parent::X]]`, `[[child::Y]]`) | Navigable, not just queryable |
| Intent annotations | Wiki page body (inline comments, highlights) | Collaborative surface |
| Execution state | `.superman/intents/<slug>/status.json` | Mutable runtime, not polluting wiki |
| Execution outputs | `.superman/intents/<slug>/result.md` | Agent workspace, not wiki content |
| Query/filter/tree | DB `intents` + `intent_links` | API/MCP/CLI surface |
| Agent discussion | Inline chat (future) or wiki comments section | Collocated with intent |

### Separation of Concerns

| Layer | Canonical? | Agent-writable? | Human-navigable? |
|-------|-----------|-----------------|------------------|
| Wiki page | Yes | Yes (within wiki rules) | Yes (markdown + wikilinks) |
| .superman workspace | No (execution artifacts) | Yes (full write) | Not directly |
| DB intents | No (runtime view) | Via API only | Via CLI/MCP |

## Wiki Page Format

```markdown
---
title: "Actor Workspace Collaboration"
intent_level: 3
intent_kind: feature
intent_status: active
intent_priority: 2
project: ema
parent: "[[EMA-OS]]"
tags: ["actors", "workspace", "collaboration"]
---

# Actor Workspace Collaboration

## What
Human and agent actors operate on the same entity graph with mutual visibility,
actor-stamped work creation, and phase tracking.

## Why
EMA is a collaboration system, not a task queue. The product requirement is that
human + agent can see shared work, create work for each other, and track
execution through the same model.

## Children
- [[Fix-ActorController-Crash]] — P1, complete
- [[Bootstrap-Actor-Records]] — P1, complete
- [[Bridge-Agents-Actors]] — P1, complete
- [[Stamp-Actor-ID]] — P1, complete

## Status
Phase: execute (sprint 1 complete, proving workspace cycle)
Completion: 60%

## Notes
<!-- Human and agent can both add notes here -->
<!-- Agent annotations appear with actor attribution -->

## Related
- [[Execution-Engine]] — executions stamped with actor_id
- [[Intent-Wiki-Schematic]] — this page is an example of the pattern
```

### Frontmatter Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | Intent title |
| `intent_level` | integer (0-5) | yes | vision/goal/project/feature/task/execution |
| `intent_kind` | string | no | goal, question, task, exploration, fix, audit, system |
| `intent_status` | string | no | planned, active, researched, outlined, implementing, complete, blocked, archived. Default: planned |
| `intent_priority` | integer (0-4) | no | Default: 3 |
| `project` | string | no | Project slug |
| `parent` | wikilink string | no | `"[[Parent-Intent]]"` |
| `tags` | array | no | Standard wiki tags |

### Wikilink Conventions for Intent Relations

```markdown
[[parent::EMA-OS]]                     → parent intent (level N-1)
[[child::Fix-ActorController]]         → child intent (level N+1)  
[[depends-on::Infrastructure-Upgrade]] → dependency edge
[[blocks::Feature-Release]]            → blocking edge
[[related::Security-Audit]]            → related edge (default)
[[supersedes::Old-Auth-System]]        → replacement edge
```

GraphBuilder already parses typed wikilinks (`[[type::target]]`). These map to IntentLink roles.

## Farming Pipeline

### Sources → Wiki Intent Pages

| Source | Trigger | Creates |
|--------|---------|---------|
| Brain dump | `{:brain_dump, :item_created, item}` | Level-4 task intent wiki page |
| Chat/session | Agent extracts intent from conversation | Level-3/4 intent wiki page |
| Proposal approved | `{:proposals, :approved, proposal}` | Level-4/5 intent wiki page |
| Execution completed | Harvester identifies new sub-intents | Level-4/5 child pages |
| Manual | Human creates wiki page with intent frontmatter | Any level |
| Session harvest | IntentionFarmer parses session files | Level-4 task intents |

### Wiki Page → DB Intent Sync

```
VaultWatcher polls (5s)
  → detects new/changed .md in vault/wiki/Intents/
  → creates/updates vault_notes record
  → broadcasts {:note_created, note} on "vault:changes"

Populator (enhanced) subscribes to "vault:changes"
  → checks if note is in Intents/ directory
  → parses frontmatter for intent_level, intent_kind, etc.
  → creates/updates DB intent with source_type: "wiki", source_fingerprint: "wiki:<file_path>"
  → links intent to vault_note via IntentLink (role: "origin")
  → extracts typed wikilinks → creates IntentLink edges between intents

GraphBuilder (existing)
  → parses [[wikilinks]] → creates vault_links
  → broadcasts :graph_updated on "vault:graph"
```

### DB Intent → Wiki Page (reverse sync for agent-created intents)

When an agent creates an intent via API/MCP (not via wiki):
```
Ema.Intents.create_intent/1
  → after insert, emit IntentEvent "created"
  → IntentProjector (new GenServer) subscribes to "intents" topic
  → writes wiki page to vault/wiki/Intents/<Level>/<Slug>.md
  → VaultWatcher picks it up (skips if fingerprint matches — no loop)
```

## Implementation Order

### Phase 1: Wiki as Intent Source (backend)

1. **Create `vault/wiki/Intents/` directory structure**
   - `_index.md` with tree navigation
   - Level subdirectories: Vision/, Goals/, Projects/, Features/, Tasks/
   - Seed from existing .superman intents + current EMA tasks

2. **Enhance VaultWatcher to parse frontmatter**
   - Extract intent_level, intent_kind, intent_status, intent_priority, parent, project
   - Store in vault_notes.metadata (JSON field)
   - Only for files in Intents/ directory (avoid over-processing)

3. **Enhance Populator to subscribe to `vault:changes`**
   - On note created/updated in Intents/ path
   - Create/update DB intent from frontmatter
   - Link to vault_note
   - Extract typed wikilinks → create IntentLink edges

4. **IntentProjector GenServer (reverse sync)**
   - Subscribe to "intents" topic
   - On intent created via API (not wiki source): write wiki page
   - Fingerprint check to prevent sync loops

### Phase 2: Farming from User Input

5. **Brain dump → wiki intent page** (replace current brain_dump → DB intent)
   - Populator writes wiki page to Intents/Tasks/<slug>.md
   - VaultWatcher picks it up → syncs to DB (existing pipeline)

6. **Session harvest → wiki intent pages**
   - IntentionFarmer writes harvested intents as wiki pages
   - Same sync pipeline

7. **Proposal approval → wiki intent page**
   - On proposal approved, write Intents/Tasks/<slug>.md or Intents/Features/<slug>.md
   - Link to proposal

### Phase 3: Interactive Schematic (frontend)

8. **Wiki browser component** — render intent wiki pages in the frontend
9. **Inline highlighting + comments** — annotation layer on wiki pages
10. **Chat agent per intent page** — agent scoped to intent context
11. **Navigable tree view** — visual schematic with expand/collapse, status badges

## Key Invariants

- Wiki page is canonical for intent definition (what + why)
- .superman is canonical for execution state (status.json, result.md)
- DB intents are the queryable runtime view (populated from wiki)
- Typed wikilinks (`[[depends-on::X]]`) map to IntentLink roles
- source_fingerprint prevents sync loops between wiki→DB and DB→wiki
- VaultWatcher agent-writability rules still apply (wiki/Intents/ is agent-writable)
- Every intent wiki page is a valid markdown document readable without EMA

## Migration from Current State

1. Existing .superman/intents/ intent.md content → wiki/Intents/ pages (one-time migration script)
2. Existing .superman/intents/ execution files (status.json, result.md, execution-log.md) stay in .superman
3. Existing DB intents (if any) get source_type updated to "wiki" and linked to new wiki pages
4. SystemBrain intents.md projection continues (reads from DB, which reads from wiki)

## Relation to Existing Architecture

| Component | Role After This Change |
|-----------|----------------------|
| `vault/wiki/Intents/` | **NEW** — Canonical intent schematic |
| `.superman/intents/<slug>/` | Narrowed — execution workspace only (no more intent.md) |
| DB `intents` table | Unchanged — queryable runtime view, now populated from wiki instead of brain dumps |
| `Ema.Intents.Populator` | Enhanced — subscribes to vault:changes, parses wiki frontmatter |
| `Ema.SecondBrain.VaultWatcher` | Enhanced — extracts intent frontmatter from Intents/ pages |
| `Ema.SecondBrain.GraphBuilder` | Unchanged — already parses typed wikilinks |
| `Ema.SecondBrain.SystemBrain` | Unchanged — continues projecting intents.md from DB |
| `Ema.Executions.IntentFolder` | Narrowed — manages .superman execution workspace only |
| `Ema.Executions.Dispatcher` | Updated — reads intent context from wiki page (not .superman/intent.md) |
| Actor workspace | Enhanced — agents can navigate/annotate intent wiki pages |
