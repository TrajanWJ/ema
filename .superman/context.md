# EMA Project Context

## Core Loop (working)
```
brain dump item / proposal seed
  → ProposalEngine pipeline (Generator → Refiner → Debater → Tagger)
  → Proposal queued for review
  → User approve/redirect/kill
  → Execution record created
  → Dispatcher → Claude CLI invocation
  → Result artifact written
  → Execution completed
```

## What Exists Today (2026-04-05)

**Input layer:**
- `BrainDump.create_item/1` — fires PubSub + EventBus events
- 79 proposal seeds (10 active after cleanup, 69 deactivated)
- Evolution system generates seeds from behavioral signals (currently deactivated — was producing spam)

**Proposal layer:**
- Full 5-stage pipeline: Generator → Refiner → Debater → Tagger → Combiner
- KillMemory tracks killed proposal patterns (Jaccard similarity)
- Orchestrator supports manual generation via API
- SeedPreflight quality gate (in worktree — not yet merged)

**Approval → Execution:**
- `Proposals.approve_proposal/1` → `Ema.Executions.on_proposal_approved/1` → creates Execution → dispatches via PubSub
- `Ema.Executions.Dispatcher` handles dispatch to Claude CLI
- Execution tracks: status, agent_sessions, events, diffs

**Actor/Workspace layer:**
- `Ema.Actors` — Collaboration identity: 18 actors (1 human + 17 agents) bootstrapped on startup
- `Ema.Actors.Bootstrap` — Idempotent startup: creates actors, backfills agent FK
- Tasks and executions stamped with `actor_id` (defaults to human). REST `?actor_id=` filtering on both.
- Bridge: `Ema.Agents.Agent.actor_id` FK → `Ema.Actors.Actor`. Bidirectional lookup functions.
- Entity data: per-actor metadata on any entity (sprint_week, estimated_tokens, priority)
- Phase transitions: plan → execute → review → retro cadence per actor

**Agent layer:**
- `Agents.AgentWorker` — GenServer per agent, Claude CLI calls, tool execution (1 tool implemented)
- `AgentMemory` — conversation compression at >20 messages
- `OpenClaw.AgentBridge` — polls gateway every 5s
- `ClaudeSessions.SessionWatcher` — passive JSONL discovery + parsing + project linking

**Harvesting:**
- `GitHarvester` + `SessionHarvester` — implemented
- `VaultHarvester`, `UsageHarvester`, `BrainDumpHarvester` — declared but not implemented

**Observability:**
- `Babysitter` — OrgController + StreamChannels (9 Discord channels) + StreamTicker
- `GapScanner` — 7-source friction scanning every 60 min
- `TokenTracker` — per-call cost recording with spike detection
- `Evolution.SignalScanner` — behavioral signal scanning

## What's In Worktree Branches (built, not merged)

1. `Superman.Context.for_project/2` — real project dashboard context API
2. Proposal API contract normalization — consistent response shapes
3. `BridgeDispatch` GenServer — async dispatch with tracking, retries, PubSub callbacks
4. `SeedPreflight` — pre-generation quality gate (100-point scoring, dedup, enrichment)
5. `Claude.Failure` — typed failure taxonomy + event store + preflight checks
6. Brain Dump → Proposal Loop — embedding clusters, cosine similarity, auto-surfacing
7. OpenClaw Vault Sync — rsync mirror, delta consumer, reconciler (behind config flag)

## What's Missing (Phase 2 targets)

1. **Intelligence.Router** — event classification, routing decisions
2. **ContextInjector** — vault + goals + tasks enrichment for AI calls
3. **Domain agents** — Strategist, Coach, Archivist personas
4. **CampaignManager** — named persistent session clusters
5. **Outcome linker** — proposal → execution → result → feedback loop
6. **Auto-approve rules** — safe proposals skip human review
7. **Genealogy edge tracking** — DAG visualization of idea evolution
8. **Friction map heatmap** — visual representation of GapScanner findings
9. **Pattern Crystallizer** — detect recurring workflows, harden into artifacts (Phase 3)
10. **Autonomous Reasoning** — auto-improvement loop, threat model, health dashboard (Phase 3)

## Design Invariants
- **Intent** = semantic, pre-execution, markdown, slow-changing
- **Execution** = committed, runtime, DB row, fast-changing
- **.superman/intents/** = durable anchor (survives DB resets). Filesystem is canonical, DB is queryable runtime view.
- **DB intents** = queryable tree with links/lineage. Rebuildable from .superman folders via import script.
- **Join key:** intent slug matches both `.superman/intents/<slug>/` directory and `intents.slug` DB column.
- **HQ** = execution surface (timeline of runtime state)
- **EMA** = intention/readiness surface (shapes what to do)
- **Actors** = workspace identity. Tasks/executions stamped with actor_id. Human + agent mutual visibility.
- No vague agent delegation — all packets must be structured
- Bridge fallback: `Bridge.run/2` → `Runner.run/2` when Bridge not started (silent)

## Contradictions to Fix (from audit 2026-04-04)
1. 7 dead WebSocket channel topics (frontend joins, no backend handler)
2. Bridge opt-in but called everywhere (silent feature loss)
3. 3 missing harvester modules (declared in @valid_harvesters)
4. Vault path resolved 4 ways (compile_env vs get_env vs env var vs hardcoded)
5. CLAUDE.md store/app counts severely outdated
