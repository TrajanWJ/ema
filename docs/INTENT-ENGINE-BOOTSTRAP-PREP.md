# Intent Engine Bootstrap Prep

## Status

Prepared on 2026-04-06 from the completed architecture pass, repo spec, and wiki update.

This document is the implementation-facing handoff for the unified Intent Engine bootstrap.

## Purpose

Translate the architecture into a concrete, low-ambiguity bootstrap sequence that can be executed in EMA without reopening first-order design questions.

## Inputs

- `docs/INTENT-ENGINE-SPEC.md`
- `docs/superpowers/specs/2026-04-06-intent-engine-design.md`
- `.superpowers/brainstorm/1061313-1775471603/content/intent-schema-v3.html`
- `~/.local/share/ema/vault/wiki/Architecture/Intent-System.md`

## Bootstrap Outcome

After bootstrap:

- EMA has canonical `intents`, `intent_links`, and `intent_events` tables
- Existing intent-related data is migrated or linked forward
- Brain dumps and execution completions populate the new graph
- CLI and API read from `Ema.Intents`
- The wiki describes the real system instead of the obsolete “zero code exists” plan
- Context assembly can explain why a given piece of knowledge is included for an intent

## Scope

### In scope

- Core schema and migration
- `Ema.Intents` context
- Populator wiring
- Existing data import from `intent_nodes` and `.superman/intents/`
- CLI/API read path repoint
- Provenance-aware context assembly extension
- Wiki and docs refresh

### Out of scope

- Full `vault/intents/` projection tree
- TUI
- Full Wikipedia frontend
- Structural auto-intent generation
- Workflow crystallization
- Full cross-machine promotion automation

## Work Packages

### WP1. Schema foundation

Files:

- `daemon/priv/repo/migrations/2026040610xxxx_create_intents.exs`
- `daemon/lib/ema/intents/intent.ex`
- `daemon/lib/ema/intents/intent_link.ex`
- `daemon/lib/ema/intents/intent_event.ex`

Deliverables:

- Canonical tables exist
- Core fields match the spec
- Minimal indexes exist for lookup by `slug`, `project_id`, and `intent_id`

### WP2. Context module

Files:

- `daemon/lib/ema/intents/intents.ex`

Deliverables:

- CRUD
- Tree query
- Edge query helpers
- Link attach/query helpers
- Event emission helpers
- Status propagation

### WP3. Migration and import

Files:

- likely inside `daemon/lib/ema/intents/` or a Mix task

Sources:

- Existing `intent_nodes`
- Existing `.superman/intents/`
- Existing harvested signals where practical

Deliverables:

- Import preserves provenance
- Imported rows emit `migration` lineage
- Duplicate handling is explicit, fingerprint-based where possible

### WP4. Population wiring

Files:

- `daemon/lib/ema/intents/populator.ex`
- `daemon/lib/ema/brain_dump/brain_dump.ex`
- `daemon/lib/ema/executions/executions.ex`
- `daemon/lib/ema/intention_farmer/loader.ex`
- `daemon/lib/ema/application.ex`

Deliverables:

- Brain dump creates leaf intent automatically
- Execution completion updates linked intent state
- Harvester can create or attach intents rather than only writing indirect artifacts

### WP5. Read-path repoint

Files:

- `daemon/lib/ema/cli/commands/intent.ex`
- `daemon/lib/ema_cli/intent.ex`
- `daemon/lib/ema_web/router.ex`

Deliverables:

- CLI tree/show/create operate on the new context
- API can expose canonical intent data
- Old code paths remain readable during transition

### WP6. Context assembly extension

Files:

- `daemon/lib/ema/memory/context_assembler.ex`
- `daemon/lib/ema/intelligence/context_builder.ex`

Deliverables:

- Intent-linked context bundle exists
- Curated project knowledge outranks noisy archives
- Repo docs / EMA vault / host vault / generated notes remain distinguishable
- Provenance is visible in assembled output

### WP7. Documentation and exposition

Files:

- `docs/INTENT-ENGINE-SPEC.md`
- `docs/INTENT-ENGINE-BOOTSTRAP-PREP.md`
- `docs/superpowers/specs/2026-04-06-intent-engine-design.md`
- `~/.local/share/ema/vault/wiki/Architecture/Intent-System.md`
- `~/.local/share/ema/vault/wiki/_index.md`

Deliverables:

- Architecture is aligned across repo spec, superpowers spec, and wiki
- Wiki no longer claims zero implementation exists
- Bootstrap status and scope are visible to operators and agents

## Readiness Checklist

- [x] Unified architecture pass completed
- [x] Narrow bootstrap spec written
- [x] Exposed wiki updated to current reality
- [x] Bootstrap prep handoff written
- [ ] Migration file created
- [ ] `Ema.Intents` context created
- [ ] Populator wired
- [ ] Import path implemented
- [ ] CLI/API repointed
- [ ] Context assembly extended
- [ ] Bootstrap smoke-tested

## Smoke Tests To Use Once Implementation Starts

- `ema intent tree --project=ema`
- `ema intent create "bootstrap test intent" --level=4 --kind=task`
- `ema dump "bootstrap test from brain dump"`
- `ema intent show <id>`
- `ema intent status`

## Risks To Watch

- Accidentally treating generated projections as curated truth
- Losing provenance during import
- Regressing existing intent-related CLI surfaces during repoint
- Letting host-vault imports swamp local project context
- Reopening hierarchy debates before the semantic core is proven

## Decision

Proceed with bootstrap as a consolidation of existing EMA pieces, not a greenfield reinvention.
