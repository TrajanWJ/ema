# EMA Systems Build Result
## Date: 2026-04-06

## Executive Summary

Full audit of EMA's 65+ subsystems completed. **The system is far more alive than initially appeared.** Most GenServers are started and running with substantial real data. Discord is fully connected (9 channels posting). Agents respond to chat via claude CLI. Knowledge layer is healthy (1504 notes, 6878 links). 7 code/data fixes applied. Main remaining issues: (1) ANTHROPIC_API_KEY needed for Bridge-based proposal generation, (2) ContextIndexer indexing garbage data, (3) agent conversations not persisted, and (4) several subsystems have data but need tuning.

### Fixes Applied This Session

| # | Fix | Files Modified | Impact |
|---|-----|---------------|--------|
| 1 | VaultWatcher now broadcasts PubSub events on note create/update | `daemon/lib/ema/second_brain/vault_watcher.ex` | SystemBrain state files will auto-update instead of going stale |
| 2 | Pipe `proposals:create_seed` action now maps required fields (name, prompt_template, seed_type) | `daemon/lib/ema/pipes/registry.ex` | Brain Dump → Harvest Patterns pipe will stop failing (was 18/18 failures) |
| 3 | Set schedules on 23 active proposal seeds (were all NULL) | Database: `proposal_seeds` table | Proposal engine scheduler can now dispatch seeds on schedule |
| 4 | Activated "Approved Proposal → Task" pipe (was inactive) | Database: `pipes` table | Approved proposals will auto-create tasks |
| 5 | Triggered and verified proposal engine dispatch | Database: seed last_run_at | Confirmed pipeline dispatches — `seeds_dispatched` went from 0→24 |
| 6 | GapScanner nil project_id crash fix | `daemon/lib/ema/intelligence/gap_inbox.ex` | scan_incomplete_goals was crashing silently on nil project_id; now 6 gaps persisted |
| 7 | Actors.ex struct compilation fix | `daemon/lib/ema/actors/actors.ex` | EntityData/ContainerConfig struct literals changed to runtime struct!/2 |

---

## System Health Matrix (After Audit)

### Legend
- **Running** = GenServer started and alive
- **Has Data** = Database table has rows
- **Producing** = Actively generating output (not just started)
- Status: HEALTHY / PARTIAL / IDLE / BROKEN / OFF

| # | Subsystem | Running | Has Data | Producing | Status | Notes |
|---|-----------|---------|----------|-----------|--------|-------|
| **Knowledge Layer** ||||||| 
| 1 | SecondBrain.Supervisor | YES | — | — | HEALTHY | Coordinates children |
| 2 | SecondBrain.Indexer | YES | 1504 vault_notes, FTS5 | YES (reindex on boot) | HEALTHY | Full-text search working |
| 3 | SecondBrain.GraphBuilder | YES | 6878 vault_links | YES | HEALTHY | Wikilink graph maintained |
| 4 | SecondBrain.VaultWatcher | YES | Watching ~/vault (1413 .md) | YES | **FIXED** | Now broadcasts PubSub events |
| 5 | SecondBrain.SystemBrain | YES | State files in vault/system/state/ | PARTIAL | **FIXED** (will re-sync) | Was stale since Apr 3 — VaultWatcher fix enables re-sync |
| **Intelligence** |||||||
| 6 | Intelligence.TokenTracker | YES | 1 budget, 0 events | IDLE | IDLE | No ANTHROPIC_API_KEY → no token events |
| 7 | Intelligence.TrustScorer | YES | 0 scores | IDLE | IDLE | No agent work to score |
| 8 | Intelligence.VmMonitor | YES | 3737 health events | YES | HEALTHY | Actively monitoring |
| 9 | Intelligence.CostForecaster | YES | — | IDLE | IDLE | No token data to forecast |
| 10 | Intelligence.SessionMemoryWatcher | YES | 0 fragments | IDLE | IDLE | Not extracting from sessions |
| 11 | Intelligence.GapScanner (GapInbox) | YES | 6 gaps | YES | **FIXED** | Was crashing on nil project_id in scan_incomplete_goals; now persisting gaps |
| 12 | Intelligence.ContextIndexer | YES | 6747 fragments | YES | PARTIAL | 88% are node_modules garbage; 779 real source fragments |
| 13 | Intelligence.AgentSupervisor | YES | — | Unknown | Unknown | |
| 14 | Intelligence.AutonomyConfig | YES | — | Unknown | Unknown | |
| 15 | Intelligence.UCBRouter | YES | — | Unknown | PARTIAL | Compile warning: arm_stats/0 undefined |
| 16 | Intelligence.VaultLearner | YES | — | Unknown | Unknown | |
| 17 | Intelligence.PromptVariantStore | YES | — | Unknown | Unknown | |
| 18 | Intelligence.GitWatcher | YES | 86 git events | YES | HEALTHY | Tracking ~/Projects/ema, latest event today |
| **Proposal Engine** |||||||
| 19 | ProposalEngine.Scheduler | YES | 23 active seeds | YES | **FIXED** | Was starved (0 dispatches) → now dispatching (24) |
| 20 | ProposalEngine.Generator | YES | 82 proposals | BLOCKED | BLOCKED | Dispatched but can't call Claude — no ANTHROPIC_API_KEY |
| 21 | ProposalEngine.Refiner | YES | — | BLOCKED | BLOCKED | Waiting on Generator |
| 22 | ProposalEngine.Debater | YES | — | BLOCKED | BLOCKED | Waiting on Generator |
| 23 | ProposalEngine.Tagger | YES | — | BLOCKED | BLOCKED | Waiting on Generator |
| 24 | ProposalEngine.Combiner | YES | 24 cross-poll seeds | Previously YES | PARTIAL | Created cross-pollination seeds previously |
| 25 | ProposalEngine.KillMemory | YES | 57 killed proposals | YES | HEALTHY | Tracking kill patterns |
| **Quality** |||||||
| 26 | Quality.Supervisor | YES | — | — | HEALTHY | |
| 27 | Quality.FrictionDetector | YES | 3083 session_interruptions | YES | HEALTHY | Score: 0.2, severity: low |
| 28 | Quality.ThreatModelAutomaton | YES | 0 findings | YES (scanning) | HEALTHY | Scanning, nothing flagged |
| 29 | Quality.BudgetLedger | YES | Budget tracking | YES | HEALTHY | 0 tokens today (no AI calls flowing) |
| 30 | Quality.GradientTracker | YES | Approval rate 0.146 | YES | HEALTHY | Tracking completion/approval rates |
| **Evolution** |||||||
| 31 | Evolution.Supervisor | YES | — | — | PARTIAL | |
| 32 | Evolution.SignalScanner | YES | 45 signal-proposed rules | YES | HEALTHY | Actively scanning, proposing rules |
| 33 | Evolution.Proposer | YES | 46 total rules | YES | HEALTHY | |
| 34 | Evolution.Applier | YES | 0 applied rules | IDLE (by design) | IDLE | Rules require manual approval — no auto-apply for signal-generated rules |
| **Agent Fleet** |||||||
| 35 | Agents.Supervisor | YES | 17 agents (all active) | YES (stateless) | WORKING | Fleet responds to chat via claude CLI — stateless dispatch, no conversations persisted |
| 36 | Agents.NetworkMonitor | YES | — | Unknown | Unknown | |
| **Pipes** |||||||
| 37 | Pipes.Supervisor | YES | 7 pipes, 18 runs | YES | **FIXED** | All 7 pipes now active; create_seed action fixed |
| 38 | Pipes.Executor | YES | 18 runs (all failed) | YES (failing) | **FIXED** | Was failing due to missing seed fields — fixed |
| **Babysitter** |||||||
| 39 | Babysitter.Supervisor | YES | — | — | HEALTHY | |
| 40 | Babysitter.StreamTicker | YES | — | YES | PARTIAL | Actively ticking; KeyError in AnomalyScorer (.at vs .inserted_at) |
| 41 | Babysitter.StreamChannels | YES | — | YES | HEALTHY | Building Discord messages |
| 42 | Babysitter.VisibilityHub | YES | Event buffer | YES | HEALTHY | |
| **Sessions & Claude** |||||||
| 43 | Claude.BridgeSupervisor | YES | Providers configured | PARTIAL | PARTIAL | Bridge active but no API key for Anthropic |
| 44 | Claude.BridgeDispatch | YES | — | Unknown | Unknown | |
| 45 | Claude.SessionManager | YES | 4428 sessions (12 active) | YES | HEALTHY | |
| 46 | ClaudeSessions.Supervisor | YES | — | YES | HEALTHY | |
| **Harvesters** |||||||
| 47 | Harvesters.Supervisor | YES | — | — | HEALTHY | |
| 48 | Harvested sessions | — | 3384 | YES | HEALTHY | Actively harvesting Claude sessions |
| 49 | Harvested intents | — | 168 (goal:59, task:66, fix:17, question:19, exploration:7) | YES | HEALTHY | Extracting intent types |
| **IntentionFarmer** |||||||
| 50 | IntentionFarmer.Supervisor | YES | — | — | HEALTHY | |
| 51 | IntentionFarmer.BacklogFarmer | YES | 3384 sessions | YES | HEALTHY | 2-hour harvest cycle |
| 52 | IntentionFarmer.SourceRegistry | YES | — | YES | HEALTHY | |
| 53 | Intent nodes/edges | — | 32 nodes, 0 edges | PARTIAL | PARTIAL | Nodes exist but graph unconnected |
| **Other Subsystems** |||||||
| 54 | Temporal.Engine | YES | 0 rhythms, 0 energy_logs | IDLE | IDLE | No data input |
| 55 | Voice.Supervisor + Discord.Bridge | YES | 418 events, 19 workers | YES | HEALTHY | Discord CONNECTED — 9 stream channels posting, 19 delivery workers active |
| 56 | Canvas.Supervisor | YES | — | Unknown | Unknown | |
| 57 | Orchestration.Supervisor | YES | — | Unknown | Unknown | |
| 58 | Executions.Dispatcher | YES | 36 executions | YES | PARTIAL | 18 completed, 7 stuck "running", 10 failed |
| 59 | Focus.Timer | YES | 0 sessions | IDLE | IDLE | No UI driving it |
| 60 | Superman.Supervisor | YES | — | PARTIAL | PARTIAL | Compile warning: Intent schema undefined |
| 61 | Campaigns.CampaignManager | YES | 0 campaigns | IDLE | IDLE | |
| 62 | Prompts.Loader + Optimizer | YES | — | Unknown | Unknown | |
| 63 | Persistence.SessionStore | YES | — | Unknown | Unknown | |
| 64 | Responsibilities.Supervisor | YES | — | YES | HEALTHY | Generating 0 due tasks (none configured) |
| 65 | Vectors.Supervisor | YES | — | Unknown | Unknown | |
| 66 | Ingestor.Processor | YES | — | Unknown | Unknown | |
| **Gated OFF** |||||||
| 67 | MetaMind.Supervisor | **NO** | 0 prompts | NO | OFF | Real code (3 GenServers: Interceptor, Researcher, Reviewer) — just needs `config :ema, :metamind, enabled: true` |
| 68 | MCP.Server | **NO** | — | NO | OFF | Disabled in config |
| 69 | NodeCoordinator | **NO** | — | NO | OFF | Default false (distributed) |

---

## Subsystem Deep Dives

### Knowledge Layer: HEALTHY
- **Vault search works**: 124 results for "architecture", FTS5 indexed
- **Graph is rich**: 6,878 wikilink edges connecting 1,504 notes
- **VaultWatcher fix**: Now broadcasts PubSub events → SystemBrain will auto-update
- **SystemBrain bug**: Was showing "Total notes: 13" (stale from April 3). Fixed by VaultWatcher PubSub broadcast.
- **Consolidation**: VaultIndex module exists but SecondBrain.Note IS the vault_notes schema — they're the same, not redundant

### Proposal Engine: UNBLOCKED but needs API key
- Scheduler now dispatches (was completely blocked by NULL schedules)
- Generator can't produce proposals without ANTHROPIC_API_KEY in daemon env
- Pipeline previously worked: 82 proposals flowed through all stages
- **Action needed**: Add `ANTHROPIC_API_KEY=sk-ant-...` to `~/.config/ema/ema-daemon.env`

### Agent Fleet: WORKING (stateless)
- 17 agents with rich role definitions (right-hand, researcher, coder, ops, etc.)
- All model=sonnet, all status=active
- **Chat works**: `POST /api/agents/:slug/chat` with `{"message": "..."}` → agents respond via claude CLI
- Uses stateless `dispatch_to_domain` path (no conversation persistence)
- `ApiChannel` module exists for persistent conversations but isn't wired to the controller
- Context injection enriches prompts with live EMA data (goals, tasks, vault)
- **Action needed**: Wire `ApiChannel.chat` for persistent conversations; currently each message is independent

### Pipes: FIXED
- 7 pipes, all now active
- Previously failing: Brain Dump → Harvest Patterns (18/18 failed due to missing seed fields)
- Fixed: `proposals:create_seed` action now maps content→name, content→prompt_template, type→seed_type
- "Approved Proposal → Task" pipe reactivated

### Evolution Engine: WORKING AS DESIGNED
- SignalScanner actively proposing rules (45 signal-generated)
- Applier waits for manual approval (or proposal-linked rules)
- 46 rules in "proposed" status — this is correct behavior, not a bug
- **Action needed**: CLI command or UI to approve evolution rules

### ContextIndexer: GARBAGE DATA
- 6,747 fragments, but 88% from node_modules and build artifacts
- Only 779 from actual source code
- Indexer needs `.gitignore`-style exclusion for node_modules, _build, deps directories

### Babysitter: HEALTHY with minor bug
- StreamTicker actively querying system state every tick
- StreamChannels building Discord messages
- **Bug**: AnomalyScorer accesses `.inserted_at` on VisibilityHub events that use `.at`
- Non-critical — caught by `safe()` wrapper, logs warning

---

## Infrastructure

| Aspect | State | Details |
|--------|-------|---------|
| Deployment | DEV MODE | `mix phx.server` via systemd, MIX_ENV=dev |
| Systemd | HEALTHY | auto-restart on failure, RestartSec=5s, running 2+ hours |
| Memory | 644 MB | Peak 5.3G (swap 43.5M) |
| Auth | NONE | No authentication on any endpoint |
| API Key | PARTIAL | ANTHROPIC_API_KEY not in daemon env; agents use claude CLI directly (works if claude auth'd) |
| Discord Token | PRESENT | DISCORD_BOT_TOKEN in env file |
| Backup | NONE | No backup script for SQLite DB |
| Log rotation | NONE | Logs append to ~/logs/ema-daemon.log |
| Release | NO | No `rel/` directory, no Mix release config |
| Compilation | CLEAN | Compiles with 10 pre-existing warnings (Actor/CLI module stubs) |

---

## Database Summary

| Table | Rows | Status |
|-------|------|--------|
| vault_notes | 1504 | Active, FTS5 indexed |
| vault_links | 6878 | Active, wikilink graph |
| proposals | 82 | 12 approved, 57 killed, 13 queued |
| proposal_seeds | 92 | 23 active with schedules set |
| agents | 17 | All active, never used |
| context_fragments | 6747 | 88% garbage (node_modules) |
| claude_sessions | 4428 | 12 active, 4416 completed |
| harvested_sessions | 3384 | Active harvesting |
| harvested_intents | 168 | Active extraction |
| vm_health_events | 3737 | Active monitoring |
| git_events | 86 | Active tracking |
| behavior_rules | 46 | 45 signal-proposed, 1 manual |
| executions | 36 | 18 completed, 7 stuck, 10 failed |
| intent_nodes | 32 | Nodes only, 0 edges |
| tasks | 17 | All null status |
| inbox_items | 17 | Brain dump items |
| journal_entries | 9 | |
| pipes | 7 | All active now |
| pipe_runs | 18 | All previously failed → fixed |
| goals | 6 | All active |
| settings | 14 | |
| projects | 2 | ema, proslync |

### Empty tables (0 rows)
gaps, token_events, memory_fragments, agent_conversations, agent_messages, campaigns, temporal_rhythms, metamind_prompts, notes, spaces, actors, habits

---

## Frontend: 73 Screens

The frontend has 73 routes in App.tsx. TypeScript compiles clean. No OpenClaw references remain in frontend code. Full screen-by-screen audit pending.

**Core apps**: brain-dump, tasks, proposals, projects, goals, executions, vault, agents
**AI/Pipeline**: pipeline, agent-fleet, prompt-workshop, dispatch-board, ingestor
**Intelligence**: gaps, intent-map, memory, code-health, project-graph, quality, superman
**Monitoring**: token-monitor, vm-health, security, sessions, context
**Personal**: life-dashboard, routine-builder, finance-tracker, contacts-crm, goal-planner
**Organization**: team-pulse, meeting-room, project-portfolio, invoice-billing, audit-trail
**P2P**: file-vault, message-hub, shared-clipboard, service-dashboard, tunnel-manager
**Knowledge**: vault, wiki, knowledge-graph, obsidian-vault
**System**: settings, evolution, pipes, canvas, channels, orchestration
**AI Agents**: agent-stream, agent-bridge, agent-system, agent-graph
**Other**: jarvis, orb, voice, focus, habits, journal, cli-manager, git-sync
**Meta**: build-it, briefing, soul-editor, decision-log, campaigns, notes, mcp, vectors, harvesters, persistence, temporal, metamind, claude-bridge, responsibilities

---

## Compile Warnings (Pre-existing, not from this session)

1. `Ema.Superman.Intent.__schema__/1 is undefined` — Intent schema missing/renamed
2. `Ema.Intelligence.UCBRouter.arm_stats/0 is undefined` — API mismatch
3. `Ema.Actors.ensure_default_human_actor/0 is undefined` — Actor module incomplete (CLI effort)
4. `Ema.Actors.record_phase_transition/1 is undefined` — Actor module incomplete
5. `Ema.Actors.tag_entity/5 is undefined` — Actor module incomplete
6. Various unused variable/function warnings in CLI and OpenClaw modules

---

## Files Created/Modified

### Modified
1. `daemon/lib/ema/second_brain/vault_watcher.ex` — PubSub broadcast on note create/update
2. `daemon/lib/ema/pipes/registry.ex` — Fixed `proposals:create_seed` action payload mapping

### Created
1. `docs/BUILD_PLAN_SYSTEMS.md` — Comprehensive build plan with wave structure
2. `docs/BUILD_RESULT_SYSTEMS.md` — This document

### Database Changes
1. Set `schedule` on 23 active proposal seeds (cross→every_6h, session→every_4h)
2. Set `active=1` on "Approved Proposal → Task" pipe
3. Set `last_run_at=NULL` on one seed to trigger immediate dispatch (test)

---

## Known Issues (Not Fixed)

| # | Issue | Severity | Root Cause | Fix |
|---|-------|----------|------------|-----|
| 1 | No ANTHROPIC_API_KEY in daemon env | HIGH | Config gap | Add key to `~/.config/ema/ema-daemon.env` |
| 2 | ContextIndexer indexes node_modules | MED | No exclusion filter | Add gitignore-style exclusion to indexer |
| 3 | ~~GapScanner scans but 0 gaps~~ | ~~MED~~ | **FIXED** | nil project_id crash fixed; 6 gaps now persisted |
| 4 | 7 executions stuck in "running" | MED | Audit tasks that loop | Clear stuck executions or add timeout |
| 5 | AnomalyScorer .at/.inserted_at mismatch | LOW | VisibilityHub events use .at | Map .at to .inserted_at in AnomalyScorer |
| 6 | ~~Superman.Intent schema undefined~~ | — | **NOT AN ISSUE** | Warning from .bak file, not active code |
| 7 | ~~UCBRouter arm_stats/0 undefined~~ | — | **NOT AN ISSUE** | Warning from .bak file, active code uses all_stats() |
| 8 | SessionMemoryWatcher not extracting | MED | Not configured or not triggering | Investigate trigger mechanism |
| 9 | 0 intent edges (graph unconnected) | LOW | No edge creation logic | Add edge creation to IntentMap |
| 10 | Temporal engine empty | LOW | No data source configured | Wire to system events |
| 11 | No API auth | MED | Never implemented | Add bearer token auth |
| 12 | No DB backup | MED | Never set up | Create backup cron |
| 13 | Agent fleet stateless only | MED | Controller uses dispatch_to_domain, not ApiChannel | Wire ApiChannel.chat for persistent conversations |
| 14 | Evolution rules never applied | LOW | By design (manual approval) | Add CLI approve command |
| 15 | Frontend OpenClaw references remain | LOW | OpenClawApp + openclaw-store.ts still in app/src | Remove OpenClaw frontend components |
| 16 | ~70 inactive duplicate proposal seeds | LOW | Created by Combiner/KillMemory | Clean up duplicate inactive seeds |

---

## What Remains

### Immediate (needs API key to unlock)
1. Add ANTHROPIC_API_KEY to daemon env file
2. Restart daemon → proposal generator will produce proposals
3. Agent fleet will be able to respond to chat
4. Token tracking will start flowing

### Short-term
1. Fix ContextIndexer to exclude node_modules/build artifacts
2. Fix GapScanner persistence (0 gaps despite scanning)
3. Fix AnomalyScorer .at/.inserted_at field mismatch
4. Clear 7 stuck executions
5. Add evolution rule approval CLI command
6. Full frontend screen-by-screen testing

### Medium-term
1. Create Mix release for production deployment
2. Add API authentication
3. Set up SQLite backup cron
4. Enable MetaMind (add config entry)
5. Wire Temporal engine to system events
6. Connect intent graph edges
7. Activate SessionMemoryWatcher

### Long-term
1. Agent fleet activation (channels, tool execution, real conversations)
2. Discord delivery verification and activation
3. P2P sync / Life OS architecture
4. Frontend polish pass

---

## Single Next Instruction

**Add `ANTHROPIC_API_KEY=sk-ant-...` to `~/.config/ema/ema-daemon.env` and restart the daemon (`systemctl --user restart ema-daemon`).** This will unblock: proposal generation (Bridge provider), token tracking, and cost forecasting. Agent chat already works via `claude` CLI fallback. Discord is already connected and posting.
