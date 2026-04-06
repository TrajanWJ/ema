# EMA System Build Plan
## Generated: 2026-04-06
## Session: Full System Orchestration

---

## System Snapshot

| Metric | Count |
|--------|-------|
| REST Routes | 461+ |
| Ecto Schemas | 94 |
| Migrations | 96 (all passing) |
| GenServers | 111 |
| Controllers | 78 |
| WebSocket Channels | 36 |
| Frontend Components | 84 directories |
| Frontend Stores | 84 Zustand stores |
| Frontend TS/TSX files | 338 |
| Test files | 60 |
| OpenClaw references (daemon) | 371 |
| OpenClaw references (frontend) | 7 files |
| Docs | 65 .md files |

---

## Workstream Inventory

### A. Cleanup — Dead Code & Stale References

**OpenClaw Daemon (371 references across ~20 files):**
1. `lib/ema/openclaw/` — 7 files: agent_bridge.ex, channel_delivery.ex, client.ex, config.ex, dispatcher.ex, event_ingester.ex, gateway_rpc.ex
2. `lib/ema/integrations/openclaw/` — 5 files: sync_entry.ex, vault_mirror.ex, vault_reconciler.ex, vault_sync.ex, vault_sync_supervisor.ex
3. `lib/ema/agents/openclaw_sync.ex` — agent sync module
4. `lib/ema/claude/adapters/openclaw.ex` — Claude adapter
5. `lib/ema/claude/openclaw_runner.ex` — Runner thin wrapper
6. Config references in `runtime.exs` (openclaw_gateway_url, provider config)
7. Application.ex startup references (fuse breaker, provider registration)
8. Stream.Manager.ex references to gateway health check at :18789

**OpenClaw Frontend (7 files):**
1. `app/src/App.tsx` — import + route for OpenClawApp
2. `app/src/types/workspace.ts` — APP_CONFIGS entry
3. `app/src/stores/openclaw-store.ts` — full store (79 lines)
4. `app/src/components/openclaw/OpenClawApp.tsx` — component
5. `app/src/components/vm/VMHealthPanel.tsx` — :18789 display
6. `app/src/components/vm-health/VmHealthApp.tsx` — :18789 display
7. `app/src/stores/service-dashboard-store.ts` — possible reference

**Other Cleanup:**
- `daemon/priv/repo/migrations/20260407000001_add_agent_intent_to_tasks.exs.bak` — stale backup, delete
- Compiler warnings: 2 unused `transport` vars in `lib/ema/cli/commands/superman.ex`

### B. Data Model — Actor/Container System

**Status: Migrations DONE, schemas need verification**

New tables created (7 migrations, all passing):
- `actors` — human + agent actors with type, status, phase_config, current_phase
- `tags` — polymorphic tagging (entity_type, entity_id, tag_name, tag_value)
- `entity_data` — per-actor data on any entity (actor_id, entity_type, entity_id, key, value)
- `container_config` — per-container configuration (container_type, container_id, key, value)
- `phase_transitions` — actor phase change history
- `actor_commands` — agent-registered CLI commands
- ALTER: actor_id added to tasks, goals, executions, proposals; container_type/id on inbox_items

**Remaining work:**
- Verify Ecto schemas exist for all 7 new tables
- Verify context modules exist: `Ema.Actors`, `Ema.Tags`, `Ema.EntityData`, etc.
- Seed default "human" actor
- Wire controllers + routes for actor CRUD

### C. CLI — Elixir Escript

**Exists at:** `daemon/lib/ema_cli/` with 8 modules (cli.ex, health.ex, intent.ex, proposal.ex, quality.ex, routing.ex, session.ex, test_runner.ex)

**Also exists:** `daemon/lib/ema/cli/` with command modules (babysitter, brain_dump, exec, focus, goal, habit, journal, pipe, project, proposal, responsibility, seed, superman, task, vault + commands/ subdirectory)

**Issues:**
- Two CLI namespaces (`EmaCli.CLI` and `Ema.CLI`) — need consolidation per ADR-001
- `mix escript.build` entry points to `Ema.CLI` in mix.exs
- Python CLI at `bin/ema` (1927 lines) still primary user-facing interface

**Planned additions (from docs/cli/BUILD_PLAN.md):**
- 28+ additional command groups across 6 batches (A-F)
- Actor model commands: em, tag, data, actor, space, org, config
- Executive management: status, phases, velocity
- Watch command with PubSub subscriptions

### D. TUI — Ratatouille

**Status: Does not exist.** `daemon/lib/ema_tui/` not present.

**Plan (from docs/cli/BUILD_PLAN.md):**
- Mix task `mix ema.tui`
- Dashboard, tasks, executions, proposals, agents, vault, focus screens
- PubSub-driven updates (not REST polling)
- Glass aesthetic adapted for terminal

### E. Frontend — React/Tauri

**100+ app routes in App.tsx, 84 component directories, 84 stores**

**Known issues:**
- OpenClaw app/store/component still present (cleanup item)
- VMHealth panels reference :18789 gateway
- Unknown how many screens render real data vs placeholder
- Design system consistency unaudited
- ExecutionsApp exists but HQ frontend (Sprint 2) not started per LaunchpadHQ doc

### F. Documentation

| Document | Status |
|----------|--------|
| EMA-FULL-CONTEXT.md | Current (61KB, comprehensive audit) |
| ARCHITECTURE-LOCKED-2026-04-05.md | Current (locked reference) |
| ARCHITECTURE.md | Needs update vs reality |
| DATA_MODELS.md | Needs update (actor model not included) |
| LaunchpadHQ consolidated | Sprint 1 done, Sprint 2 not started |
| CLI BUILD_PLAN.md | Ready to execute |
| docs/cli/command-tree.md | 15 existing + 28 planned |
| 6 design specs (Apr 4-6) | All approved/ready to build |
| 8 feature specs | Exist, status unclear |
| API_CONTRACTS.md | Unknown currency |
| DEV_SETUP/GUIDE/TESTING | Unknown currency |

### G. Engine Bootstrap — Self-Sustaining EMA

| System | Status | Evidence |
|--------|--------|----------|
| Proposal Engine | RUNNING | 10 GenServers, PubSub pipeline wired, seed preflight active |
| Seeds | 4 exist in seeds.exs | Cron schedules: 6h/12h/daily/8h |
| Executions | RUNNING | Dispatcher, Router, IntentFolder, Events |
| Agents | RUNNING | DynamicSupervisor, multi-channel, memory compression |
| Babysitter | RUNNING | 13 files, Discord stream, anomaly scoring |
| Stream Manager | RUNNING | Multi-channel cadence, narrative synthesis |
| Pipes | RUNNING | Registry (22 triggers, 15 actions), 7 stock pipes |
| Second Brain | RUNNING | VaultWatcher, GraphBuilder, SystemBrain |
| Intention Farmer | RUNNING | Session harvesting, startup bootstrap |
| Harvesters | RUNNING | Git, session, vault, usage, brain dump |

**Bootstrap gap:** All systems structurally operational, but unclear if they're producing real output. Need to verify:
- Are seeds actually generating proposals?
- Are proposals flowing through the pipeline?
- Can a proposal be approved and create an execution?
- Is the babysitter posting to Discord?
- Is the intention farmer actually harvesting sessions?

### H. Infrastructure

- Daemon: systemd service at `ema-daemon.service`
- MCP server: `~/bin/ema-mcp-server.js` — payload drift from current controllers unknown
- Python CLI (`bin/ema`): 1927 lines, primary user interface, may have endpoint drift
- Agent-VM: OpenClaw deprecation path unclear

### I. Testing

- 60 test files exist
- Coverage: controllers, channels, core logic (runner, bridge, babysitter)
- Gaps: no E2E tests, proposal→execution→agent pipeline untested, actor model untested

---

## Priority Matrix

| Workstream | Impact | Effort | Dependencies | Priority |
|------------|--------|--------|-------------|----------|
| A. Cleanup | HIGH (blocks all) | MEDIUM | None | 1 |
| B. Data Model verify | MEDIUM | LOW | A (partial) | 1 |
| F. Doc audit | LOW | LOW | None | 1 |
| G. Engine verify | HIGH (self-sustaining) | MEDIUM | A | 2 |
| C. CLI extend | MEDIUM | HIGH | B | 3 |
| E. Frontend fix | MEDIUM | MEDIUM | A | 2 |
| D. TUI | LOW | HIGH | C | 4 |
| I. Testing | MEDIUM | HIGH | All | 5 |
| H. Infrastructure | LOW | MEDIUM | A, G | 4 |

---

## Wave Plan

### Wave 1: Foundations (Parallel)

- [ ] **Agent 1A — OpenClaw Cleanup (Daemon)**: Remove all OpenClaw modules, config refs, adapter, runner. Verify `mix compile` clean.
- [ ] **Agent 1B — OpenClaw Cleanup (Frontend)**: Remove OpenClaw app, store, component, workspace config. Remove :18789 refs from VMHealth.
- [ ] **Agent 1C — Data Model Verification**: Verify all actor model schemas + context modules exist. Seed default human actor. Wire missing controllers/routes.
- [ ] **Agent 1D — Stale File Cleanup**: Delete .bak migration, fix superman.ex warnings, any other dead files.

**Gate:** `mix compile --warnings-as-errors` passes. `mix ecto.migrate` passes. OpenClaw grep returns 0. Frontend builds.

### Wave 2: Surfaces + Engine Verification (Parallel)

- [ ] **Agent 2A — Engine Bootstrap Test**: Verify seeds exist in DB, scheduler is ticking, generator produces proposals. Test full pipeline: seed → proposal → pipeline → approval → execution.
- [ ] **Agent 2B — Frontend Audit**: Audit every screen for real data vs placeholder. Fix broken API calls. Document status. Verify WebSocket connections.
- [ ] **Agent 2C — CLI Consolidation**: Merge EmaCli and Ema.CLI namespaces. Extend with actor model commands. Verify escript build.
- [ ] **Agent 2D — Doc Update**: Update ARCHITECTURE.md and DATA_MODELS.md to match reality. Update command-tree.md.

**Gate:** Engine generates at least 1 proposal. CLI builds and runs. Docs match code.

### Wave 3: Coverage + Bootstrap (Parallel)

- [ ] **Agent 3A — CLI Batch A-C**: brain-dump, exec, goal, habit, journal, responsibility, seed, engine, pipe, campaign, evolution
- [ ] **Agent 3B — CLI Batch D-F**: channel, session, superman, intent, gap, memory, metamind, provider, tokens, babysitter, project, org, space, config, status, watch, dispatch, em, tag, data, actor
- [ ] **Agent 3C — Agent Self-Work**: Register ema-dev agent actor. Create self-improvement seeds. Bootstrap self-work pipeline.
- [ ] **Agent 3D — Babysitter Verification**: Verify Discord webhooks configured. Test stream posting. Verify cadence.

**Gate:** CLI covers all domains. Self-improvement agent registered. Babysitter posting.

### Wave 4: Integration + Polish

- [ ] **Agent 4A — E2E Flow Test**: Full flow verification across all integration points.
- [ ] **Agent 4B — MCP Server Sync**: Compare ~/bin/ema-mcp-server.js against current controllers. Fix drift.
- [ ] **Agent 4C — LaunchpadHQ Doc Finalization**: Complete Sprint 2 planning. Update consolidated doc.

**Gate:** All systems verified. Docs current. MCP server aligned.

---

## Open Questions

1. Is the babysitter actually posting to Discord, or are webhook URLs missing/stale?
2. Are seeds in the DB or only in seeds.exs (has `mix run priv/repo/seeds.exs` been run)?
3. What's the actual state of the Python CLI endpoint compatibility with current controllers?
4. Should OpenClaw adapter be fully removed or kept as a stub for future gateway use?
5. Which frontend screens are actually broken vs just showing empty state?

## Decisions Made

1. **ADR-001**: Reuse existing `Ema.CLI`, consolidate into single entry point (from docs/cli/decisions/)
2. **ADR-002**: Remove OpenClaw — delete standalone modules, replace fallback paths with local dispatch
3. **Migration fix**: `:cascade` → `:delete_all` in Ecto references (3 migrations fixed)
4. **Table name fix**: `brain_dump_items` → `inbox_items` in actor_id migration
5. **Actor model**: All 7 migrations passing, tables created
