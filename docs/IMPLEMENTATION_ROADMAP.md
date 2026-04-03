# EMA Implementation Roadmap

## Phase 1: Foundation + Documentation (This Week)

### 1.1 Feature Specs & Architecture Docs
| Deliverable | Effort | Status |
|---|---|---|
| `docs/FEATURES.md` — all 8 features | S | ✅ Done |
| `docs/ARCHITECTURE.md` — system architecture | S | ✅ Done |
| `docs/IMPLEMENTATION_ROADMAP.md` — this file | S | ✅ Done |
| 8× `docs/FEATURE_*.md` — individual feature specs | M | ✅ Done |
| `docs/schemas/*.schema.md` — data structure docs | S | ✅ Done |

### 1.2 Project Visualization System
| Deliverable | File | Effort | Status |
|---|---|---|---|
| ProjectGraph backend | `daemon/lib/ema/intelligence/project_graph.ex` | M | ✅ Done |
| Graph API controller | `daemon/lib/ema_web/controllers/project_graph_controller.ex` | S | ✅ Done |
| Router integration | `daemon/lib/ema_web/router.ex` (add routes) | S | ✅ Done |
| Graph Zustand store | `app/src/stores/graph-store.ts` | S | ✅ Done |
| ProjectGraph React component | `app/src/components/project-graph/ProjectGraphApp.tsx` | L | ✅ Done |
| Launchpad tile + App.tsx route | Modified files | S | ✅ Done |

**Success Criteria Phase 1:**
- [ ] `mix compile` passes with project_graph.ex + controller
- [ ] `npx tsc --noEmit` passes with React component
- [ ] Project Graph shows up in Launchpad
- [ ] API returns node/edge data from real DB
- [ ] Force graph renders with hover/click/search

---

## Phase 2: Core Features (Weeks 2-3)

Build in dependency order — each feature unblocks the next.

### 2.1 Execution Fabric + DCC Engine (Keystone)
| Deliverable | File | Effort |
|---|---|---|
| Schema routing (agents declare output schemas) | `daemon/lib/ema/pipes/schema_router.ex` | M |
| DCC block GenServer (synthesis contracts) | `daemon/lib/ema/pipes/dcc_block.ex` | L |
| Workflow session persistence | `daemon/lib/ema/executions/workflow_session.ex` | M |
| Extend Pipes.Executor for schema routing | Modify `daemon/lib/ema/pipes/executor.ex` | M |
| Migration for workflow_sessions table | `daemon/priv/repo/migrations/` | S |

**Success Criteria:**
- Agents can declare output schemas and route outputs to the correct consumer
- DCC contracts execute (input A + input B → synthesis → output C)
- Workflow sessions persist across restarts

### 2.2 Workflow Observatory
| Deliverable | File | Effort |
|---|---|---|
| workflow_events table migration | `daemon/priv/repo/migrations/` | S |
| WorkflowEvent schema + context | `daemon/lib/ema/observatory/workflow_event.ex` | M |
| Genealogy edge tracking | `daemon/lib/ema/observatory/genealogy.ex` | M |
| Intent logger (auto-log on dispatch) | `daemon/lib/ema/observatory/intent_logger.ex` | S |
| Friction map heatmap generator | `daemon/lib/ema/observatory/friction_map.ex` | M |
| Budget awareness (quality gradient) | `daemon/lib/ema/observatory/budget_monitor.ex` | M |
| Observatory API controller | `daemon/lib/ema_web/controllers/observatory_controller.ex` | S |
| Observatory dashboard React component | `app/src/components/observatory/` | L |

**Success Criteria:**
- Every dispatch creates a workflow_event
- Genealogy DAG is queryable (given prompt X, what did it produce?)
- Friction map shows bottlenecks
- Budget monitor flags quality degradation from cheaper models

### 2.3 Proposal Intelligence
| Deliverable | File | Effort |
|---|---|---|
| Proposal validator | `daemon/lib/ema/proposal_engine/validator.ex` | L |
| KillMemory check integration | `daemon/lib/ema/proposal_engine/kill_memory.ex` | M |
| Cost estimator | `daemon/lib/ema/proposal_engine/cost_estimator.ex` | M |
| Outcome linker (proposal → result) | `daemon/lib/ema/proposal_engine/outcome_linker.ex` | M |
| Auto-approve rules engine | `daemon/lib/ema/proposal_engine/auto_approver.ex` | M |
| Feedback loop (outcome → seed strategy) | `daemon/lib/ema/proposal_engine/feedback_loop.ex` | M |

**Success Criteria:**
- New proposals auto-validated (lint, build sim, cost est)
- "Safe" proposals auto-approved (low-risk, well-scored, no kill signals)
- Approved proposals track outcomes; outcomes feed back into seed selection

### 2.4 Decision Memory
| Deliverable | File | Effort |
|---|---|---|
| Decision schema + migration | `daemon/lib/ema/decisions/` | M |
| Decision.Archaeology module | `daemon/lib/ema/intelligence/decision_archaeology.ex` | L |
| Vault/Discord miner | `daemon/lib/ema/intelligence/decision_miner.ex` | L |
| Precedent search (embedding-based) | `daemon/lib/ema/intelligence/precedent_search.ex` | L |
| Decision API controller | `daemon/lib/ema_web/controllers/decision_controller.ex` | S |
| Decision timeline UI | `app/src/components/decisions/` | L |

**Success Criteria:**
- Decisions mined from vault notes and Discord transcripts
- Each decision linked to outcomes (what happened after)
- When new decision encountered, similar precedents surfaced automatically

### 2.5 Intent-Driven Analysis
| Deliverable | File | Effort |
|---|---|---|
| IntentAnalysis module | `daemon/lib/ema/intelligence/intent_analysis.ex` | L |
| Intent-to-code mapping (IntentMap ↔ Superman) | `daemon/lib/ema/intelligence/intent_code_map.ex` | L |
| Flow-to-code swimlane generator | `daemon/lib/ema/intelligence/swimlane.ex` | M |
| Intent-driven search API | `daemon/lib/ema_web/controllers/intent_search_controller.ex` | M |
| Swimlane visualization | `app/src/components/intent/SwimlaneDiagram.tsx` | L |

**Success Criteria:**
- "Show me multi-tenancy code" → returns relevant files/functions
- Swimlane diagram shows feature flow from intent to implementation
- IntentMap nodes link bidirectionally to Superman codebase indices

### 2.6 Autonomous Reasoning
| Deliverable | File | Effort |
|---|---|---|
| Auto improvement loop GenServer | `daemon/lib/ema/autonomous/improvement_loop.ex` | XL |
| Threat model automaton | `daemon/lib/ema/autonomous/threat_model.ex` | L |
| Multi-project health dashboard | `daemon/lib/ema/autonomous/health_dashboard.ex` | M |
| Agent specialization autotune | `daemon/lib/ema/autonomous/agent_tuner.ex` | L |
| Vault-integrated seeding | `daemon/lib/ema/autonomous/vault_seeder.ex` | M |
| Health dashboard UI | `app/src/components/autonomous/` | L |

**Success Criteria:**
- System autonomously identifies code gaps → generates proposals → validates → applies (with approval gate)
- Continuous threat model analysis running
- Health dashboard shows all projects at a glance

### 2.7 Pattern Crystallizer
| Deliverable | File | Effort |
|---|---|---|
| Pattern detector GenServer | `daemon/lib/ema/crystallizer/pattern_detector.ex` | L |
| Crystallization proposer | `daemon/lib/ema/crystallizer/proposer.ex` | M |
| Human approval queue | `daemon/lib/ema/crystallizer/approval_queue.ex` | M |
| Skill file auto-creator | `daemon/lib/ema/crystallizer/skill_creator.ex` | M |
| Approval queue UI | `app/src/components/crystallizer/` | M |

**Success Criteria:**
- Patterns at 5+ successes / 70%+ rate flagged for crystallization
- Proposed crystallizations appear in approval queue
- Approved patterns auto-generate skill files / scripts / routing rules

---

## Phase 3: Beautiful Frontend + Virtual Spaces (Weeks 4+)

### 3.1 Smart Dashboard
- Central hub: active proposals, pending decisions, open todos, project health, agent status
- Customizable cards (user configures what matters)
- Real-time WebSocket updates
- Effort: XL

### 3.2 Virtual Workspaces
- Per-project workspace views
- Active tasks, open proposals, recent decisions, code health
- Effort: XL

### 3.3 Intent Canvas
- Visual Product → Flow → Action → System → Implementation hierarchy
- Drag-to-rearrange, edit inline
- Superman integration for code hover
- Effort: XL

### 3.4 Proposal Theater
- Card-based proposal flow with genealogy seed info
- Similar proposal history (genealogy + feedback)
- Quick-approve "safe" / deep-review "risky"
- Effort: L

### 3.5 Decision Timeline
- Interactive timeline (sortable by project/date/topic/outcome score)
- Precedent sidebar
- Link to implementing changes (git commits, files)
- Effort: L

### 3.6 Multi-Project Hub
- Overview of all projects
- Health scorecard per project
- Quick-jump to workspace
- Effort: M

---

## Effort Key

| Size | Meaning | Rough Time |
|---|---|---|
| S | Straightforward, well-patterned | 1-2 hours |
| M | Some complexity, may need investigation | 3-5 hours |
| L | Significant work, new patterns needed | 1-2 days |
| XL | Complex system, multiple subsystems | 3-5 days |
