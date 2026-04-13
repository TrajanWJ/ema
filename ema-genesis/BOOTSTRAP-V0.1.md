---
id: BOOTSTRAP-V0.1
type: meta
layer: _meta
title: "Bootstrap v0.1 — the genesis folder IS the Blueprint vApp at v0.1"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1+2+3
connections:
  - { target: "[[_meta/CANON-STATUS]]", relation: references }
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
  - { target: "[[intents/GAC-QUEUE-MOC]]", relation: references }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[_meta/CANON-DIFFS]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
---

# Bootstrap v0.1

> **The `ema-genesis/` folder IS the Blueprint vApp at v0.1.** Operated manually. Markdown files. No code yet. This is exactly what `[[canon/specs/BLUEPRINT-PLANNER]]` predicts: *"the genesis brainstorm IS this vApp operated manually."*

## What v0.1 is

A connected Obsidian-style markdown wiki containing:

- **104 research nodes** across 9 categories (`research/`)
- **3 locked canon decisions** (`canon/decisions/`)
- **10 open GAC cards** awaiting human answers (`intents/GAC-NNN/`)
- **6 canon spec docs** from the original attached set (`canon/specs/` + root)
- **5 meta docs** explaining the structure (`_meta/`)
- **9 category MOCs** indexing the research layer

Total: ~135 markdown files. Every file is an Obsidian-style node with YAML frontmatter, `[[wikilinks]]`, pipe tables, and `#tags` at the bottom.

## What v0.1 is NOT

- Code. Zero TypeScript exists yet.
- Running infrastructure. No daemon, no Electron, no SQLite.
- A vApp runtime. The Blueprint vApp doesn't exist as software.
- Synced. The genesis folder is git-tracked, not P2P-replicated.

## How to navigate

### Read order for a fresh agent

1. **[[CLAUDE]]** (this folder's CLAUDE.md) — agent rules
2. **[[EMA-GENESIS-PROMPT]]** — the master spec
3. **[[SCHEMATIC-v0]]** — architecture overview
4. **[[_meta/CANON-STATUS]]** — the Q1=B ruling on doc precedence
5. **[[_meta/SELF-POLLINATION-FINDINGS]]** — what to port from the old build
6. **[[canon/decisions/DEC-001-graph-engine]]** — graph engine locked
7. **[[canon/decisions/DEC-002-crdt-filesync-split]]** — sync split locked
8. **[[canon/decisions/DEC-003-aspiration-detection-canon]]** — aspiration niche claimed
9. **[[research/_moc/RESEARCH-MOC]]** — explore the cross-pollination layer
10. **[[intents/GAC-QUEUE-MOC]]** — open questions awaiting answers

### Read order for a human user

1. **[[BOOTSTRAP-V0.1]]** (this file)
2. **[[_meta/CANON-STATUS]]**
3. **[[_meta/SELF-POLLINATION-FINDINGS]]** — biggest deliverable
4. **[[intents/GAC-QUEUE-MOC]]** — answer the 10 open GAC cards
5. **[[_meta/CANON-DIFFS]]** — review proposed canon updates

## How the Blueprint loop works at v0.1

### GAC queue (manual)

- Human reads `[[intents/GAC-QUEUE-MOC]]`
- Picks a card (e.g. `[[intents/GAC-001/README\|GAC-001]]`)
- Reads the question, options A/B/C/D, recommendation
- Answers by editing the card frontmatter: `status: answered`, `answer: A`
- Updates the canon doc the answer affects (per `[[_meta/CANON-DIFFS]]`)
- Marks card as resolved in the GAC MOC

### Research layer (frozen v0.1)

- The 104 research nodes are the cross-pollination corpus as of 2026-04-12
- Each is connected via `[[wikilinks]]` to:
  - Other research nodes in the same category
  - Canon docs the pattern affects
  - GAC cards the pattern informs
  - Decision nodes that derived from it
- Round 4 research can add new nodes — each as a new file under `research/<category>/`

### Decision making (manual)

- Decisions go in `canon/decisions/DEC-NNN-<slug>.md`
- Each decision has: question, options considered, ruling, what changes, connections
- Locked decisions are immutable except via supersession
- Open decisions go through the GAC queue first

## What ships next (Phase 1 of canon, after GAC queue clears)

Per `[[_meta/SELF-POLLINATION-FINDINGS]]` TIER PORT priorities:

1. **Intent system** — filesystem `.superman/intents/<slug>/` + DB index, ported to TypeScript with chokidar + better-sqlite3
2. **Proposal pipeline** — Generator → Refiner → Debater → Tagger → Combiner as workers
3. **Actor system** — 5-phase cadence + EntityData composite key
4. **Pipes** — trigger/action registry with 22 triggers and 15 actions
5. **Execution dispatcher** — intent_slug coupling + reflexion + result.md writeback
6. **MCP tool registry** — 25 tools + 11 resources

These six modules together unblock everything else.

## Open follow-ups

### Round 4 research (deferred)

Categories with no nodes yet:
- **Research ingestion** (`[[research/research-ingestion/_MOC]]`) — RSS aggregators, AI-curated feeds, content harvesting
- Possible additions: presence/awareness protocols (Yjs awareness deeper read), embedded LLM management, voice/mobile UX

### Schema synthesis

`schemas/` is empty. Once GAC-004 (exit_condition + scope), GAC-005 (typed edges), and GAC-006 (SDK API) are answered, write the YAML schemas.

### Bootstrap v0.2

The next bootstrap version replaces the manual Blueprint with a minimal CLI. `ema gac list`, `ema gac answer <id> <option>`, `ema decision lock <id>`. That's the v0.2 surface.

### Bootstrap v1.0

The TypeScript Electron Blueprint vApp UI. By that point the manual workflow is well-validated and the vApp just renders the existing folder structure.

## Self-references

This document is a node in the graph it describes. The links in the frontmatter point to other nodes that describe the structure. The whole bootstrap is recursive — the folder describes itself, and the agent reading it can update the description.

That recursion **IS** what `[[canon/specs/BLUEPRINT-PLANNER]]` calls "the meta-app — the tool that designs all other tools, including itself."

Bootstrap v0.1 is that meta-app, in markdown form, operated manually.

## Connections

- `[[CLAUDE]]` — agent rules for working in this folder
- `[[EMA-GENESIS-PROMPT]]` — master spec
- `[[SCHEMATIC-v0]]` — architecture
- `[[canon/specs/BLUEPRINT-PLANNER]]` — what this folder will eventually become as software
- `[[_meta/CANON-STATUS]]` — the ruling that shaped the research scope
- `[[_meta/SELF-POLLINATION-FINDINGS]]` — what to port from old build
- `[[_meta/CANON-DIFFS]]` — proposed canon updates
- `[[research/_moc/RESEARCH-MOC]]` — the research layer index
- `[[intents/GAC-QUEUE-MOC]]` — the GAC queue

#meta #bootstrap #v0.1 #blueprint #manual
