# Intent Engine Spec

## Status

Draft 1, extracted from the v3 architecture pass on 2026-04-06.

This document defines the minimum disciplined bootstrap for EMA's unified Intent Engine. It is intentionally narrower than the broader wiki/frontend/TUI vision. The goal is to ship the semantic core and its bridges into EMA's existing operational and knowledge surfaces without overbuilding.

## Goal

Make the Intent Engine a system seed:

- Architecturally disciplined
- Grounded in current EMA repo reality
- Recursively useful without becoming self-deluding
- Strong on wiki/vault topology and provenance
- Strong on host-machine ↔ agent-vm ↔ EMA cross-pollination
- Clear about projections, context assembly, and knowledge flow

## Non-Goals For Bootstrap

These are explicitly deferred:

- Full Wikipedia-style frontend
- TUI cockpit
- Structural auto-intent generation from codebase
- Workflow crystallization and autonomous publication
- Embedding-heavy semantic intent graph features
- Full host-machine sync/promote automation
- Broad MCP server autodiscovery

## Three Core Truths

The system has three coequal truth domains.

### Semantic truth

Stored in EMA and owned by the Intent Engine:

- `intents`
- `intent_edges`
- `intent_events`

This is the graph of what the system is trying to do.

### Operational truth

Stored in the home domains that already exist:

- Executions
- Sessions
- Proposals
- Tasks
- Goals

This is the record of what actually happened.

### Knowledge truth

Stored in curated docs and indexed memory:

- EMA repo docs under `docs/`
- EMA-managed vault under `~/.local/share/ema/vault/`
- Host-machine vault under `~/vault/`
- Indexed notes via `Ema.SecondBrain` and `Ema.SecondBrain.Indexer`

This is the record of what is worth remembering.

### Bridge rules

- `intent_links` bridges semantic truth to operational truth.
- Context assembly bridges semantic truth to knowledge truth.
- Projections are downstream of these truths, not peers to them.
- The intent graph should not absorb the execution system or the wiki into itself.

## Canonical vs Derived Stores

### Canonical

Source of truth:

- `intents`
- `intent_edges`
- `intent_events`

All writes go through `Ema.Intents`.

### Derived

Regenerable projections:

- `.superman/intents/<slug>/`
- `vault/intents/`
- `vault/system/state/intents.md`
- `ema intent tree` and similar rendered views

Loss of a derived artifact is rebuild work, not data loss.

## Durable Identity vs Transient Links

Intent identity must stay stable even as executions, sessions, and supporting docs change.

### Durable intent identity

Core fields:

- `id`
- `title`
- `slug`
- `description`
- `level`
- `kind`
- `parent_id`
- `project_id`
- `source_fingerprint`
- `source_type`
- timestamps

These fields define what the intent is.

### Mutable state

Progress and confidence fields:

- `status`
- `phase`
- `completion_pct`
- `clarity`
- `energy`
- `priority`
- `autonomy_level`
- `fitness_score`
- `confidence`
- `provenance_class`
- `confirmed_at`
- `tags`

These fields define where the intent currently stands.

### Transient links

Separate join table:

- `intent_links.intent_id`
- `intent_links.linkable_type`
- `intent_links.linkable_id`
- `intent_links.role`
- `intent_links.provenance`
- timestamps

This supports:

- Multiple executions per intent
- Multiple sessions contributing to one intent
- Proposal + brain dump + docs as co-origins/evidence
- Linked vault notes and repo docs without bloating the core table

## Lineage Spine

`intent_events` is an append-only audit trail.

It is not full event sourcing.

### Purpose

Answer:

- Where did this intent come from?
- Why was it created?
- What changed?
- What evidence promoted or demoted it?
- Which projection or knowledge artifact was generated from it?

### Event types

Minimum useful set:

- `created`
- `status_changed`
- `phase_advanced`
- `linked`
- `unlinked`
- `reparented`
- `merged`
- `split`
- `archived`
- `execution_started`
- `execution_completed`
- `confirmed`
- `promoted`
- `demoted`
- `crystallized`
- `outcome_recorded`
- `projection_rebuilt`

### Rule

State correctness lives in `intents`.
Auditability lives in `intent_events`.

## Provenance, Confidence, Confirmation

Not all sources are equally trustworthy.

### High confidence

Can create or update intents directly:

- Manual creation
- Operator edits
- Approved proposals
- Execution-backed outcomes

### Medium confidence

Can create leaf intents with moderate confidence:

- Brain dumps
- Harvested sessions
- Vault seeding

### Lower confidence until confirmed

Should create candidates, suggestions, or low-confidence intents first:

- Clustering
- Structural auto-analysis
- Crystallization inference
- Cross-note pattern mining

### Confirmation thresholds

A low- or medium-confidence structure becomes execution-ready or promotable when at least one of these is true:

- Repeated occurrence
- Multi-source corroboration
- Operator confirmation
- Successful execution linkage
- Durable supporting knowledge is attached

### Guardrail

The graph may speculate.
Curated knowledge should not speculate without evidence.

## Bootstrap In EMA Reality

The bootstrap must start from current repo surfaces, not imagined replacements.

### Existing modules and surfaces

Semantic and intent-adjacent:

- `daemon/lib/ema/intelligence/intent_map.ex`
- `daemon/lib/ema/intelligence/intent_node.ex`
- `daemon/lib/ema/intelligence/intent_edge.ex`
- `daemon/lib/ema/intelligence/intent_cluster.ex`
- `daemon/lib/ema/executions/intent_folder.ex`
- `daemon/lib/ema/brain_dump/brain_dump.ex`
- `daemon/lib/ema/intention_farmer/`

Knowledge and context:

- `daemon/lib/ema/second_brain/second_brain.ex`
- `daemon/lib/ema/second_brain/indexer.ex`
- `daemon/lib/ema/memory/context_assembler.ex`
- `daemon/lib/ema/intelligence/context_builder.ex`
- `daemon/lib/ema/vault/vault_bridge.ex`
- `daemon/lib/ema/cli/commands/vault.ex`
- `daemon/lib/ema/mcp/tools.ex`

Data and working memory:

- `daemon/.superman/intents/`
- `~/.local/share/ema/vault/wiki/`
- `~/.local/share/ema/vault/projects/ema/`
- `~/.local/share/ema/vault/system/state/`
- `~/vault/wiki/`
- `~/vault/Agents/`

### New modules for bootstrap

- `daemon/lib/ema/intents/intent.ex`
- `daemon/lib/ema/intents/intent_link.ex`
- `daemon/lib/ema/intents/intent_event.ex`
- `daemon/lib/ema/intents/intents.ex`
- `daemon/lib/ema/intents/populator.ex`
- migration creating `intents`, `intent_links`, `intent_events`

### Edited modules for bootstrap

- `daemon/lib/ema/brain_dump/brain_dump.ex`
- `daemon/lib/ema/executions/executions.ex`
- `daemon/lib/ema/intention_farmer/loader.ex`
- `daemon/lib/ema/intention_farmer/note_emitter.ex`
- `daemon/lib/ema/memory/context_assembler.ex`
- `daemon/lib/ema/cli/commands/intent.ex`
- `daemon/lib/ema_cli/intent.ex`
- `daemon/lib/ema_web/router.ex`

### Kept in place during transition

- Existing `intent_nodes` and `intent_edges` remain readable
- `harvested_intents` remains in use until harvest flow is repointed

## Knowledge Topology

The system must distinguish between repo truth, EMA-managed knowledge, host-machine knowledge, and generated working memory.

### 1. EMA repo truth

Paths:

- `/home/trajan/Projects/ema/docs/`
- source code and migrations
- project-local `.superman/intents/`

Use:

- Architecture truth
- Implementation truth
- Current code references

### 2. EMA-managed vault

Paths:

- `~/.local/share/ema/vault/wiki/`
- `~/.local/share/ema/vault/projects/ema/specs`
- `~/.local/share/ema/vault/projects/ema/notes`
- `~/.local/share/ema/vault/projects/ema/plans`
- `~/.local/share/ema/vault/system/state/`

Use:

- Curated EMA wiki
- Project-local working specs
- Generated but durable system state

### 3. Host-machine vault

Paths:

- `~/vault/wiki/`
- `~/vault/Agents/`
- `~/vault/research-ingestion/`
- related archives/imports

Use:

- Broader project memory
- Agent histories
- Research archives
- Operational docs from outside the repo

### 4. Generated / provisional working memory

Paths and forms:

- `.superman/intents/`
- execution scratchpads
- harvested notes
- generated state reports
- session captures

Use:

- Fast iteration
- Draft context
- Operator review inputs

## Cross-Pollination Guardrails

Cross-pollination is required, but it needs discipline.

### Rules

- Host-machine curated docs are not overwritten by generated projections.
- Agent-vm or generated scratch material is provisional unless promoted.
- Imported material keeps provenance labels.
- No blind merge of semantically conflicting sources.
- Generated notes land in generated spaces first, not curated spaces.
- Promotion into curated wiki truth requires thresholds or operator confirmation.

### Default posture

Ingest and link first.
Promote and rewrite later.

## Projection Discipline

The system should project outward from truth stores, not create parallel competing truths.

### Projections include

- `.superman/intents/<slug>/`
- Markdown intent notes in vault-generated spaces
- System state snapshots
- CLI trees and summaries

### Rules

- Projections are rebuildable.
- Projections should carry provenance metadata where possible.
- Projections should never silently overwrite curated sources.
- Staleness must be inspectable.

## Context Assembly

Execution-ready context should be assembled, not dumped.

Bootstrap should extend `Ema.Memory.ContextAssembler` and `Ema.Intelligence.ContextBuilder` rather than invent a second context system.

### Always include

- The intent itself
- Parent/child spine
- Direct dependencies
- Linked executions, proposals, tasks
- High-confidence lineage entries

### Prefer next

- Curated EMA wiki pages
- Project-local specs and notes
- Repo docs
- Directly linked host-machine docs

### Include conditionally

- Recent session captures
- Harvested notes
- Execution scratchpads
- Imported archives

Only when linked, recent, or corroborating.

### Avoid by default

- Noisy archives
- Broad search dumps
- Stale projections
- Unconfirmed cluster output

### Ranking rules

- Provenance-aware inclusion
- Bounded context budgets
- Curated over noisy
- Local project docs over general archives
- Direct intent linkage over semantic similarity

## Minimum Lovable Bootstrap

Bootstrap is complete when the following are true:

- `intents`, `intent_links`, and `intent_events` exist
- `Ema.Intents` supports CRUD and tree queries
- Status propagation works
- Brain dumps populate new intents
- Execution completion updates linked intents
- Existing intent folders are migratable into the new table
- Existing intent nodes are migratable into the new table
- `ema intent tree --project=ema` shows populated real data
- `ema intent create` works
- `ema intent show` explains lineage and linked operational artifacts
- Context assembly can show supporting curated knowledge for an intent
- Intent system docs are updated

## Defer For Later

- Full `vault/intents/` projection tree
- Structural auto-intent generation
- Reflexive system-level harvesting from clusters
- Workflow crystallization
- Embeddings and semantic similarity layer
- Knowledge promotion automation
- Wikipedia frontend
- Ratatui/Bubble Tea TUI
- Full MCP discovery/probe layer

## Operator Superpowers

Bootstrap should unlock immediate practical capabilities.

### CLI

- `ema intent tree --project=ema`
- `ema intent create "..."`
- `ema intent show <id>`
- `ema intent link <id> --depends-on <id>`
- `ema dump "..."`
- `ema intent context <id>`
- `ema intent knowledge <id> --best`
- `ema intent sources <id>`
- `ema intent stale`
- `ema intent promotions`
- `ema intent status`

### MCP

- `ema_get_intents(...)`
- `ema_query_intent_context(intent_id: ..., include_sources: true)`

### What these should answer

- What is the best curated knowledge for this intent?
- What came from host_machine vs agent_vm vs repo docs?
- Which generated notes were promoted into durable wiki truth?
- Which projections are stale relative to curated sources?
- What is the provenance chain behind this context bundle?
- Which workflows or crystallizations have enough evidence to publish back?

## Implementation Order

1. Create core tables and `Ema.Intents`.
2. Build migration/import from existing `intent_nodes` and `.superman/intents/`.
3. Add event broadcasts from brain dump and execution completion.
4. Add populator that creates/updates intents and lineage.
5. Repoint CLI/API intent reads to the new context.
6. Extend context assembly with provenance-aware intent-linked knowledge.
7. Update docs and leave projection/promotion automation for later.

## Acceptance Criteria

The bootstrap is accepted when:

- New brain dumps create visible leaf intents automatically.
- Existing intent folders are visible in the new tree.
- Intent detail shows lineage plus linked operational records.
- Intent context prefers curated project knowledge over broad archives.
- Source separation is visible enough to distinguish repo, EMA vault, host vault, and generated notes.
- No generated projection overwrites curated knowledge during bootstrap.

## Open Questions

These are intentionally left open for the next pass, not blockers for bootstrap:

- Exact six-level hierarchy names and semantics
- Whether `vault_note` and `doc` should stay separate linkable types
- Which promotion thresholds should be automatic vs operator-only
- How much host-machine vault content should be mirrored into EMA-managed spaces
- Whether intent projections should be written by `SystemBrain`, `VaultBridge`, or a dedicated projector
