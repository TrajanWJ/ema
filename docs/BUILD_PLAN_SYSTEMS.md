# EMA Systems Build Plan
## Generated: 2026-04-06
## Status: Wave 1 COMPLETE, see BUILD_RESULT_SYSTEMS.md for full results

## System Health Matrix

| # | Subsystem | Started? | Has Data? | Producing Output? | Blocking Issue |
|---|-----------|----------|-----------|-------------------|----------------|
| 1 | SecondBrain.Supervisor | YES | 1495 notes, 6878 links | YES (reindex on boot) | None — healthy |
| 2 | SecondBrain.Indexer | YES | FTS5 populated | YES (reindex_all on boot) | None |
| 3 | SecondBrain.GraphBuilder | YES | 6878 vault_links | YES | None |
| 4 | SecondBrain.VaultWatcher | YES | Watching ~/vault | YES (logs show inserts) | None |
| 5 | SecondBrain.SystemBrain | YES | Writes to vault/system/state/ | Likely YES | Verify output files exist |
| 6 | Intelligence.TokenTracker | YES (default true) | 1 token_budget, 0 token_events | NO — budget exists but no events | Not wired to API calls |
| 7 | Intelligence.TrustScorer | YES | 0 agent_trust_scores | NO | No agents producing scoreable work |
| 8 | Intelligence.VmMonitor | YES | 3737 vm_health_events | YES | None — healthy |
| 9 | Intelligence.CostForecaster | YES | Depends on token data | NO — no token events to forecast from | Blocked by TokenTracker |
| 10 | Intelligence.SessionMemoryWatcher | YES | 0 memory_fragments | NO | Not extracting from sessions |
| 11 | Intelligence.GapScanner | YES | 0 gaps | PARTIAL — GapInbox scanning but not writing | Verify scan→write path |
| 12 | Intelligence.ContextIndexer | YES | 6747 context_fragments (all type "code") | YES but homogeneous | Only indexing code, not other types |
| 13 | Intelligence.AgentSupervisor | YES | — | Unknown | Need to verify |
| 14 | Intelligence.AutonomyConfig | YES | — | Unknown | Need to verify |
| 15 | Intelligence.UCBRouter | YES | — | Unknown (warning: arm_stats/0 undefined) | Compile warning suggests API mismatch |
| 16 | Intelligence.VaultLearner | YES | — | Unknown | Need to verify |
| 17 | Intelligence.PromptVariantStore | YES | — | Unknown | Need to verify |
| 18 | ProposalEngine.Scheduler | YES | 23 active seeds | NO — 124 ticks, 0 dispatched | Seeds have NULL schedules |
| 19 | ProposalEngine.Generator | YES | 82 proposals exist | Previously YES | Blocked by Scheduler not dispatching |
| 20 | ProposalEngine.Refiner | YES | — | Previously YES | Pipeline stalled at Scheduler |
| 21 | ProposalEngine.Debater | YES | — | Previously YES | Pipeline stalled |
| 22 | ProposalEngine.Tagger | YES | — | Previously YES | Pipeline stalled |
| 23 | ProposalEngine.Combiner | YES | 24 cross seeds created | Previously YES | Created cross-poll seeds |
| 24 | ProposalEngine.KillMemory | YES | 57 killed proposals | YES | Working |
| 25 | Quality.Supervisor | YES | — | YES | Returns real friction/gradient/budget/threats |
| 26 | Quality.FrictionDetector | YES | 3083 session_interruptions | YES (score: 0.2, severity: low) | None |
| 27 | Quality.ThreatModelAutomaton | YES | 0 findings | Scanning but finding nothing | May need signal sources |
| 28 | Quality.BudgetLedger | YES | Budget tracking | YES (0 tokens used today) | No token flow to track |
| 29 | Evolution.Supervisor | YES | 46 behavior_rules | PARTIAL — rules proposed, never applied | Applier not applying |
| 30 | Evolution.SignalScanner | YES | 45 signal-proposed rules | YES (scanning, proposing) | None |
| 31 | Evolution.Proposer | YES | 46 proposed rules | YES | None |
| 32 | Evolution.Applier | YES | 0 applied rules | NO | Rules stuck in proposed status |
| 33 | Agents.Supervisor | YES | 17 agents defined | NO — 0 conversations, 0 messages | Fleet is decorative |
| 34 | Agents.NetworkMonitor | YES | — | Unknown | No agents doing work |
| 35 | Pipes.Supervisor | YES | 7 pipes, 18 runs | YES | Some pipes inactive |
| 36 | Pipes.Executor | YES | 18 pipe_runs | YES (previously fired) | Need to verify current firing |
| 37 | Babysitter.Supervisor | YES | — | YES (active querying) | Healthy |
| 38 | Babysitter.StreamTicker | YES | — | YES (querying tasks/proposals/sessions) | Healthy |
| 39 | Babysitter.StreamChannels | YES | — | YES (building messages) | Healthy |
| 40 | Feedback.Supervisor | YES | — | YES (endpoint responding) | Need to verify delivery |
| 41 | Claude.BridgeSupervisor | YES (ai_backend: :bridge) | Providers configured | YES | Healthy |
| 42 | Claude.BridgeDispatch | YES | — | Unknown | Need to verify |
| 43 | Claude.SessionManager | YES | 4428 sessions (12 active) | YES | Healthy |
| 44 | ClaudeSessions.Supervisor | YES | — | YES (session tracking) | Healthy |
| 45 | Harvesters.Supervisor | YES | 3384 sessions, 168 intents | YES | Actively harvesting |
| 46 | IntentionFarmer.Supervisor | YES | 32 intent_nodes, 0 edges | PARTIAL — nodes but no graph | Edges not being created |
| 47 | Temporal.Engine | YES | 0 rhythms | NO | No data being logged |
| 48 | Voice.Supervisor | YES | — | Unknown | Need to verify whisper connection |
| 49 | Discord.Bridge | YES (via voice flag) | Token in env | Unknown | Need to verify connection |
| 50 | Canvas.Supervisor | YES | — | Unknown | Need to verify |
| 51 | Orchestration.Supervisor | YES | — | Unknown | Need to verify |
| 52 | Executions.Dispatcher | YES | 36 executions | YES (18 completed) | 7 stuck in "running" |
| 53 | Focus.Timer | YES | 0 sessions, 0 blocks | NO | No UI driving it |
| 54 | Superman.Supervisor | YES | — | Unknown | Verify intent schema issue |
| 55 | Campaigns.CampaignManager | YES | 0 campaigns | NO | No campaigns created |
| 56 | Prompts.Loader | YES | — | Unknown | Need to verify |
| 57 | Prompts.Optimizer | YES | — | Unknown | Need to verify |
| 58 | Persistence.SessionStore | YES | — | Unknown | Need to verify |
| 59 | Responsibilities.Supervisor | YES | — | Unknown | Need to verify |
| 60 | Vectors.Supervisor | YES (proposal_engine enabled) | — | Unknown | Need to verify |
| 61 | Intelligence.GitWatcher | YES | 86 git_events | YES (latest: today) | Healthy |
| 62 | Ingestor.Processor | YES | — | Unknown | Need to verify |
| 63 | MetaMind.Supervisor | **NO** | 0 prompts | NO | No config entry — gated off |
| 64 | MCP.Server | **NO** | — | NO | Disabled in config |
| 65 | NodeCoordinator (Cluster) | **NO** | — | NO | Default false (distributed) |

## Summary Statistics

- **Started:** 62/65 subsystems
- **Has Data:** ~30 subsystems with meaningful data
- **Producing Output:** ~20 confirmed active, ~15 unknown, ~10 confirmed idle
- **Gated Off:** MetaMind, MCP Server, Cluster

---

## Knowledge Layer

### Current State: HEALTHY
SecondBrain is the strongest subsystem. 1,495 vault notes indexed with FTS5, 6,878 wikilink edges in the graph, reindexing on every boot. VaultWatcher is actively inserting new links (visible in logs). The vault at `~/vault` has ~1,413 markdown files being tracked.

### Issues
1. **VaultIndex module** may overlap with SecondBrain — need to verify if VaultIndex is a separate indexing path or just the schema
2. **Search API** returns results but response format needs verification (got count=1 for "architecture" which seems low for 1495 notes)
3. **SystemBrain** state files need verification — are `vault/system/state/*.md` being written?

### Work Needed
- Verify vault search quality (may need FTS tuning)
- Confirm VaultIndex vs SecondBrain consolidation status
- Test SystemBrain output files exist and are current

---

## Intelligence Systems

### Current State: MIXED — infrastructure running, output sparse

**Active and producing:**
- VmMonitor: 3,737 health events, actively checking
- GitWatcher: 86 events, latest today, tracking EMA repo
- ContextIndexer: 6,747 fragments but ALL are type "code" — not diverse

**Started but not producing:**
- TokenTracker: 1 budget record, 0 token events — not wired to actual API calls
- TrustScorer: 0 agent trust scores — no agents doing scoreable work
- SessionMemoryWatcher: 0 memory fragments — not extracting insights
- GapScanner/GapInbox: scanning (visible in logs) but 0 rows in gaps table
- CostForecaster: no data to forecast from
- VaultLearner: unknown output

**Compile warnings:**
- `UCBRouter.arm_stats/0 is undefined or private` — API mismatch

### Work Needed
1. **Wire TokenTracker to Bridge API calls** — every AI call should emit a token event
2. **Fix GapScanner write path** — it's scanning but not persisting gaps
3. **Activate SessionMemoryWatcher** — should extract fragments from the 4,428 claude sessions
4. **Fix UCBRouter** — arm_stats/0 API mismatch
5. **Diversify ContextIndexer** — index more than just "code" fragments

---

## Quality System

### Current State: HEALTHY
Quality endpoints return real data:
- **FrictionDetector:** score 0.2 (low severity), tracking 3,083 session interruptions
- **BudgetLedger:** tracking (0 tokens used today, 500k limit, $5 cost limit)
- **ThreatModelAutomaton:** scanning but 0 findings
- **Gradient:** completion_rate 0.0, approval_rate 0.146, trend stable

### Work Needed
- Budget tracking needs actual token flow data (blocked by TokenTracker)
- Threat model needs more signal sources to find real threats

---

## Proposal Engine Pipeline

### Current State: STALLED — Scheduler running but not dispatching

**Evidence:**
- Scheduler: 124 ticks, 0 seeds dispatched, state `scheduler_healthy_but_starved`
- 23 active seeds exist (15 session-type, 8 cross-type)
- Seeds have **NULL/empty `schedule` field** — scheduler doesn't know when to dispatch
- Pipeline previously worked: 82 proposals exist (12 approved, 57 killed, 13 queued)
- Combiner previously worked: 24 cross-pollination seeds created
- KillMemory working: 57 killed proposals tracked

### Blockages
1. **Seeds lack schedules** — the `schedule` column is empty for all active seeds, so `due_now_count: 0` always
2. Seeds were auto-generated (cross-pollination, session harvesting) but without schedule assignment

### Work Needed
1. **Set schedules on active seeds** — e.g., `"@hourly"` or `"every_4h"` or a cron expression
2. **Verify Scheduler reads schedule field** — confirm the format it expects
3. **Trigger one manual generation** to verify pipeline still flows end-to-end
4. **Clear stuck executions** — 7 executions stuck in "running" status (audit tasks that loop)

---

## Evolution Engine

### Current State: PROPOSING BUT NOT APPLYING
- SignalScanner: actively scanning, produced 45 signal-proposed rules
- Proposer: 46 total proposed rules (1 manual)
- Applier: 0 rules applied — rules stuck in "proposed" status

### Work Needed
1. **Understand approval flow** — do rules need manual approval before Applier acts?
2. **If auto-apply is intended:** fix Applier to process proposed→applied transition
3. **If manual approval:** wire UI or CLI command to approve rules

---

## Agent Fleet

### Current State: DECORATIVE — 17 agents defined, zero work done

**Agents defined:** right-hand, researcher, coder, ops, security, vault-keeper, browser-automation, prompt-engineer, concierge, devils-advocate, strategist, coach, archivist, ema, orchestrator-alpha, orchestrator-beta, orchestrator-gamma

All status=active, all model=sonnet (except archivist=haiku). Zero conversations, zero messages.

### Work Needed
1. **Test agent chat endpoint** — `POST /api/agents/:slug/chat` — verify it works
2. **Verify Claude Bridge integration** — AgentWorker needs to call Bridge to get responses
3. **Create test conversation** — send a message to one agent, verify response
4. **Wire agent channels** — currently only API channel exists (no Discord/Telegram)
5. **Agent tool execution** — verify agents can call tools (brain_dump, task creation, etc.)

---

## Frontend

### Current State: NEEDS AUDIT
- 52+ app components referenced in CLAUDE.md
- 67+ Zustand stores
- Glass morphism design system in globals.css
- Tauri shell with multi-window support
- REST + WebSocket pattern per store

### Work Needed
- Full screen-by-screen audit (delegated to agent)
- Remove any OpenClaw references
- Verify WebSocket channels connect
- Identify broken API calls

---

## Integrations

### Discord
- Token available in daemon env file (DISCORD_BOT_TOKEN)
- Discord.Bridge started via voice flag (start_voice defaults true)
- Babysitter.StreamChannels actively building messages
- **Unknown:** Is Bridge actually connected to Discord? Are messages posting?

### Git
- GitWatcher: HEALTHY — 86 events, latest today, tracking ~/Projects/ema

### Webhooks
- Need to verify endpoint existence and configuration

### Stream Manager
- Babysitter StreamTicker actively querying system state
- StreamChannels building messages
- **Unknown:** actual Discord delivery

### Work Needed
1. Verify Discord Bridge connection status
2. Test message delivery to Discord
3. Check webhook endpoint registration
4. Verify Feedback.Broadcast delivery chain

---

## Subsystem Status

### Campaigns: EMPTY
- CampaignManager started, 0 campaigns, no campaign_flows or campaign_runs
- Needs: seed data or UI to create campaigns

### Pipes: PARTIALLY ACTIVE
- 7 pipes defined, 6 active, 18 historical runs
- Active triggers: system:daily (2), projects:created, habits:streak_milestone, tasks:status_changed, brain_dump:item_created
- "Approved Proposal → Task" pipe is INACTIVE (active=0)
- Needs: reactivate proposal→task pipe, verify executor is firing on events

### MetaMind: GATED OFF
- No `:metamind` config entry anywhere
- 0 metamind_prompts in DB
- Needs: add `config :ema, :metamind, enabled: true` to config.exs if desired

### Voice: UNKNOWN
- Voice.Supervisor started (via start_voice flag)
- Unknown if whisper is available or connected
- Needs: verification

### Vectors: STARTED
- Vectors.Supervisor started (gated by proposal_engine.enabled = true)
- Unknown if actually embedding anything
- Needs: verification

### Temporal: EMPTY
- Temporal.Engine started, 0 temporal_rhythms, 0 temporal_energy_logs
- Needs: data input source or UI

### Harvesters: ACTIVE
- Harvesters.Supervisor started
- 3,384 harvested sessions, 168 harvested intents
- Actively producing data
- Intent types: goal(59), task(66), fix(17), question(19), exploration(7)

### IntentionFarmer: PARTIAL
- IntentionFarmer.Supervisor started, StartupBootstrap runs async on boot
- 32 intent_nodes exist, 0 intent_edges
- Nodes exist but graph is not connected
- Needs: edge creation logic, verify graph building

### Responsibilities: UNKNOWN
- Started via start_otp_workers
- Pipe exists for daily task generation
- Needs: verification of scheduler and health calculator

### Superman: STARTED WITH ISSUES
- Shares start_second_brain flag
- Compile warning: `Ema.Superman.Intent.__schema__/1 is undefined`
- Intent schema may be missing or renamed
- Needs: fix schema reference

---

## Infrastructure

### Deployment State: DEV MODE
- Running as `mix phx.server` under systemd user service
- MIX_ENV=dev
- No Mix release configured (no `rel/` directory)
- Auto-restart on failure (Restart=on-failure, RestartSec=5s)
- Logs to ~/logs/ema-daemon.log

### Auth State: NONE
- No authentication on any API endpoint
- No bearer token, no API key check
- Anthropic proxy presumably open
- Local-only (0.0.0.0:4488 in dev but only accessible locally)

### Backup State: NONE VISIBLE
- No backup scripts found
- DB at ~/.local/share/ema/ema_dev.db (644MB+ of data)
- No cron job or backup service detected

### Env File
- `~/.config/ema/ema-daemon.env` contains:
  - DISCORD_BOT_TOKEN
  - DISCORD_GUILD_ID
  - OPENCLAW_GATEWAY_URL (stale — OpenClaw is archived)

### Work Needed
1. Create Mix release config for production builds
2. Add basic API auth (at minimum for sensitive endpoints)
3. Create SQLite backup script (cron, daily)
4. Remove OPENCLAW_GATEWAY_URL from env
5. Set up log rotation
6. Consider switching systemd to MIX_ENV=prod release

---

## Wave Plan

### Wave 1: Diagnosis + Quick Fixes (Parallel, ~30min)

**Agent 1A — Proposal Engine Unblock**
- Read Scheduler to understand schedule format
- Set schedules on 5 active seeds
- Activate the "Approved Proposal → Task" pipe
- Trigger one manual proposal generation
- Acceptance: `due_now_count > 0`, one proposal generated

**Agent 1B — Intelligence Quick Fixes**
- Fix GapScanner write path (scanning but 0 rows in gaps table)
- Wire TokenTracker to emit events on Bridge API calls
- Fix UCBRouter arm_stats/0 compile warning
- Acceptance: gaps table has entries after scan

**Agent 1C — Frontend Audit**
- Load and catalog every screen component
- Document which render vs error
- Identify OpenClaw references
- Produce FRONTEND_AUDIT.md
- Acceptance: audit document produced

**Agent 1D — Integration Verification**
- Test Discord Bridge connection
- Test Feedback delivery
- Verify webhook endpoints
- Produce INTEGRATION_AUDIT.md
- Acceptance: audit document with per-integration status

### Wave 2: Activation (Parallel, ~45min)

**Agent 2A — Proposal Pipeline End-to-End**
- Verify pipeline flows: Seed → Scheduler → Generator → Refiner → Debater → Tagger
- Clear 7 stuck executions
- Test approve flow → execution dispatch
- Acceptance: one proposal flows through all stages

**Agent 2B — Agent Fleet Activation**
- Test POST /api/agents/:slug/chat for one agent
- Verify Bridge integration in AgentWorker
- Create first test conversation
- Acceptance: agent responds to a message

**Agent 2C — Intent Graph Connection**
- Fix IntentionFarmer edge creation
- Fix Superman.Intent schema reference
- Connect intent_nodes into a graph
- Acceptance: intent_edges > 0

**Agent 2D — Evolution Applier**
- Understand rule approval flow
- Either fix auto-apply or document manual approval path
- Acceptance: at least 1 rule transitions from proposed → applied/active

### Wave 3: Polish + Integration (Parallel, ~45min)

**Agent 3A — Frontend Critical Fixes**
- Fix top 10 broken screens from audit
- Remove OpenClaw references
- Verify WebSocket channels connect
- Acceptance: 10 critical screens render real data

**Agent 3B — Discord + Stream Activation**
- Verify Discord Bridge is posting
- Test Babysitter → Discord delivery chain
- Wire Feedback.Broadcast to Discord
- Acceptance: one Discord message posted from EMA

**Agent 3C — SessionMemory + TokenTracking**
- Wire SessionMemoryWatcher to extract from 4,428 sessions
- Wire token events to flow from Bridge calls
- Acceptance: memory_fragments > 0, token_events > 0

### Wave 4: Remaining Subsystems (Parallel, ~30min)

**Agent 4A — Temporal + Campaigns**
- Diagnose Temporal.Engine — what input does it need?
- Diagnose CampaignManager — what's the campaign creation flow?
- Seed minimal data if possible
- Acceptance: status documented

**Agent 4B — Voice + Vectors + MetaMind**
- Verify Voice.Supervisor state and whisper availability
- Verify Vectors.Supervisor embedding state
- Enable MetaMind if viable (add config)
- Acceptance: status documented per subsystem

**Agent 4C — Pipes Verification**
- Verify all 6 active pipes fire on their triggers
- Create a brain dump item → verify pipe fires
- Acceptance: pipe_runs count increases

### Wave 5: Infrastructure (Sequential)

**Agent 5A — Infrastructure Hardening**
- Create SQLite backup script + cron
- Remove stale OPENCLAW_GATEWAY_URL from env
- Add basic auth to sensitive endpoints (at minimum /api/engine/*, /api/agents/*/chat)
- Document path to production release
- Acceptance: backup script runs, stale env cleaned

---

## Priority Ranking (Impact x Effort x Dependency)

| Priority | Item | Impact | Effort | Why |
|----------|------|--------|--------|-----|
| P0 | Unblock Proposal Scheduler (set seed schedules) | HIGH | LOW | Core loop is stalled |
| P0 | Fix GapScanner write path | HIGH | LOW | Intelligence data not persisting |
| P1 | Activate agent chat | HIGH | MED | 17 agents doing nothing |
| P1 | Wire TokenTracker to Bridge | MED | MED | Cost visibility blocked |
| P1 | Frontend audit + top fixes | HIGH | MED | User-facing |
| P2 | Intent graph edges | MED | LOW | Farmer producing nodes but no graph |
| P2 | Evolution Applier | MED | LOW | 46 rules proposed, 0 applied |
| P2 | Discord delivery verification | MED | LOW | May already work |
| P2 | SessionMemoryWatcher activation | MED | MED | 4k sessions unprocessed |
| P3 | Clear stuck executions | LOW | LOW | 7 stuck in "running" |
| P3 | Temporal/Campaigns/MetaMind | LOW | MED | Empty subsystems |
| P3 | Infrastructure hardening | MED | MED | Not urgent for local dev |
| P4 | Fix Superman.Intent schema | LOW | LOW | Compile warning |
| P4 | UCBRouter arm_stats fix | LOW | LOW | Compile warning |
