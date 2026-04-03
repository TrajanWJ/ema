# EMA Project Architecture & Planning (PAP)

**Date:** 2026-04-03  
**Status:** Phase 1 Complete (F1-F5 Built), Phase 2 In Progress  
**Build:** All 5 features committed (`5c577f0`)

---

## Project Overview

EMA is a five-module Claude AI integration system for personal knowledge management and decision support:

1. **F1 — Design Posture Dashboard** — Security + Ops + Design widgets
2. **F2 — Claude Bridge** — Named persistent sessions, streaming, multi-turn, cost tracking
3. **F3 — DCC Context Store** — Domain-context consumption, vault integration
4. **F4 — Quality Pipeline** — 4-stage proposal orchestration with iterative quality gates
5. **F5 — CLI Mirror** — Full feature parity via HTTP API, standalone escript

### Architecture

**Hub-and-Spoke Model:**
- **Proposal Hub** (ProposalOrchestrator) — Owned, multi-stage pipeline with quality gates
- **Domain Agents** (Strategist, Coach, Archivist, etc.) — Lightweight, contextual, async
- **Intelligence Layer** (Router, ContextInjector, SignalProcessor) — Event routing, context enrichment, learning signals
- **Bridge** (Port-based Claude integration) — Persistent sessions, streaming, multi-model support
- **Vault Integration** — MCP-based live context pull, learnings extraction

---

## Phase Breakdown (12 Weeks)

### Phase 1: Foundation (Weeks 1-6) — **✅ COMPLETE**
- [x] Bridge migration: Runner.run() → Bridge.run()
- [x] Streaming pipeline with PubSub
- [x] Proposal 4-stage orchestrator
- [x] Quality gate (5 dimensions, 3-iteration loop)
- [x] Cost aggregator + budget tracking
- [x] Frontend: stage progress, streaming view, status badges
- [x] REST API: /proposals/generate, /proposals/pipelines, /proposals/budget, etc.
- [x] Ecto migrations (quality_score, pipeline_stage, cost_display, etc.)

**Commit:** `5c577f0` (CLI polish — all F1-F5 features merged)

### Phase 2: Intelligence Layer (Weeks 7-8) — **📋 IN PROGRESS**
- [ ] Ema.Intelligence.Router — Event classification
- [ ] Ema.Claude.ContextInjector — Vault + goals + tasks enrichment
- [ ] MCP server enhancement — EMA resources as MCP endpoints
- [ ] CampaignManager — Named persistent session clusters
- [ ] Domain agents (Strategist, Coach, Archivist)
- [ ] UI: Agents tab (fleet view, session monitor, cost dashboard)
- [ ] UI: Agent context bar in domain views

### Phase 3: Autonomy & Evolution (Weeks 9-12) — **🔮 ROADMAP**
- [ ] Pipes: claude_action type (prompt + model + quality_gate + target)
- [ ] Pre-built pipe templates (Morning Briefing, End-of-Day Review, Weekly Retro)
- [ ] Autonomy slider (Assist/Auto/Full)
- [ ] Daily budget enforcement, kill switch
- [ ] SignalProcessor — outcome tracking
- [ ] VaultLearner — extract patterns, write learnings
- [ ] PromptOptimizer — A/B test, identify evolution candidates
- [ ] Full audit dashboard

---

## Feature Specs (Completed)

### F1 — Design Posture Dashboard
**Status:** ✅ Complete  
**Modules:** `lib/ema_web/live/dashboard_live.ex`, dashboard widgets  
**Features:** Security posture panel, ops health monitor, design review scores

### F2 — Claude Bridge
**Status:** ✅ Complete  
**Modules:** `lib/ema/claude/bridge.ex`  
**Features:** Named persistent sessions, streaming, multi-model, cost tracking

### F3 — DCC Context Store
**Status:** ✅ Complete  
**Modules:** `lib/ema/claude/context_manager.ex`  
**Features:** Vault + goals + tasks enrichment, MCP resources, outcome tracking

### F4 — Quality Pipeline
**Status:** ✅ Complete  
**Modules:** `lib/ema/proposals/orchestrator.ex`, `quality_gate.ex`, `prompts.ex`, `cost_aggregator.ex`  
**Features:** 4-stage async pipeline, 5-dimensional quality gate, iteration loop (max 3x)

### F5 — CLI Mirror
**Status:** ✅ Complete  
**Modules:** `lib/ema_cli/*`  
**Features:** All 7 command groups, JSON/CSV output, graceful degradation

---

## Known Issues & Mitigations

1. **Ema.Claude.UsageRecord Module** — May not exist; CostAggregator has try/rescue fallback
2. **Context window bloat** — MCP lazy-pull, relevance scoring, top-5 only
3. **Quality gate loops** — Max 3 iterations, pass_with_warnings surfaced in UI
4. **Pre-existing pipes/registry.ex** — Syntax error noted but not caused by Batch 3

---

## Next Steps (Phase 2)

1. Create Intelligence.Router — Event classification, context enrichment
2. Wire CampaignManager — Persistent session clusters
3. Implement domain agents (Strategist, Coach, Archivist)
4. Enhance UI — Agents tab, context bar, fleet dashboard
5. Vault learning loop — Extract patterns, write learnings

---

**Last Updated:** 2026-04-03 18:24 UTC  
**Status:** Phase 1 ✅ | Phase 2 📋 | Phase 3 🔮
