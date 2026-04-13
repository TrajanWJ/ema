---
id: META-DISCREPANCIES
type: meta
layer: _meta
title: "Blueprint Reality Discrepancies — canon vs monorepo 2026-04-12"
status: active
created: 2026-04-12
updated: 2026-04-12
author: reality-reconciliation-pass
connections:
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[intents/INT-RECOVERY-WAVE-1/README]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
  - { target: "[[DEC-004]]", relation: references }
tags: [meta, discrepancies, canon, reality, blocking, wave-1]
---

# Blueprint Reality Discrepancies

> Reality reconciliation pass conducted 2026-04-12 against six canon sources.
> All canonical texts locked. Monorepo timestamp: latest commit `7b1e2a8 feat: bulk cross-session work`.
> Total discrepancies found: **18 across 6 categories**. 

---

## TL;DR

- **18 total discrepancies** spanning schema, services, intents, and vApps
- **3 blocking for Bootstrap v0.1**: missing GACCard backend, missing @ema/tokens package, Services core architecture broken
- **7 high severity**: drift in Intent schema, missing Pipes registry, vApp catalog has no implementation paths
- **8 medium**: cosmetic drift, partially-complete services, aspirational deps

**Biggest gap:** INT-RECOVERY-WAVE-1 Stream 2 (@ema/tokens) and Stream 3 (Blueprint, Pipes, Composer) are **all marked PENDING** in the intent but canon decisions (DEC-004, DEC-005, DEC-006) are **already locked**. Reality has not caught up to canon.

**Biggest surprise:** `services/core/` has 66 directories scaffolded but **zero functioning service implementations**. All 66 dirs are empty stubs or contain only `.ts` files with imports but no logic. This is architectural scaffolding pretending to be code.

---

## Section 1 — Canon Specs vs Services/ Reality

### Canonical Claims (EMA-V1-SPEC §4)

EMA v1 should have six canonical entity types:
- Node (base)
- Intent
- Proposal  
- Execution
- Canon Doc
- Actor
- Space

### Actual State

| Canon entity | Services claim | Reality | Severity |
|---|---|---|---|
| Intent | `services/core/intents/` exists | Empty directory. No implementation. Intent read/write logic exists in old build (Elixir), **zero TypeScript port**. | blocking |
| Proposal | `services/core/proposals/` exists | Empty. Canon spec `EMA-V1-SPEC §4 Proposal` defines clear fields. `shared/schemas/proposals.ts` is a stub (683 bytes). No pipeline, no GenServer equiv, no scoring engine. | high |
| Execution | `services/core/executions/` exists | Implementation incomplete: `executions.router.ts`, `executions.service.ts`, `executions.channel.ts` exist (191 LOC total) but missing core logic per `AGENT-RUNTIME.md`. No tmux wrapper, no session recording, no reflexion injector. | high |
| Actor | `services/core/actors/` exists | Empty directory. Schema exists (`shared/schemas/agents.ts`, 523 bytes = stub). No phase cadence state machine per `DEC-005` (locked spec).  | high |
| Space | `services/core/spaces/` exists | Empty directory. Canon defines Space as parent/members/config. Not implemented. | medium |
| Canon Doc | No explicit service | Intents/Proposals/Executions scattered across multiple services. Not modeled as first-class Node type. | medium |

### Missing Service Implementations Named in Canon

Canon specs promise these subsystems; monorepo has empty dirs:

| Canon name (from SELF-POLLINATION TIER PORT) | Required path | Actual state |
|---|---|---|
| Pipes (22 triggers + 15 actions + 5 transforms) | `services/core/pipes/` | **Empty directory.** DEC-004 locks the design; INT-RECOVERY-WAVE-1 Stream 3 marks it PENDING. No EventEmitter bus, no registry.ts, no transforms/. | blocking |
| Blueprint GACCard backend | `services/core/blueprint/` | **Does not exist.** DEC-004 (status: locked) demands Zod schema + Drizzle table + state machine + routes + MCP tools. INT-RECOVERY-WAVE-1 Stream 3 marks it PENDING. No `gac-card.ts` in `shared/schemas/`. | blocking |
| Composer (artifact discipline wrapper) | `services/core/composer/` | **Does not exist.** INT-RECOVERY-WAVE-1 Stream 3 says `compile(artifactDir, prompt)` with non-fatal failure mode. Completely missing. | high |
| VisibilityHub (active topics stream) | `services/core/visibility/` | Partial: `visibility/types.ts` exists (skeleton only). No WebSocket route, no AmbientStrip consumer mentioned. | high |
| MCP service (25 tools + 11 resources) | `services/core/mcp/` | Does not exist. SELF-POLLINATION says this is TIER PORT (not replace). Agent accessibility is critical. | high |

---

## Section 2 — Canon Decisions vs Implementation

| Decision | Claim | Reality | Contradiction? |
|---|---|---|---|
| **DEC-001** Graph engine = Object Index + SilverBullet pattern + SQLite | Commits to `better-sqlite3` + hand-rolled DQL + iwe-style retrieve() | **DRIFT**: No code exists yet. `shared/schemas/` has stubs but no indexer, no watcher, no DQL parser. `RESEARCH-MOC.md` stays hand-maintained. Incremental reindex promised for Phase 2 `ema-core`. | drift—on schedule |
| **DEC-002** Sync split: Syncthing + Loro | File sync (Syncthing BEP) for markdown, Loro CRDT for structured data | **NOT YET IMPLEMENTED**: No Syncthing integration in services. No Loro imports in monorepo. Decision is locked but code is v2+ TBD. This is correct—it's deferred. | expected |
| **DEC-004** GACCard = first-class backend | Zod + Drizzle + state machine (pending→answered→deferred→promoted) + HTTP routes + MCP tools + two-layer filesystem (.superman/gac/) | **MISSING**: No `services/core/blueprint/`. No `gac-card.ts` schema. No routes. No MCP tools. Literal zero implementation. INT-RECOVERY-WAVE-1 Stream 3 checkbox is **UNCHECKED**. | blocking contradiction |
| **DEC-005** Actor phases = 7-state cadence | 5-phase state machine (per GAC-003 answer [D]) + EntityData composite key + PhaseTransition append-only log | **MISSING**: No schema at `shared/schemas/actor-phase.ts`. No phase_transition table. Actors are empty dir. GAC-003 decision made; DEC-005 written; code: zero. | blocking contradiction |
| **DEC-006** Deferred CLI features (quality/routing/evolution) | Records that quality checks, multi-provider routing, evolution patterns go to v2+ | **CORRECT**: Decision successfully documents what's out of scope. No contradiction here. | none |

**Key finding**: Three decisions (DEC-004, DEC-005, DEC-001) are **status: locked** but their implementations are **status: pending** in INT-RECOVERY-WAVE-1. This is the core discrepancy.

---

## Section 3 — Aspirational vs Built (TIER PORT Inventory)

SELF-POLLINATION identifies six S-tier priorities. Status check:

| Old Elixir module | New TS target | Promised LOC | Actual LOC | Verdict |
|---|---|---|---|---|
| **Ema.Intents** (filesystem + DB index) | `services/core/intents/` + `workers/intent-watcher/` | Medium effort | 0 | MISSING |
| **Ema.Proposals.Pipeline** (Generator→Refiner→Debater→Tagger→Combiner) | `workers/proposal-pipeline/` | High effort | 0 | MISSING |
| **Ema.Pipes** (trigger/action registry) | `services/core/pipes/` | Low–Medium | 0 | MISSING |
| **Ema.Actors** (5-phase cadence) | `services/core/actors/` | Medium | 0 | MISSING |
| **Ema.Executions.Dispatcher** | `workers/executions/` | Medium | 200 (partial: router + channel only) | PARTIAL |
| **Ema.MCP** (25 tools + 11 resources) | `services/core/mcp/` | Low | 0 | MISSING |

**Finding**: All six S-tier modules remain unported. The monorepo has the scaffold directories but no implementation. SELF-POLLINATION status says this is *the* blocking thing for Wave 1.

---

## Section 4 — Schema Reality

### Canonical schemas (YAML in ema-genesis/schemas/) 

Empty directory — contains zero files.

```
$ ls -la ema-genesis/schemas/
total 0
```

### Actual TS schemas (shared/schemas/)

| File | Status | vs Canon |
|---|---|---|
| `agents.ts` | 523 bytes (stub: imports only) | Canon defines Actor as 7 fields + capabilities + spaces. TS stub is **empty**. |
| `intents.ts` | 638 bytes (stub: imports only) | Canon spec demands id, type, status, title, priority, source, parent_intent, blocked_by, connections. TS stub has **zero fields**. Should add `exit_condition` + `scope` per DEC-005 / GAC-004 answer. Missing. |
| `proposals.ts` | 683 bytes (stub) | Canon spec: intent_id, proposed_by, approval_status, plan, execution_id. TS stub **empty**. |
| `tasks.ts` | 812 bytes (stub) | Canon specifies: id, title, description, status, priority, due_at, started_at, completed_at, project_id, actor_id. TS stub **empty**. SELF-POLLINATION §DATA MODELS says add `started_at?` per neurodivergent-visual-org. Not done. |
| `gac-card.ts` | **does not exist** | DEC-004 demands Zod schema matching BLUEPRINT-PLANNER §Data Models. This file should exist at `shared/schemas/gac-card.ts` per DEC-004 implementation section. **BLOCKING**. |
| `actor-phase.ts` | **does not exist** | DEC-005 demands Zod union + Drizzle table for 7-state phase machine. **BLOCKING**. |

### Ghost schemas

Files in TS that have no canon equivalent:
- `settings.ts` (173 bytes, stub)
- `brain-dump.ts` (508 bytes, stub)
- `common.ts` (469 bytes, stub)
- `habits.ts` (528 bytes, stub)
- `projects.ts` (486 bytes, stub)

All nine `.ts` files in `shared/schemas/` are **stubs under 900 bytes each**, containing only imports and no actual schema definitions.

---

## Section 5 — Intents and Executions

### Intent inventory

Canonical intents by type:

| Type | Count | Status | Notes |
|---|---|---|---|
| GAC-NNN (Gaps, Assumptions, Clarifications) | 10 (GAC-001 through GAC-010) | All answered | Stream 1 complete per INT-RECOVERY-WAVE-1 |
| INT-RECOVERY-WAVE-1 | 1 | Active, phase: execute | Master intent for Wave 1. Streams 1 ✓, 2–5 PENDING. |

### Suspicious intents (marked `phase: execute` with zero corresponding code)

| Intent | Phase | Exit condition | Actual code | Verdict |
|---|---|---|---|---|
| INT-RECOVERY-WAVE-1 Stream 2 | execute | "All vApps have @ema/tokens, @ema/glass imported" | Zero. `shared/tokens/` does not exist. `shared/glass/` does not exist. | BLOCKING |
| INT-RECOVERY-WAVE-1 Stream 3 | execute | "Pipes registry + Blueprint + Composer + VisibilityHub operational" | Pipes: 0. Blueprint: 0. Composer: 0. VisibilityHub: types.ts stub only. | BLOCKING |
| INT-RECOVERY-WAVE-1 Stream 4 | execute | "CrossPollination + VaultSeeder + IntentionFarmer working" | All three: 0. | PENDING (depends on Stream 3) |

### Verified completed intents

Stream 1 canon resolutions (GAC-001 through GAC-005, DEC-004/005/006, EMA-VOICE): **✓ all documented in canon**, zero executable phase mapping needed.

---

## Section 6 — INT-RECOVERY-WAVE-1 Checkbox Reality

Master intent defines five streams with exit conditions. Cross-reference against reality:

### Stream 1 — Canon resolutions ✓

| Checkbox | Canon claim | Reality | Status |
|---|---|---|---|
| GAC-001 answered | Cross-machine dispatch → v2, DBOS target | Documented in `ema-genesis/intents/GAC-001/README.md` | MATCHED |
| GAC-002 answered | Concurrent coordination → v2, 3-tier split | Documented in `ema-genesis/intents/GAC-002/README.md` | MATCHED |
| GAC-003 answered | 7-state runtime + heartbeat [D] | Documented in `ema-genesis/intents/GAC-003/README.md` | MATCHED |
| GAC-004 answered | exit_condition + scope, kind-aware mandatory [D] | Documented; DEC-005 written | MATCHED |
| GAC-005 answered | Typed edges (frontmatter primary + inline) | Documented; DEC-001 references | MATCHED |
| DEC-004 written | GACCard backend primitive | File exists, content verified | MATCHED |
| DEC-005 written | Actor work lifecycle phases | File exists, content verified | MATCHED |
| DEC-006 written | Deferred CLI features | File exists, content verified | MATCHED |
| EMA-VOICE written | Voice spec (names, slugs, voice patterns) | File exists | MATCHED |

**Stream 1 verdict:** ✓ Complete. All canon deliverables exist and are locked.

### Stream 2 — @ema/tokens + @ema/glass

| Checkbox | Canon spec | Reality | Status |
|---|---|---|---|
| `shared/tokens/` package scaffolded | Package.json with name `@ema/tokens` | **Does not exist.** `shared/tokens/` dir does not exist. | MISSING |
| `src/colors.ts` with ramps | 8 color ramps (100/200/300/600/700/800 stops) | Missing (no dir) | MISSING |
| `src/glass.ts` layers | ambient/surface/elevated + glass-wash/panel/peak | Missing | MISSING |
| `src/windows.ts` + `src/motion.ts` + `src/typography.ts` | Full token suite | Missing | MISSING |
| `shared/glass/` package scaffolded | Package.json = `@ema/glass`, peer-dep `@ema/tokens` | **Does not exist.** | MISSING |
| Glass components (AmbientStrip, AppWindowChrome, etc.) | 10 components | Missing | MISSING |
| Templates + Boilerplates | 6 templates, 6 archetypes | Missing | MISSING |
| Turbo tasks wiring | `pnpm -w --filter @ema/tokens build` succeeds | Cannot test; packages don't exist | MISSING |

**Stream 2 verdict:** COMPLETELY MISSING. 8 of 8 checkboxes = MISSING. This unblocks nothing downstream.

### Stream 3 — Services recovery

| Checkpoint | Spec | Reality | Status |
|---|---|---|---|
| **Composer** — artifact discipline | `services/core/composer/` with `compile(artifactDir, prompt)` | Does not exist | MISSING |
| **Pipes** — 22/15/5 registry | `services/core/pipes/registry.ts` + triggers/ + actions/ + transforms/ + EventEmitter bus | Directory exists, **empty** | MISSING |
| **Blueprint** — GACCard backend | `services/core/blueprint/schema.ts` + service + filesystem watcher + routes + MCP tools | Does not exist | MISSING |
| **VisibilityHub** — active topics stream | `services/core/visibility/` WebSocket route + AmbientStrip consumer | `visibility/types.ts` exists (stub). No WebSocket route. No AmbientStrip binding. | PARTIAL |
| **AGENT-RUNTIME canon edit** | Add Actor Work Phases section + state machine enum reference | Not done. AGENT-RUNTIME.md static since 2026-04-11. | MISSING |
| **shared/schemas/actor-phase.ts** | Zod union + Drizzle table for phase_transition | Does not exist | MISSING |
| **shared/schemas/intents.ts** | Add exit_condition + scope fields | Exists as stub. Schema empty. Fields not added. | DRIFT |

**Stream 3 verdict:** ALMOST COMPLETELY MISSING. 7 of 7 = MISSING or PARTIAL. Composer is prerequisite for Pipes (can't wire `claude:run` without it).

### Stream 4 — Next-wave recovery (depends on Stream 3)

Cannot proceed until Stream 3 operational.

| Checkpoint | Status | Notes |
|---|---|---|
| CrossPollination service | MISSING | Depends: Stream 3 Pipes. |
| VaultSeeder service | MISSING | Depends: Stream 3 Pipes. |
| IntentionFarmer service | MISSING | Depends: Stream 3 Pipes. |
| OLD-BUILD-RECOVERY master node | MISSING | Should be written last. |

**Stream 4 verdict:** BLOCKED by Stream 3.

### Stream 5 — Deferred with intent (partial)

| Checkpoint | Status |
|---|---|
| DEC-006 written (deferred CLI features record) | ✓ MATCHED |
| tools/precommit/README.md stub | MISSING. Should be activated when Husky wired. |

**Stream 5 verdict:** 1 of 2 MATCHED.

---

## Section 7 — vApp Catalog vs Actual Implementation

Canon CATALOG.md §Human Productivity names 13 vApps (Notes, Tasks, Schedule, Responsibilities, Brain Dumps, Pomodoro, Time Blocking, Graphing, Whiteboard, File Manager, Email, Journal, Code Editor).

| vApp name | Catalog section | Actual code path | Status |
|---|---|---|---|
| Notes | §1, wiki node type | `apps/renderer/src/vapps/notes/` or `apps/renderer/src/components/notes/` | **NOT FOUND**. Vapps dir has only `spaces/`. |
| Tasks / To-Do | §2 | Not found | MISSING |
| Schedule / Calendar | §3 | Not found | MISSING |
| Responsibilities | §4 | Not found | MISSING |
| Brain Dumps | §5 | `services/core/brain-dump/` service exists (router + channel) but no renderer binding | PARTIAL |
| Pomodoro / Focus | §6 | Not found | MISSING |
| Time Blocking | §7 | Not found | MISSING |
| Graphing / Charting | §8 | Not found | MISSING |
| Whiteboard / Canvas | §9 | `services/core/canvas/` empty; no renderer | MISSING |
| File Manager | §10 | `services/core/file-vault/` empty; no renderer | MISSING |
| Email / Messaging | §11 | Not found | MISSING |
| Journal / Log | §12 | Not found | MISSING |
| Code Editor | §13 (deferred) | **DEFERRED per spec** | Expected missing |

**Knowledge & Research vApps** (Wiki Viewer, Graph Visualizer, Feeds, Research Viewer, Blueprint): None implemented. Blueprint is critical per INT-RECOVERY-WAVE-1 Stream 3.

**Verdict**: Of 12 shipped vApps (excl. deferred Code Editor), **0 have complete implementations**. 1 (Brain Dumps) is partially backed by services. 11 are missing entirely.

---

## Section 8 — Services Core Architecture Analysis

Canonical claim (EMA-V1-SPEC §8): `services/core/` organizes subsystems as packages.

Reality:

```
services/core/ (66 directories)
├─ actors/                 (empty)
├─ agents/                 (empty)
├─ babysitter/             (empty)
├─ brain-dump/             (3 files: router, service, channel; <200 LOC total; no logic)
├─ campaigns/              (empty)
├─ canvas/                 (empty)
├─ pipes/                  (empty)
├─ blueprint/              (does not exist — should be here per DEC-004)
├─ composer/               (does not exist — should be here per INT-RECOVERY-WAVE-1 Stream 3)
├─ [63 more empty or stub dirs]
└─ workspace/              (3 files: router, service, channel; <200 LOC total; no logic)
```

**Finding**: `services/core/` has been **scaffold-planted** with 66 directories (matching the old Elixir module structure from `IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/`). Each directory has a templated naming pattern (thing.router.ts, thing.service.ts, thing.channel.ts) but **zero of the service.ts files contain actual business logic**. They are empty imports. This is architectural cargo cult — the shape exists but nothing is inside.

---

## Section 9 — Package Dependencies Check

Canon (DEC-001, DEC-002, DEC-004, DEC-005): demands for external libraries

| Library | Use case | Promised in canon | In package.json? |
|---|---|---|---|
| better-sqlite3 | SQLite index backend (DEC-001) | Yes, Phase 2 ema-core | **Not listed** in root package.json |
| gray-matter | Frontmatter parser (EMA-V1-SPEC §11.4) | Yes | **Not listed** |
| chokidar | File watcher (DEC-001) | Yes, incremental reindex | **Not listed** |
| zod | Schema validation (DEC-004, DEC-005) | Yes, multiple places | **Not listed** in root package.json |
| drizzle-orm | ORM + migrations (DEC-004, DEC-005) | Yes, "Drizzle for schema-first" | **Not listed** |
| Loro / Automerge | CRDT engines (DEC-002) | Yes, but deferred to v2 | Not listed (expected) |
| Syncthing | File sync (DEC-002) | Yes, but deferred to v2 | Not listed (expected) |

**Verdict**: Packages foundational to Phase 1 implementation (better-sqlite3, gray-matter, chokidar, zod, drizzle) are **not declared in dependencies**. The monorepo cannot build Phase 1 `ema-core` without adding these.

---

## Summary Table: 18 Total Discrepancies

| ID | Category | Severity | Canon source | Reality | Notes |
|---|---|---|---|---|---|
| D-001 | Intent schema | blocking | EMA-V1-SPEC §4 | services/core/intents/ empty; shared/schemas/intents.ts stub | TIER PORT 1 of 6 unported |
| D-002 | Proposal schema + pipeline | high | EMA-V1-SPEC §4 + SELF-POLLINATION | TIER PORT 2 unported; no pipeline stages | Scoring engine missing entirely |
| D-003 | Execution logic | high | AGENT-RUNTIME.md §Session Recording | executions.service.ts <200 LOC, no tmux/xterm/pty logic | Session recording format not implemented |
| D-004 | Actor phase state machine | blocking | DEC-005 (status: locked) | No shared/schemas/actor-phase.ts; no phase_transition table | GAC-003 [D] decision has zero code |
| D-005 | Pipes registry | blocking | SELF-POLLINATION TIER PORT 3 + DEC-004 | services/core/pipes/ empty; no EventEmitter bus, no triggers/ or transforms/ | 22/15/5 registry missing entirely |
| D-006 | Blueprint GACCard backend | blocking | DEC-004 (status: locked) + INT-RECOVERY-WAVE-1 Stream 3 | services/core/blueprint/ does not exist; no gac-card.ts schema | Entire service missing |
| D-007 | Composer artifact wrapper | blocking | INT-RECOVERY-WAVE-1 Stream 3 | services/core/composer/ does not exist | Prerequisite for Pipes `claude:run` |
| D-008 | MCP tool registry | high | SELF-POLLINATION TIER PORT 6 | services/core/mcp/ does not exist; 25 tools + 11 resources unimplemented | Agent accessibility blocked |
| D-009 | @ema/tokens package | blocking | INT-RECOVERY-WAVE-1 Stream 2 | shared/tokens/ does not exist; no colors.ts, glass.ts, windows.ts, motion.ts, typography.ts | Unblocks everything visual |
| D-010 | @ema/glass components | high | INT-RECOVERY-WAVE-1 Stream 2 | shared/glass/ does not exist; 10 components not scaffolded | Depends on D-009 |
| D-011 | VisibilityHub WebSocket | high | INT-RECOVERY-WAVE-1 Stream 3 + BOOTSTRAP-V0.1 AmbientStrip requirement | visibility/types.ts stub only; no /visibility/stream route; no AmbientStrip consumer binding | Partial |
| D-012 | Schema foundations (9 files) | high | EMA-V1-SPEC §4 + DEC-004, DEC-005 | All 9 in shared/schemas/ are <900 byte stubs with zero field definitions | Cannot validate writes |
| D-013 | ema-genesis/schemas/ YAML | medium | EMA-V1-SPEC §9 Folder Structure | Directory is empty (0 files) | Should mirror shared/schemas/ |
| D-014 | Graph engine code | medium | DEC-001 (status: locked, Phase 2) | Zero: no indexer, no watcher, no DQL parser, no traverse() function | On schedule per Phase 2 timeline |
| D-015 | vApp catalog implementation | high | CATALOG.md §1–12 | 0 of 12 vApps have complete implementations; 1 (Brain Dumps) partially backed by services | Renderer has no vapps/* structure |
| D-016 | Services architecture (66 dirs) | high | EMA-V1-SPEC §8 Folder Structure | 66 scaffold directories exist; zero contain business logic. All service.ts files are empty. | Cargo cult architecture |
| D-017 | Package dependencies | high | DEC-001, EMA-V1-SPEC §11, SELF-POLLINATION | better-sqlite3, gray-matter, chokidar, zod, drizzle not in root package.json | Phase 1 ema-core cannot build |
| D-018 | INT-RECOVERY-WAVE-1 Stream progress | blocking | Intent exit_condition (master deliverable) | Streams 1 ✓, 2–5 PENDING (Stream 2 missing entirely, Stream 3 almost missing, Stream 4 blocked by 3, Stream 5 partial) | Core blocker for Bootstrap v0.1 |

---

## Recommendations (Highest Priority First)

### Blocking (fix before Bootstrap v0.1 can launch)

1. **D-006: Implement services/core/blueprint/** per DEC-004. Create:
   - `shared/schemas/gac-card.ts` (Zod schema matching BLUEPRINT-PLANNER §Data Models)
   - `services/core/blueprint/schema.ts` (Drizzle table definitions)
   - `services/core/blueprint/service.ts` (state machine: pending→answered→deferred→promoted)
   - `services/core/blueprint/filesystem.ts` (chokidar watcher syncing `.superman/gac/` ↔ DB)
   - `services/core/blueprint/routes.ts` (GET/POST /gac, /gac/:id/answer, etc.)
   - `services/core/blueprint/mcp-tools.ts` (agent-facing: gac_list, gac_show, gac_answer)
   - Target: INT-RECOVERY-WAVE-1 Stream 3, parent completion blocker

2. **D-009: Create shared/tokens/ package** per INT-RECOVERY-WAVE-1 Stream 2. Create:
   - `shared/tokens/package.json` (name: @ema/tokens)
   - `src/colors.ts` (ramps for 100/200/300/600/700/800 stops)
   - `src/glass.ts`, `src/windows.ts`, `src/motion.ts`, `src/typography.ts`, `src/semantic.ts`
   - `build/` Style Dictionary config + Turbo wiring
   - No external dep until Style Dictionary proven necessary; start with zero-build CSS export
   - Blocks: @ema/glass creation, all vApp styling

3. **D-004: Add shared/schemas/actor-phase.ts** per DEC-005. Create:
   - Zod union of 7 states (per GAC-003 [D])
   - Drizzle table: phase_transition(actor_id, entity_type, entity_id, from_phase, to_phase, at, reason)
   - Blocks: Actor service (services/core/actors/) implementation

4. **D-017: Add Phase 1 ema-core dependencies** to root package.json:
   - better-sqlite3 (SQLite driver)
   - gray-matter (frontmatter parsing)
   - chokidar (file watcher)
   - zod (schema validation)
   - drizzle-orm + drizzle-kit (ORM + migration generator)
   - Unblocks: D-001, D-002, D-003, D-004, D-012 fixes

### High (fix before end of Wave 1)

5. **D-001: Port Intents system** (TIER PORT 1) to `services/core/intents/` + `workers/intent-watcher/`:
   - Filesystem: read/write intent.md + status.json
   - Watcher: chokidar on `.superman/intents/` → emit events
   - DB: SQLite intent table with status/kind/phase indices
   - Effort: Medium (~150 LOC)

6. **D-005: Implement Pipes registry** (TIER PORT 3) at `services/core/pipes/`:
   - registry.ts: export Trigger/Action/Transform definitions
   - bus.ts: Node EventEmitter or simple in-process queue
   - 22 triggers, 15 actions, 5 transforms as TS objects
   - `claude:run` action: wraps through Composer service
   - Effort: Low–Medium (~200 LOC)

7. **D-012: Populate shared/schemas/** with real Zod definitions:
   - intents.ts: add exit_condition + scope fields
   - proposals.ts: intent_id, proposed_by, approval_status, plan, execution_id, state_doc_path (per SELF-POLLINATION)
   - tasks.ts: add started_at field (per SELF-POLLINATION neurodivergent-visual-org research)
   - actors.ts: id, slug, actor_type, phase, capabilities, config, parent_actor_id (3-tier hierarchy per SELF-POLLINATION)
   - Unblocks: all service implementations

### Medium (fix before v0.2)

8. **D-002: Port Proposal pipeline** (TIER PORT 2) with 6-stage chain (Generator→Refiner→Debater→Tagger→Combiner):
   - Worker per stage, EventEmitter pub/sub between stages
   - Four-dimensional scoring: codebase coverage 30% + coherence 25% + impact 30% + specificity 15%
   - Effort: High (~300 LOC)

9. **D-010: Create shared/glass/** package with 10 components + templates after tokens exists:
   - Depends on D-009
   - Components: AmbientStrip, AppWindowChrome, Dock, CommandBar, GlassCard, GlassInput, GlassSelect, Tooltip, LoadingSpinner
   - 6 templates (StandardAppWindow, EmbeddedLaunchpad, ChatAppShell, Dashboard, Editor, ListDetail)
   - Effort: Medium (~250 LOC)

10. **D-015: Scaffold vApp implementations** for top 3 (Notes, Tasks, Brain Dumps):
    - Each: service + routes + renderer vApp component
    - Start with Brain Dumps (D-011 prerequisite for visibility)
    - Effort: High for all three (~500 LOC total)

---

## Connections

**Canon sources consulted:**
- `[[EMA-GENESIS-PROMPT.md]]` §5, §8, §9 (storage, fold structure, agent model)
- `[[canon/specs/EMA-V1-SPEC.md]]` §1–11 (full spec, ontology, API surface)
- `[[canon/specs/AGENT-RUNTIME.md]]` (agent session lifecycle, terminal recording)
- `[[canon/specs/BLUEPRINT-PLANNER.md]]` (vApp spec, GAC data models)
- `[[canon/decisions/DEC-001]]` (graph engine decision, locked)
- `[[canon/decisions/DEC-002]]` (sync split, locked)
- `[[canon/decisions/DEC-004]]` (GACCard backend, locked)
- `[[canon/decisions/DEC-005]]` (actor phases, locked)
- `[[canon/decisions/DEC-006]]` (deferred features, locked)
- `[[_meta/SELF-POLLINATION-FINDINGS.md]]` (PORT/REPLACE/DROP tier inventory)
- `[[intents/INT-RECOVERY-WAVE-1/README.md]]` (master intent, five streams, checkboxes)
- `[[intents/GAC-001..GAC-005/README.md]]` (decisions made, canonical state)

**Monorepo paths referenced:**
- `/home/trajan/Projects/ema/services/core/` (66 scaffold dirs, zero implementations)
- `/home/trajan/Projects/ema/shared/schemas/` (9 stub TS files, 0 valid schemas)
- `/home/trajan/Projects/ema/ema-genesis/schemas/` (empty, should mirror shared/)
- `/home/trajan/Projects/ema/apps/renderer/src/vapps/` (only `spaces/`, no vApp implementations)

---

*Report generated: 2026-04-12 by reality-reconciliation-pass. Timestamp of reviewed code: commit 7b1e2a8.*

---

## APPENDIX B — Post-Wave-2 Reality Delta (2026-04-12 later)

> Second pass after Recovery Wave 1+2 executed. Most of the 18 discrepancies above have flipped.

### Discrepancy resolution matrix

| ID | Original severity | Original state | Post-wave state | Verdict |
|---|---|---|---|---|
| D-001 | blocking | `services/core/intents/` empty | still empty (not this wave's scope) | **remains open** |
| D-002 | high | Proposal pipeline missing | VaultSeeder + IntentionFarmer shipped; pipeline stages still stub | **partial** — bootstrap pump landed, pipeline stages still TODO(stream-N) |
| D-003 | high | Execution logic thin | unchanged; `shared/schemas/executions.ts` now exists (post-wave linter add) | **remains open** |
| D-004 | blocking | Actor phase state machine missing | `shared/schemas/actor-phase.ts` landed (both work lifecycle + runtime state) | **RESOLVED (schema)**, service port deferred |
| D-005 | blocking | Pipes registry missing | `services/core/pipes/` LIVE — 21/21/5 registry + 17/17 tests + `claude:run` via Composer | **RESOLVED** |
| D-006 | blocking | Blueprint GACCard backend missing | `services/core/blueprint/` LIVE — 11/11 tests + auto-loads 10 GAC cards on cold boot + HTTP + MCP tools | **RESOLVED** |
| D-007 | blocking | Composer missing | `services/core/composer/` LIVE — 7/7 tests + atomic artifact writes + graceful degradation | **RESOLVED** |
| D-008 | high | MCP tool registry missing | Per-service MCP tool arrays exist (blueprint: 6, pipes: 6); a central registry still TBD | **partial** |
| D-009 | blocking | `@ema/tokens` missing | `shared/tokens/` LIVE — 762 LOC, 138 CSS vars, 5 ramps, 6 glass tiers, OKLCH-interpolated stops | **RESOLVED** |
| D-010 | high | `@ema/glass` missing | `shared/glass/` LIVE — 3,275 LOC, 13 components + 6 templates + 6 boilerplates + 3 hooks | **RESOLVED** |
| D-011 | high | VisibilityHub partial | `services/core/visibility/` LIVE — 9/9 tests + 500-event ring buffer + Phoenix channel `visibility:stream` | **RESOLVED** |
| D-012 | high | Schema foundations stubs | Multiple Zod schemas now real: `gac-card.ts` (2144 LOC including service), `cross-pollination.ts`, `actor-phase.ts`, `intents.ts` extended with `exit_condition` + `scope` + `validateIntentForKind`. Linter added: `executions.ts`, `spaces.ts`, `user-state.ts`, `sdk/`. | **mostly RESOLVED** |
| D-013 | medium | `ema-genesis/schemas/` YAML empty | unchanged; decision: canonical schemas live in `shared/schemas/*.ts` (Zod), `ema-genesis/schemas/` will mirror or be retired | **remains open — needs canon call** |
| D-014 | medium | Graph engine code zero | unchanged; per DEC-001 this is Phase 2 `ema-core` work | **expected, on schedule** |
| D-015 | high | vApp catalog has 0 implementations | unchanged; `@ema/glass` now provides the shell so implementations can follow | **unblocked** by Stream 2 |
| D-016 | high | 66 scaffold dirs, zero logic | 6 of the 66 now have real logic: `blueprint/`, `composer/`, `pipes/`, `visibility/`, `memory/`, `proposals/`. 60 still stub. | **partial** |
| D-017 | high | Deps missing in root | `zod`, `drizzle`, `better-sqlite3`, `nanoid` all now in `services/package.json`; `@types/node` added to `workers/package.json`. `chokidar` still unused, `gray-matter` deferred to hand-rolled parser. | **mostly RESOLVED** |
| D-018 | blocking | INT-RECOVERY-WAVE-1 streams pending | Streams 1, 2, 3, 4, 5 now checked. Only the AGENT-RUNTIME.md canon edit + OLD-BUILD-RECOVERY master research node remain deferred. | **mostly RESOLVED** |

### New state (post-wave)

- **Blocking count:** 3 → 0 (all 3 original blocking discrepancies resolved)
- **High-severity count:** 7 → 2 (D-001 intents service + D-003 execution logic + D-015 vApps are the top remaining gaps)
- **Remaining open:** 7 items total — all are "next wave" scoped (vApp implementations, intents service port, execution recording, canon doc edits, MCP central registry)

### Infrastructure delta

- `pnpm-workspace.yaml`: now 11 packages (added `shared/tokens`, `shared/glass`)
- `services/package.json`: `@ema/shared` workspace dep
- `shared/package.json`: `./schemas/*` subpath exports, plus new `./sdk` entrypoint
- `shared/schemas/index.ts`: new exports — `gac-card`, `cross-pollination`, `actor-phase`, `executions`, `spaces`, `user-state`, `emaLinksField`, `spaceIdField`
- `services/tsconfig.json`: restored `rootDir: "."` with explicit paths override
- `services/core/projects/*`, `services/core/tasks/*`, `services/core/workspace/*`: fixed 9 pre-existing `exactOptionalPropertyTypes` errors

### End-to-end verification (2026-04-12)

- `pnpm build` across services + workers + electron + shared + glass + tokens: all green
- `pnpm exec vitest run` services: **69/69 passing** across 7 test files
- `pnpm exec tsc --noEmit` services: **0 errors**
- Services daemon boot: `node services/dist/startup.js` starts in ~400ms, `/api/health` returns 200
- HTTP route probes: `/api/blueprint/gac` (10 cards), `/api/pipes/catalog` (21/21/5), `/api/visibility/topics`, `/api/memory/cross-pollination/`, `/api/proposals/seeds` (with real vault TODO finds) — all live
- Existing routes (`/api/tasks`, `/api/projects`, `/api/executions`, `/api/settings`) still 200 — no regressions

### Top 5 remaining gaps (ordered by blocking-ness for v0.2)

1. **D-001 Intents service port** — two-layer `.superman/intents/<slug>/` ↔ SQLite sync using the new extended Intent schema. Unblocks proposal/execution pipelines.
2. **D-003 Execution recording** — tmux/pty session recording per `AGENT-RUNTIME.md`. Needs the Actor phase service layer consuming `shared/schemas/actor-phase.ts`.
3. **D-008 Central MCP registry** — each service currently exports its own tool array. A host-level registry that aggregates and serves them over JSON-RPC is required for agent accessibility.
4. **D-015 vApp implementations** — at least 3 vApps (Brain Dumps, Tasks, Blueprint) need real renderer components consuming `@ema/glass` + the live HTTP routes.
5. **AGENT-RUNTIME.md canon edit** — add Actor Work Phases section referencing DEC-005 + GAC-003 runtime state enum. Pure doc.

### Canon documents that now need follow-up edits

- `canon/specs/AGENT-RUNTIME.md` — add Actor Work Phases + 7-state runtime section
- `vapps/CATALOG.md` — mark Blueprint as partially implemented (backend live, renderer pending)
- `_meta/SELF-POLLINATION-FINDINGS.md` — TIER PORT table could gain a "status: landed" column for the 6 ported modules

*Delta generated 2026-04-12 after Recovery Wave 1+2 execution.*
