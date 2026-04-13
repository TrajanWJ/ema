---
id: META-CANON-STATUS
type: meta
layer: _meta
title: "Canon Status — which docs are authoritative, which are aspirational"
status: active
created: 2026-04-12
updated: 2026-04-12
author: system
tags: [canon, status, ruling, genesis, v1-spec]
connections:
  - { target: "[[EMA-GENESIS-PROMPT]]", relation: references }
  - { target: "[[SCHEMATIC-v0]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
  - { target: "[[vapps/CATALOG]]", relation: references }
---

# Canon Status

> **Ruling issued 2026-04-12** by the human project lead in response to research navigation Q1.

## The Tension

Two sets of documents disagree about what EMA v1 actually is:

| Doc | Position |
|---|---|
| `EMA-V1-SPEC.md` (2026-04-11) | Declares itself successor. Cuts v1 to **CLI + TS library + folder-of-markdown graph + 1 LLM provider + intent loop**. Electron, P2P, vApps, multi-agent all labeled "v2+". |
| `EMA-GENESIS-PROMPT.md` v0.2 | Describes the **maximalist vision**: 35 vApps, P2P mesh, puppeteer terminal runtime, distributed homelab, graph wiki with 4 layers, research ingestion, web wiki. Labeled canonical in §15. |
| `SCHEMATIC-v0.md` | Same maximalist stance as Genesis. Labeled canonical. |
| `vapps/CATALOG.md` | Describes all 35 vApps as if they exist in v1. Labeled canon active. |
| `canon/specs/AGENT-RUNTIME.md` | Deep-dive spec for Electron puppeteer runtime with xterm.js + tmux. Labeled canon active. |
| `canon/specs/BLUEPRINT-PLANNER.md` | Deep-dive vApp spec with full data models and user flows. Labeled canon active. |

## The Ruling

**Q1 answer = B. Genesis wins.**

The maximalist Genesis vision is the canonical target. `EMA-V1-SPEC.md` is **re-labeled as Phase 1 of the Genesis vision**, not a competing reduction.

## What This Changes

| Doc | Before | After |
|---|---|---|
| `EMA-GENESIS-PROMPT.md` | Canonical target. Status: active. | Unchanged. Canonical target. Status: active. |
| `SCHEMATIC-v0.md` | Canonical architecture. | Unchanged. Canonical architecture. |
| `vapps/CATALOG.md` | Canon active. | Unchanged. Canon active — describes the full v-final catalog. |
| `canon/specs/AGENT-RUNTIME.md` | Canon active. | Unchanged. Canon active — describes the Phase 2 runtime target. |
| `canon/specs/BLUEPRINT-PLANNER.md` | Canon active. | Unchanged. Canon active — describes the Phase 4 Blueprint vApp target. |
| `canon/specs/EMA-V1-SPEC.md` | *"supersedes all prior extractions"* | **Re-labeled.** The header claim gets softened. See `[[CANON-DIFFS]]`. V1-SPEC becomes the **Phase 1 contract** inside the Genesis vision. Nothing it says gets thrown away — it is still the minimum viable slice — but it no longer claims to replace Genesis. |

## Scope for Cross-Pollination Research

Because Q1=B, cross-pollination research targets the **full Genesis vision**, not just V1-SPEC scope. Research categories:

- Agent orchestration / multi-agent coordination / parallel dev agents
- P2P networks / local-first sync / CRDTs / Gun.js / Automerge / Yjs / Loro
- Knowledge graphs / Obsidian-like wikis / graph databases / SurrealDB
- CLI frameworks / terminal emulators in Electron / xterm.js / node-pty / tmux wrappers
- vApp / plugin architectures / Electron multi-window management
- Context engines / LLM context assembly / agent memory / session continuity
- Research ingestion / RSS + AI curation / feed aggregators
- Personal life OS / ADHD / executive function tools (already seeded)
- Self-building systems / intent-proposal-execution pipelines

See `[[research/_moc/RESEARCH-MOC]]` for the live research index.

## Reality Check — 2026-04-12

The canonical target is still the Genesis vision, but the Electron/TypeScript repo is no longer just scaffolding:

- root `pnpm build` is green
- root `pnpm test` is green
- a bootstrap intent → proposal → execution loop now exists in `services/core/{intent,proposal,execution,loop}/`
- `docs/GROUND-TRUTH.md` is the current reality ledger
- `docs/BLUEPRINT.md` is the current implementation blueprint

This does **not** mean Genesis is complete. It means there is now a verified minimal loop inside the TypeScript runtime that future sessions should extend instead of rebuilding.

## Preliminary Additions 2026-04-12 / Repair Pass 2026-04-13

Two waves of additions and one repair pass landed across 2026-04-12 and 2026-04-13. None alter the original Q1 ruling — Genesis still wins. They expand the canon graph and reconcile its self-references.

### Wave A — Recovery pass (canon specs, 2026-04-12)

Recovered from the old Elixir build. All started `status: preliminary`:

- `canon/specs/EMA-CORE-PROMPT` — the "soul" system prompt (verbatim port)
- `canon/specs/agents/_MOC` — agent prompt index
- `canon/specs/agents/AGENT-ARCHIVIST` — knowledge consolidation role
- `canon/specs/agents/AGENT-STRATEGIST` — goal decomposition role
- `canon/specs/agents/AGENT-COACH` — reflective practice role
- `canon/specs/BABYSITTER-SYSTEM` — 7-lane observability subsystem
- `canon/specs/PROPOSAL-TEMPLATES` — 5-template seed library
- `canon/specs/PROPOSAL-QUALITY-GATE` — preflight 100-point rubric
- `canon/specs/PIPES-SYSTEM` — 22 triggers + 15 actions + 5 transforms
- `canon/specs/ACTOR-WORKSPACE-SYSTEM` — 5-phase cadence + EntityData + tags
- `canon/specs/EXECUTION-SYSTEM` — 15-field execution schema + Dispatcher + IntentFolder

### Wave B — ID collision fix (2026-04-12, EXE-002)

- `canon/decisions/DEC-007-unified-intents-schema` (renamed from a same-day-DEC-004 collision)
- `canon/decisions/DEC-008-daily-validation-ritual` (renamed from a same-day-DEC-005 collision)

The original `DEC-004-gac-card-backend.md` and `DEC-005-actor-phases.md` keep their IDs. See `[[executions/EXE-002-canon-id-collisions]]` for the rename rationale.

### Repair pass (2026-04-13, EXE-003)

- `canon/specs/EMA-V1-SPEC` header re-framed: no longer claims to supersede Genesis; now states Phase 1 of the Genesis vision per this ruling.
- `canon/specs/EXECUTION-SYSTEM` and `canon/specs/PIPES-SYSTEM` cross-references updated from the old DEC-004 name to the renamed `DEC-007-unified-intents-schema`.
- `canon/decisions/DEC-004-gac-card-backend` and `canon/decisions/DEC-005-actor-phases` gained `implementation_status: pending` frontmatter fields pointing at INT-RECOVERY-WAVE-1 Stream 3.
- `canon/decisions/DEC-007-unified-intents-schema` upgraded from `status: preliminary` to `status: active` per the DOC-TRUST-HIERARCHY upgrade rule (3+ foundational references without contradictions).
- This index updated to list every canon spec and decision now in the graph.

The full canon spec list as of 2026-04-13: `EMA-V1-SPEC`, `EMA-VOICE`, `AGENT-RUNTIME`, `BLUEPRINT-PLANNER`, `EMA-CORE-PROMPT`, `BABYSITTER-SYSTEM`, `PROPOSAL-TEMPLATES`, `PROPOSAL-QUALITY-GATE`, `PIPES-SYSTEM`, `ACTOR-WORKSPACE-SYSTEM`, `EXECUTION-SYSTEM`, `agents/_MOC`, `agents/AGENT-ARCHIVIST`, `agents/AGENT-STRATEGIST`, `agents/AGENT-COACH`.

The full decision list: `DEC-001` (graph engine), `DEC-002` (CRDT/filesync split), `DEC-003` (aspiration detection), `DEC-004` (GACCard backend, implementation_status: pending), `DEC-005` (actor phases, implementation_status: pending), `DEC-006` (deferred CLI features), `DEC-007` (unified intents, status: active as of 2026-04-13), `DEC-008` (daily validation ritual).

## Related Nodes

- `[[research/_moc/RESEARCH-MOC]]` — Research layer map of content
- `[[intents/GAC-QUEUE-MOC]]` — GAC cards surfaced by research
- `[[_meta/CANON-DIFFS]]` — Proposed updates to the 7 canon docs
- `[[_meta/SELF-POLLINATION-FINDINGS]]` — Patterns worth porting from the old build
- `[[docs/GROUND-TRUTH]]` — Verified repo reality
- `[[docs/BLUEPRINT]]` — Buildable Electron/TypeScript architecture
- `[[executions/EXE-003-canon-repair-batch-2026-04-13]]` — execution record for the 2026-04-13 repair pass

#meta #canon-status #ruling #genesis #v1-spec
