---
id: EXE-003
type: execution
layer: executions
title: "Recovery Wave full — port old Elixir+Tauri to TS/Electron + intent seam closed"
status: completed
phase: retro
started_at: 2026-04-12
completed_at: 2026-04-12
executor: claude-opus-4-6-1m
intent_slug: INT-RECOVERY-WAVE-1
renumbered_from: EXE-001
renumbered_reason: "Collision with EXE-001-gac-schema-stubs from an earlier parallel session. EXE-002-canon-id-collisions fixed the DEC numbering; this record moved to EXE-003 to avoid the EXE-001 collision and because GAC-QUEUE-MOC already referenced 'EXE-003' as the intent-seam closure slot."
connections:
  - { type: fulfills, target: "[[intents/INT-RECOVERY-WAVE-1/README]]" }
  - { type: references, target: "[[_meta/SELF-POLLINATION-FINDINGS]]" }
  - { type: references, target: "[[_meta/BLUEPRINT-REALITY-DISCREPANCIES]]" }
  - { type: references, target: "[[executions/EXE-001-gac-schema-stubs/README]]" }
  - { type: references, target: "[[executions/EXE-002-canon-id-collisions/README]]" }
  - { type: produces, target: "[[DEC-004]]" }
  - { type: produces, target: "[[DEC-005]]" }
  - { type: produces, target: "[[DEC-006]]" }
  - { type: produces, target: "[[canon/specs/EMA-VOICE]]" }
tags: [execution, recovery, port, wave-1, wave-2, wave-3, intent-seam, completed, retro]
---

# EXE-003 — Recovery Wave full execution record

> Single-session port of the old Elixir+Tauri build's distinctive patterns into the TypeScript/Electron monorepo. All five streams of INT-RECOVERY-WAVE-1 closed plus a Wave 3 extension covering 4 additional services.

## Outcome summary

- **~18,700 LOC** of new TypeScript/React code written
- **112 tests passing** across 11 test files (0 failures)
- **0 TypeScript errors** across all workspaces
- **15 live HTTP routes** auto-registered from 10 subservices
- **21 Zod schemas** in `shared/schemas/`
- **Services daemon boots** in ~400ms from a clean build, serves all routes
- **Electron main.ts compiles**, workers compile, renderer intact
- **5 of 10 GAC cards** resolved to canon decisions during the wave

## What got built

### Stream 1 — Canon resolutions (all markdown)

- `intents/GAC-001..005/README.md` — flipped to `status: answered` with Resolution sections
- `intents/GAC-007/README.md` — flipped to answered (flat MVP) by Wave 3
- `intents/GAC-010/README.md` — flipped to answered (mode + 7-signal heuristic) by Wave 3
- `intents/GAC-QUEUE-MOC.md` — updated (3 remaining: GAC-006, GAC-008, GAC-009)
- `canon/decisions/DEC-004-gac-card-backend.md` — GACCard as first-class primitive
- `canon/decisions/DEC-005-actor-phases.md` — `idle/plan/execute/review/retro` locked
- `canon/decisions/DEC-006-deferred-cli-features.md` — `quality/routing/evolution` → v2
- `canon/specs/EMA-VOICE.md` — voice register, names, semantic kebab slugs
- `intents/INT-RECOVERY-WAVE-1/README.md` — master intent tracking all streams
- `_meta/SELF-POLLINATION-FINDINGS.md` Appendix A — fine-grained recovery inventory (CLI verbs, pipes registry, vApp catalog, design tokens, voice)
- `_meta/BLUEPRINT-REALITY-DISCREPANCIES.md` — 18 discrepancies identified; Appendix B shows 3→0 blocking after the wave

### Stream 2 — `@ema/tokens` + `@ema/glass` packages

- `shared/tokens/` — 762 LOC, 138 CSS custom properties, 5 color ramps with OKLCH-interpolated 100-900 stops, 6 glass tiers, `--ease-smooth` motion system
- `shared/glass/` — 3,275 LOC, 13 React components + 6 templates + 6 vApp archetype boilerplates + 3 hooks, all consuming `@ema/tokens`, zero hex values outside `@ema/tokens`

### Stream 3 — Services recovery (Composer → Pipes → Blueprint → Visibility)

- `services/core/composer/` — 527 LOC, 7/7 tests, atomic artifact writes to `~/.local/share/ema/artifacts/<run-id>/`
- `services/core/pipes/` — 3,415 LOC, 17/17 tests, **21 triggers / 21 actions / 5 transforms** registry (Appendix A's "22/15" was doc drift — Elixir source is 21/21/5), `claude:run` action verified through Composer end-to-end
- `services/core/blueprint/` + `shared/schemas/gac-card.ts` — 2,144 LOC, 11/11 tests, GACCard entity with state machine, auto-loads all 10 GAC cards from canon on cold boot, HTTP at `/api/blueprint/gac`, 6 MCP tools
- `services/core/visibility/` — 636 LOC, 9/9 tests, in-memory ring buffer (500 events), Phoenix channel `visibility:stream` with 50-event replay

### Stream 4 — Next-wave (Memory + Proposals)

- `services/core/memory/cross-pollination.ts` + schema + routes + tests — 851 LOC, 10/10 tests, records facts transplanted between projects with rationale
- `services/core/proposals/vault-seeder.ts` — 7/7 tests, scans markdown for `TODO:`, `- [ ]`, `IDEA:`, **live-verified finding real TODOs** in production vault
- `services/core/proposals/intention-farmer.ts` + sub-farmers — 8/8 tests, multi-source intent harvesting (BacklogFarmer, BootstrapWatcher, Cleaner, Loader, SourceRegistry)

### Stream 5 — Deferred with intent

- `canon/decisions/DEC-006` — records that `quality/routing/evolution` feature groups are conceptually preserved but v2-deferred
- `tools/precommit/README.md` — stub for future Husky/lint-staged activation

### Wave 3 — 4 additional services (answered GAC-007 + GAC-010)

- `services/core/intents/` — 1,887 LOC, 13/13 tests. Two-layer filesystem + SQLite, kind-aware `validateIntentForKind` enforcement, append-only phase transition log per DEC-005. Cold-boots 13 INT-* files from canon.
- `services/core/executions/` — 1,324 LOC new/rewrite, 10/10 tests. Phase transition state machine + step_journal + reflexion injector (gets last N executions for intent context). Preserves all legacy routes. Real tmux/pty recording deferred to Phase 2 per AGENT-RUNTIME.md.
- `services/core/spaces/` — 1,356 LOC, 11/11 tests. **FLAT v1, answers GAC-007**. Idempotent `personal` default space bootstrap. `draft → active → archived` state machine, archive terminal.
- `services/core/user-state/` — 1,222 LOC, 9/9 tests. **Answers GAC-010**. Singleton state + 500-entry history ring buffer. 7-rule signal heuristic (`agent_blocked × 3 → crisis`, `self_report_overwhelm → crisis`, `self_report_flow → focused+clear`, `drift_detected → scattered`, `idle_timeout → resting`, `task_completed → focused`).

### Integration fixes (not in original plan)

- `pnpm-workspace.yaml` — added `shared/tokens` + `shared/glass` (11 workspace packages)
- `services/package.json` — added `@ema/shared` workspace dep
- `shared/package.json` — added `./schemas/*` subpath exports
- `shared/schemas/index.ts` — added re-exports for gac-card, cross-pollination, actor-phase, executions, spaces, user-state
- `services/tsconfig.json` — restored `rootDir: "."` + explicit `paths` override
- Fixed 9 pre-existing `exactOptionalPropertyTypes` errors in `core/projects`, `core/tasks`, `core/workspace`, `apps/electron/main.ts`, `workers/src/worker-manager.ts`
- Added `@types/node` to `@ema/workers` devDeps
- Stripped double `/pipes/pipes` and `/cross-pollination/cross-pollination` path prefixes

## Execution shape

Three waves of parallel agent dispatches over a single session:

1. **Wave 1** (5 parallel agents): tokens, composer, blueprint, visibility, reality-reconciliation-read-only
2. **Wave 2** (5 parallel agents): glass, pipes, cross-pollination, vault-seeder+intention-farmer, schema additions
3. **Wave 3** (4 parallel agents): intents, executions, spaces, user-state

Between waves the orchestrator (this agent) ran integration: workspace wiring, tsconfig, import path rewrites, error fixes, and end-to-end smoke tests.

## Key decisions made mid-execution

- **Appendix A "22 triggers / 15 actions" was doc drift** — the old Elixir `registry.ex` actually defined 21/21/5. The port ships the ground-truth count with a note.
- **`@ema/shared` as workspace dep with `./schemas/*` subpath exports + `@ema/shared/schemas` barrel import** — chosen over `composite`/`references` project setup. Simpler, no build-ordering headaches, runtime resolution via pnpm symlink.
- **GAC-007 answered FLAT by schema canon** — the shared schema's `spaces.ts` doc block explicitly forbade `parent_id` without a new GAC card. Wave 3 Spaces agent respected canon over prompt. Correct call.
- **GAC-010 answered with 7 explicit rules, not heuristic fuzziness** — makes the DistressDetector testable and tunable. Thresholds exported as constants.
- **Composer wraps `claude:run` through atomic artifact writes** — before any LLM token is spent, `prompt.md` + `context.json` hit disk. Non-fatal failure preserves the previous artifact. This is the ink-before-ink discipline from the old build.
- **P3 had a category error** in the original plan ("use actor phases as GAC-003 answer"). Caught mid-execution: GAC-003 is *runtime process state*, actor phases are *work lifecycle state*. They're orthogonal axes. Both landed — GAC-003 answered with 7-state runtime, DEC-005 created separately for the 5-phase work cycle.

## Verification evidence

All of these were run at execution end:

- `pnpm exec vitest run` (services): **112/112 passing**, 11 test files, 1.43s duration
- `pnpm exec tsc --noEmit` (services): **0 errors**
- `pnpm build` (services): green, emits `dist/startup.js` + all subservice routers
- `pnpm build` (workers): green, emits `dist/startup.js`
- `pnpm build` (apps/electron): green, emits `dist/main.js`
- `pnpm build` (shared): green
- `pnpm build` (shared/tokens): green, emits `dist/tokens.css`, `dist/tokens.json`, `dist/tokens.ts`
- Live boot: `node services/dist/startup.js` → 400ms startup, all 15 routes return 200, blueprint loads 10 GAC cards from canon, pipes catalog returns 21/21/5, intents loads 13 INT-* files from canon, spaces bootstraps `personal`, user-state returns `{mode:unknown, distress_flag:false}`

## Remaining open work

1. **GAC-006** — `@ema/core` SDK API surface (pending)
2. **GAC-008** — Identity layer / HALO-style (pending)
3. **GAC-009** — Workflow resumability primitive (pending)
4. **Central MCP tool registry** — each service exports its own tool array; host-level aggregator needed
5. **First real vApp implementation** — backend is real, renderer needs at least one `apps/renderer/src/vapps/*` consuming `@ema/glass` + live HTTP routes (Blueprint is the strongest candidate)
6. **`AGENT-RUNTIME.md` canon edit** — add Actor Work Phases + 7-state runtime section
7. **`OLD-BUILD-RECOVERY.md`** — retrospective research node linking Appendix A forward to the ported code
8. **`EMA-GENESIS-PROMPT.md` §9 + `SCHEMATIC-v0.md`** — soften nested-space language to reflect GAC-007 resolution
9. **`vapps/CATALOG.md`** — mark Blueprint backend as implemented, UserState vApp as planned

## Learnings to propagate

- **Parallel dispatch with disjoint file scopes works cleanly** — 5 agents writing 5 different directories simultaneously produced zero merge conflicts. The `*.router.ts` auto-loader convention made integration trivial.
- **tsc `rootDir` + external workspace imports** is the sharpest edge in a pnpm monorepo with TypeScript + Node16 module resolution. Use workspace deps + barrel imports, not relative paths crossing package boundaries.
- **`exactOptionalPropertyTypes: true` forces explicit `| undefined`** on every optional interface field. If you miss one, the fix is local and cheap. The discipline is worth keeping.
- **Fastify prefix plugin + inner routes** means inner routes should NOT include the prefix path themselves. Two agents independently made this double-prefix mistake; both had to be patched post-build.
- **Canon schema can forbid future fields via doc comment** (the `parent_id` rule in spaces.ts) and agents respected it. Canon-as-code works.
- **Agents parallelized report each other's WIP as "pre-existing errors"** during concurrent execution. Post-wave unified verification is required.
- **The Blueprint Planner vApp was always the pattern we were using manually** — this session's entire GAC resolution + schema + service shipment is that vApp operating itself through a human orchestrator. The backend just got the primitive for doing it without the human as the dispatcher.

#execution #recovery #completed #wave-1 #wave-2 #wave-3 #retro
