---
id: EXE-002
type: execution
layer: executions
title: "Canon ID collision fix — DEC-004/005 split, DEC-001 TypeDB correction, stale ARCHITECTURE archive"
status: completed
created: 2026-04-12
updated: 2026-04-12
completed_at: 2026-04-12
connections:
  - { target: "[[canon/decisions/DEC-001-graph-engine]]", relation: updates }
  - { target: "[[canon/decisions/DEC-004-gac-card-backend]]", relation: preserves }
  - { target: "[[canon/decisions/DEC-005-actor-phases]]", relation: preserves }
  - { target: "[[canon/decisions/DEC-007-unified-intents-schema]]", relation: creates }
  - { target: "[[canon/decisions/DEC-008-daily-validation-ritual]]", relation: creates }
tags: [execution, canon, id-collision, graph-hygiene, prerequisite]
---

# EXE-002 — Canon ID collision fix

Prerequisite for the Intent-system port (EXE-003). The canon graph had two
duplicate DEC IDs and one stale architecture doc describing the wrong
stack. These are bugs in the canonical state of record. They must be fixed
before the graph engine is built, because the Object Index will otherwise
index ambiguous IDs and downstream wikilinks to `[[DEC-004]]` /
`[[DEC-005]]` cannot be disambiguated.

## Renames

| Old path | New path | New ID | Reason |
|---|---|---|---|
| `ema-genesis/canon/decisions/DEC-004-unified-intents-schema.md` | `DEC-007-unified-intents-schema.md` | **DEC-007** | Collision with `DEC-004-gac-card-backend.md` (active, locked). The GAC card backend decision keeps the DEC-004 slot because it is the older, locked record; the unified-intents decision (recovered from the old Elixir wiki, status preliminary) moves. |
| `ema-genesis/canon/decisions/DEC-005-daily-validation-ritual.md` | `DEC-008-daily-validation-ritual.md` | **DEC-008** | Collision with `DEC-005-actor-phases.md` (active, locked). Actor phases keeps DEC-005 for the same reason. |

Both renamed files:
- updated frontmatter `id` to the new number
- added `renumbered_from` / `renumbered_at` / `renumbered_reason` frontmatter fields so the history of the move is captured inside the node
- added cross-references in the `connections:` block to the DEC that kept the old ID, so the graph engine can traverse the rename without losing the pairing
- updated all inline `[[DEC-004]]` / `[[DEC-005]]` self-references to `[[DEC-007]]` / `[[DEC-008]]`

## DEC-001 TypeDB / Cozo correction

`DEC-001-graph-engine.md` had an internal inconsistency the audit flagged:
prose at lines 47 + 66-68 said "Cozo last commit Dec 2024, going stale"
and "TypeDB is the live alternative," but the frontmatter `connections:`
listed only Cozo as `references` and the "Phase 4 — Future escape valve"
section still said "swap the storage layer for Cozo."

Fixes applied:

- frontmatter `connections:` now includes TypeDB as `references` and Cozo as `historical`
- Phase 4 prose rewritten: "swap the storage layer for **TypeDB** (Cozo going stale as of Dec 2024 — last commit December 2024, no release since 2023, treat as historical; Kuzu archived 2025-10-10, do not use). TypeDB is schema-first, actively maintained through v3.8.3 (March 2026), and gives rule-inference as a bonus on top of the Datalog target the original decision named."

## docs/ARCHITECTURE.md — stale Elixir/Tauri doc

The 387-line `docs/ARCHITECTURE.md` opened with:

> Status: As-built, April 2026
> Stack: Elixir/Phoenix 1.8 daemon + Tauri 2 + React 19 + Zustand + SQLite

That stack is the one in `IGNORE_OLD_TAURI_BUILD/`, not the live TypeScript+Electron rebuild. Leaving it in `docs/` is a direct contradiction of `CLAUDE.md` at the repo root, which says "The stack is Electron + TypeScript end to end. No Tauri references."

Action:

- moved to `docs/archive/ARCHITECTURE-ELIXIR-ERA.md` (archive directory created)
- replaced with a 7-line `docs/ARCHITECTURE.md` that points at the canon graph (`ema-genesis/SCHEMATIC-v0.md`, `EMA-GENESIS-PROMPT.md`, `CANON-STATUS.md`, `canon/decisions/`) as the authoritative source and notes the archive location for anyone needing to mine the old stack description

## Not done here (surfaced for follow-up)

- `BLUEPRINT-REALITY-DISCREPANCIES.md` is still stale (claims 66 `services/core/` dirs; actual 14). A refresh pass is queued as a follow-up intent but out of scope for this 30-minute canon-fix.
- `docs/CONVERGENCE-READINESS-REPORT.md` also describes the old Elixir daemon and should probably move to `docs/archive/` next to `ARCHITECTURE-ELIXIR-ERA.md`. Same reasoning applies.

## Why this mattered enough to gate EXE-003

The Intent-system port writes `intent_links` rows with `target: "[[DEC-NNN]]"` strings. If DEC-004 and DEC-005 each point at two different canon nodes, every intent that references either one becomes ambiguous and the Object Index can't resolve the edge. Fixing the collisions now is ~30 minutes; fixing them after 100 intents have been indexed against them is hours plus a data-migration pass. Pay the fixed cost now.

#execution #canon #prerequisite #intents-port
