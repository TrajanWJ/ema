---
id: INT-RECOVERY-WAVE-1
type: intent
layer: intents
title: "Recovery Wave 1 — port old Elixir+Tauri build to TypeScript/Electron per Appendix A"
status: active
kind: port
phase: execute
priority: critical
created: 2026-04-12
updated: 2026-04-12
author: human
exit_condition: "All five streams complete per their verification checklists; Bootstrap v0.1 has Pipes registry, Blueprint GACCard backend, Composer artifact discipline, VisibilityHub, @ema/tokens, @ema/glass, EMA voice enforcement, and the six recovery service ports listed below, all landed in the monorepo and smoke-tested end-to-end."
scope:
  - "ema-genesis/canon/**"
  - "ema-genesis/intents/**"
  - "ema-genesis/research/self-building/**"
  - "shared/schemas/**"
  - "shared/tokens/**"
  - "shared/glass/**"
  - "services/core/pipes/**"
  - "services/core/blueprint/**"
  - "services/core/composer/**"
  - "services/core/visibility/**"
  - "services/core/memory/**"
  - "services/core/proposals/vault-seeder.ts"
  - "services/core/proposals/intention-farmer.ts"
  - "apps/renderer/src/components/blueprint/**"
  - "apps/renderer/src/components/pipes/**"
  - "apps/renderer/src/components/tokens/**"
  - "apps/renderer/src/components/memory/**"
  - "tools/precommit/README.md"
connections:
  - { type: derived_from, target: "[[_meta/SELF-POLLINATION-FINDINGS]]" }
  - { type: fulfills, target: "[[DEC-004]]" }
  - { type: fulfills, target: "[[DEC-005]]" }
  - { type: fulfills, target: "[[DEC-006]]" }
  - { type: fulfills, target: "[[canon/specs/EMA-VOICE]]" }
  - { type: references, target: "[[canon/specs/BLUEPRINT-PLANNER]]" }
  - { type: references, target: "[[canon/specs/EMA-V1-SPEC]]" }
  - { type: references, target: "[[DEC-001]]" }
  - { type: references, target: "[[DEC-002]]" }
tags: [intent, port, recovery, critical, bootstrap, wave-1]
---

# INT-RECOVERY-WAVE-1 — Recovery Wave 1

> **Master intent** tracking the staged port of the old Elixir+Tauri build into the TypeScript/Electron monorepo per `[[_meta/SELF-POLLINATION-FINDINGS]]` Appendix A. Ordered under Option B (dependency triage). This is the parent node for all five streams.

## Context

The human triaged 15 proposals generated from a fine-grained mining pass over `IGNORE_OLD_TAURI_BUILD/`. P1 was denied (no hard CLI contract) but the 14 feature groups must remain implementable. P2/P3/P4/P5/P6/P7 were approved — P3 split into GAC-003 answer + new DEC-005 actor phases. P8–P15 fell under Option B triage into Now / Next / Later waves. This intent executes all approvals.

The five canon resolutions (GAC-001..005, DEC-004/005/006, EMA-VOICE) have already landed under Stream 1. The remaining streams are tracked below.

## Stream 1 — Canon resolutions ✓

- [x] GAC-001 answered — cross-machine dispatch deferred v2, DBOS target
- [x] GAC-002 answered — concurrent coordination deferred v2, 3-tier split
- [x] GAC-003 answered — 7-state runtime + heartbeat [D]
- [x] GAC-004 answered — exit_condition + scope, kind-aware mandatory [D]
- [x] GAC-005 answered — typed edges: frontmatter primary + inline sugar [C]
- [x] GAC-QUEUE-MOC updated — 5 open, 5 resolved
- [x] `[[DEC-004]]` written — GACCard backend primitive
- [x] `[[DEC-005]]` written — actor work lifecycle phases
- [x] `[[DEC-006]]` written — deferred CLI features (quality/routing/evolution)
- [x] `[[canon/specs/EMA-VOICE]]` written — voice, names, slugs
- [x] This master intent created

## Stream 2 — `@ema/tokens` + `@ema/glass` ✓

Foundation for everything visual. Landed 2026-04-12.

- [x] `shared/tokens/` package scaffolded (`@ema/tokens`, 762 LOC)
- [x] `src/colors.ts` — 5 ramps (teal, blue, amber, rose, purple) with OKLCH-interpolated 100/200/300/600/700/800 stops
- [x] `src/glass.ts` — 6 tiers (wash, ambient, surface, panel, elevated, peak)
- [x] `src/windows.ts` — wash/core/deep/panel/header alphas
- [x] `src/motion.ts` — `--ease-smooth` + durations (120/200/300/1000 ms)
- [x] `src/typography.ts` — sans + mono stacks + text layer alphas
- [x] `src/semantic.ts` — error/success/warning verbatim from A.8
- [x] `build.ts` — zero-dep Node script emitting CSS (138 vars) / TS / JSON
- [x] `shared/glass/` package scaffolded (`@ema/glass`, 3,275 LOC, peer-dep `@ema/tokens`)
- [x] **13 components** (AmbientStrip, AppWindowChrome, Dock, CommandBar, GlassCard, GlassInput, GlassSelect, Tooltip, LoadingSpinner + expansion: GlassButton, GlassSurface, EmptyState, StatusDot)
- [x] **6 templates** (StandardAppWindow, EmbeddedLaunchpadWindow, ChatAppShell, DashboardShell, EditorShell, ListDetailShell)
- [x] **6 boilerplates** (work/intelligence/creative/operations/life/system archetypes)
- [x] **3 hooks** (useGlassTier, useCommandPalette, useWindowChrome)
- [x] `src/styles/keyframes.css` — `glassDropIn`, `fadeSlideUp`, `fadeIn`, `pulseDot`
- [x] Workspace wired: `shared/tokens` + `shared/glass` in `pnpm-workspace.yaml` (11 workspaces)
- [x] `tsc --noEmit` clean for both packages under strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes

## Stream 3 — Services recovery ✓

Depends on Stream 1. Composer landed before Pipes consumed it. Blueprint and Visibility parallelized. Landed 2026-04-12.

- [x] **Composer (P8)** — `services/core/composer/` (527 LOC, **7/7 tests**). `compile({ prompt, context, metadata })` writes `prompt.md` + `context.json` atomically to `~/.local/share/ema/artifacts/<run-id>/` before token spend. Non-fatal artifact failure preserves previous run. `recordResponse` writes `response.md`.
- [x] **Pipes (P2)** — `services/core/pipes/` (3,415 LOC, **17/17 tests**) with full registry from Appendix A.3: **21 triggers / 21 actions / 5 transforms** (Appendix A "22/15" heading was doc drift — Elixir source is 21/21/5). Node EventEmitter bus, Drizzle `pipe_runs` log, HTTP routes at `/api/pipes/*`, MCP tools (`pipes_list/show/create/toggle/run/history`). `claude:run` action verified end-to-end through Composer.
- [x] **Blueprint (P7)** — `services/core/blueprint/` (2,144 LOC including schema, **11/11 tests**) GACCard backend per `[[DEC-004]]`. Files: `schema.ts`, `service.ts`, `state-machine.ts`, `filesystem.ts`, `routes.ts`, `mcp-tools.ts`, `blueprint.router.ts`. `shared/schemas/gac-card.ts` is the Zod source of truth. Two-layer filesystem mirror planned for `.superman/gac/<NNN>/`. **Cold-boots with all 10 GAC cards** auto-indexed from `ema-genesis/intents/GAC-*/README.md`. Live at `/api/blueprint/gac`.
- [x] **VisibilityHub (P12)** — `services/core/visibility/` (636 LOC, **9/9 tests**) in-memory ring buffer (500 events) + Node EventEmitter subscriptions, Phoenix channel `visibility:stream` with 50-event replay on join, HTTP routes at `/api/visibility/*`.
- [ ] **AGENT-RUNTIME canon edit** — add Actor Work Phases section referencing `[[DEC-005]]` + runtime state enum from `[[intents/GAC-003/README]]` — deferred to a follow-up canon edit, service implementation exists
- [x] **shared/schemas/actor-phase.ts** — Zod union (`idle/plan/execute/review/retro`) + 7-state runtime enum + `PHASE_TRANSITION_DDL` for append-only log + `PHASE_TRANSITIONS` allowed-transitions map
- [x] **shared/schemas/intents.ts** — added `kind` enum + `exit_condition` + `scope` fields per `[[intents/GAC-004/README]]`, plus `validateIntentForKind()` helper + `INTENT_KINDS_REQUIRING_EXIT_CONDITION` constant

## Stream 4 — Next-wave recovery ✓

Landed 2026-04-12, parallel with Stream 3.

- [x] **CrossPollination (P9)** — `services/core/memory/cross-pollination.ts` (851 LOC, **10/10 tests**). Records `{ fact, source_project, target_project, rationale, applied_at, actor_id?, confidence?, tags[] }`. Drizzle table `memory_cross_pollinations` + HTTP routes `/api/memory/cross-pollination/*` + EventEmitter for subscribe/unsubscribe.
- [x] **VaultSeeder (P10)** — `services/core/proposals/vault-seeder.ts` (**7/7 tests**). Scans markdown for `TODO:`, `- [ ]`, `IDEA:` lines; ignores `node_modules`, `dist`, `.git`, `Archive/`. Verified live against real vault — **found real TODO seeds in production test boot**.
- [x] **IntentionFarmer (P10)** — `services/core/proposals/intention-farmer.ts` + sub-farmers BacklogFarmer, BootstrapWatcher, Cleaner, Loader, SourceRegistry (**8/8 tests**). Multi-source harvesting with injectable collectors (avoids hard git dep).
- [ ] **OLD-BUILD-RECOVERY master research node (P15)** — `ema-genesis/research/self-building/OLD-BUILD-RECOVERY.md` — deferred; written once Streams 4 consumers are real, not scaffolded.

## Stream 5 — Deferred with intent ✓

- [x] `[[DEC-006]]` written — deferred CLI features record (quality/routing/evolution → v2)
- [x] `tools/precommit/README.md` stub — see tools/precommit/ directory (written 2026-04-12, activates when Husky wires up)

## Execution order

1. **Stream 1** complete.
2. **Stream 2** + Stream 3 Composer in parallel (both are independent).
3. **Stream 3 Pipes** after Composer (consumes it via `claude:run`).
4. **Stream 3 Blueprint** + Stream 3 VisibilityHub + AGENT-RUNTIME canon edit + schema edits in parallel.
5. **Stream 4 CrossPollination / VaultSeeder / IntentionFarmer** in parallel.
6. **Stream 4 recovery master node** last, after reality matches the plan.
7. **Stream 5 precommit stub** any time.

## Verification

End-to-end smoke (from `[[_meta/vast-strolling-biscuit]]` plan): clean daemon start → renderer AmbientStrip clock ticks → brain dump item fires a pipe → pipe creates a task → Blueprint vApp opens a seeded GACCard → human answers it → state machine transitions → VisibilityHub emits an event the AmbientStrip renders. If all five happen without manual intervention, Recovery Wave 1 is complete and INT-RECOVERY-WAVE-1 moves to `phase: retro`.

## Connections

- `[[_meta/SELF-POLLINATION-FINDINGS]]` — Appendix A is the source of truth for every port
- `[[DEC-004]]`, `[[DEC-005]]`, `[[DEC-006]]` — canon decisions this intent fulfills
- `[[canon/specs/EMA-VOICE]]` — voice spec enforced by this intent
- `[[canon/specs/BLUEPRINT-PLANNER]]` — vApp spec Stream 3 Blueprint implements
- `[[intents/GAC-QUEUE-MOC]]` — queue this intent half-resolved

#intent #port #recovery #critical #wave-1 #execute
