# EMA Implementation Roadmap

*Updated: 2026-04-03*

## Phase 1: Foundation (Complete)

### What's built and working
- 50+ frontend app components with glass morphism UI
- 60+ Zustand stores wired to REST + WebSocket
- 350+ REST API endpoints across 50+ controllers
- 34 WebSocket channels for real-time sync
- 66 database migrations, 80+ tables in SQLite
- Execution loop end-to-end: proposal → approval → Claude dispatch → result artifact
- Proposal pipeline: Scheduler → Generator → Refiner → Debater → Tagger → Combiner
- Agent system with DynamicSupervisor, per-agent workers, memory compression
- Pipes automation with 22 triggers, 15 actions, 7 stock pipes
- Second Brain vault watcher + wikilink graph builder
- Project context assembler (`GET /api/projects/:slug/context`)
- Shell.tsx loads 28 stores in parallel on startup
- Production build: 259KB gzip, zero TypeScript errors
- Tauri 2 desktop shell with daemon auto-start

### Phase 1 verification
- [x] `mix compile` — zero errors
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run build` — production bundle passes
- [x] 54/54 API endpoints returning 200
- [x] Execution loop proven (execution created → Claude ran → result.md written → status completed)
- [x] CRUD verified on new domains (contacts, finance, clipboard)

---

## Phase 2: Intelligence Layer (In Progress)

### 2.1 Workflow Observatory
**Status: Partial** — execution events are emitted but no dedicated observatory module.

| Deliverable | Status |
|---|---|
| Execution events (event sourcing) | ✅ Working |
| GapScanner (7 sources) | ✅ Working |
| TokenTracker with spike detection | ✅ Working |
| Genealogy edge tracking | ❌ Not started |
| Friction map heatmap | ❌ Not started |
| Budget awareness | ✅ Basic (CostAggregator) |

### 2.2 Proposal Intelligence
**Status: Mostly working** — pipeline runs, manual approval works, auto-approve not built.

| Deliverable | Status |
|---|---|
| 5-stage pipeline (Gen → Refine → Debate → Tag) | ✅ Working |
| KillMemory (killed proposal patterns) | ✅ Working |
| Combiner (cross-pollination) | ✅ Working |
| Cost estimator | ✅ Basic (CostAggregator) |
| Outcome linker (proposal → result) | ❌ Not started |
| Auto-approve rules | ❌ Not started |
| Feedback loop (outcome → seed strategy) | ❌ Not started |

### 2.3 Decision Memory
**Status: Schema only** — CRUD exists, no intelligence.

| Deliverable | Status |
|---|---|
| Decision schema + controller | ✅ Working |
| Decision mining from vault/Discord | ❌ Not started |
| Outcome linking | ❌ Not started |
| Precedent search (embedding-based) | ❌ Not started |

### 2.4 Intent-Driven Analysis
**Status: Partial** — IntentMap context exists, no Superman wiring.

| Deliverable | Status |
|---|---|
| IntentMap context + 5-level hierarchy | ✅ Working |
| Intent nodes CRUD + tree view | ✅ Working |
| Superman integration | ❌ Not started |
| Intent-to-code mapping | ❌ Not started |

---

## Phase 3: Autonomous Systems (Not Started)

These features have specs but no implementation. See individual feature docs for details.

| Feature | Spec | Depends On |
|---|---|---|
| Pattern Crystallizer | `docs/features/FEATURE_PATTERN_CRYSTALLIZER.md` | Workflow Observatory |
| Autonomous Reasoning | `docs/features/FEATURE_AUTONOMOUS_REASONING.md` | All Phase 2 features |

---

## Phase 4: Frontend Polish (Partial)

| Deliverable | Status |
|---|---|
| Glass morphism design system | ✅ Complete |
| 50+ app components | ✅ Built |
| Project context switching | ✅ Endpoint built, frontend wiring needed |
| Tauri multi-window | ✅ Launchpad + Orb windows |
| Tauri daemon auto-start | ⚠️ Race condition — needs debugging |
| Code splitting | ❌ Single 259KB bundle — acceptable for now |

---

## External Dependencies

| System | What EMA uses it for | Status |
|---|---|---|
| Claude CLI | Execution dispatch, proposal generation | ✅ Working — auto-resolved from PATH |
| Superman | Code intelligence, semantic indexing | ❌ Not wired — designed but not running |
| OpenClaw | Agent dispatch to remote VPS | ⚠️ Stubbed — gateway healthy but not integrated |

These are NOT required for core EMA functionality. The execution loop runs entirely via local Claude CLI.

---

## Effort Key

| Size | Meaning | Rough Time |
|---|---|---|
| S | Straightforward, well-patterned | 1-2 hours |
| M | Some complexity, may need investigation | 3-5 hours |
| L | Significant work, new patterns needed | 1-2 days |
| XL | Complex system, multiple subsystems | 3-5 days |
