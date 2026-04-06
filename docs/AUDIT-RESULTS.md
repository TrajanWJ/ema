# EMA Documentation Audit Results

**Date:** 2026-04-06
**Scope:** Every `.md` file in `docs/`, `docs/superpowers/`, `docs/planning/`, `docs/cli/`, `docs/features/`, `docs/schemas/`, `docs/security/`, `docs/researcher/`, `docs/archived/`; wiki Architecture pages; codebase spot-checks.

---

## 1. Stale / Incorrect Docs

### CRITICAL — Will actively mislead any reader

| Doc | What's Wrong |
|-----|-------------|
| **`docs/CONTRADICTIONS-AUDIT-2026-04-04.md`** | Claims harvesters `vault_harvester.ex`, `usage_harvester.ex`, `brain_dump_harvester.ex` are "missing module files entirely." All three now exist in `daemon/lib/ema/harvesters/`. Claims `ai_backend: :runner` is the default; config now says `ai_backend: :bridge`. This doc is 2 days stale and several of its "Critical" findings are resolved. |
| **`docs/PAP.md`** | Describes EMA as a "five-module Claude AI integration system" with features F1-F5 as "Design Posture Dashboard, Claude Bridge, DCC Context Store, Quality Pipeline, CLI Mirror." This describes a much earlier, narrower architecture. References `dashboard_live.ex` (LiveView) which doesn't match the REST+channel reality. Phase 2 "In Progress" items like Intelligence.Router, CampaignManager, and Domain Agents (Strategist, Coach, Archivist) are from a different era of planning. |
| **`docs/archive/place-native-design-2026-03-29.md`** | This is a predecessor project spec for "place-native" targeting KDE Neon with `~/.local/share/place-native/`. Already flagged in CLAUDE.md as historical artifact. Should be moved to archive if not already ignored. |
| **Wiki: `Architecture/EMA-Overview.md`** | Describes agent-vm topology as the primary system: "EMA Daemon runs on agent-vm at 192.168.122.10:4488." Reality: host daemon at localhost:4488 is the real system (confirmed in the doc itself, but the overview still leads with the VM topology). States "29 Implemented Endpoints" — reality is 461+ REST routes. Lists "17 GenServers" — reality is 111. States "Code Exists But Can't Operate (no Ecto tables)" for proposals, pipes, agents, etc. — but these all have tables now (95+ migrations run on host). The "Not Implemented" section lists Intent system as "zero code" — but `daemon/lib/ema/intents/` now has a full implementation (5 files). |
| **Wiki: `Architecture/Proposal-Pipeline.md`** | States "Code Exists, Not Operational" and "cannot operate yet because the Ecto database has no tables (zero migrations run)." This is completely wrong for the host daemon which has 95+ migrations and a working proposal pipeline. |
| **Wiki: `Architecture/Dispatch-Engine.md`** | Describes a bash + cron dispatch engine on the agent-vm as "the real execution system." This is the legacy VM system. The host-based Elixir `Ema.Executions.Dispatcher` is the current target. The bash dispatch engine is being migrated away. |
| **Wiki: `Architecture/Execution-System.md`** | Still describes "Path 1: Dispatch Engine (Primary)" as the bash cron system. The Elixir execution system is now primary. Also references `--permission-mode bypassPermissions` for Claude sessions (security concern — contradicts `SECURITY_DESIGN.md` which says EMA only uses `--print`). |

### SIGNIFICANT — Outdated counts, misleading details

| Doc | What's Wrong |
|-----|-------------|
| **`docs/IMPLEMENTATION_ROADMAP.md`** | Lists "350+ REST API endpoints across 50+ controllers" but `BUILD_PLAN.md` says 461+. Lists "60+ Zustand stores" and "28 stores loaded in parallel" but counts vary between docs (67, 84 in different documents). Phase 2 status table is stale — e.g., "Decision Memory: Schema only" but `SessionMemory`, `GitWatcher`, and `WikiSync` modules exist. |
| **`docs/FEATURES.md`** | Comprehensive but several "Current Status" and "Next Steps" sections are stale. E.g., says Scorer is "working" but the cosine similarity dedup needs a vector store that may not be running. Lists harvesters as "designed but not implemented" — they now exist. |
| **`docs/API_CONTRACTS.md`** | Describes an API surface for F1-F5 features that uses different endpoint patterns than what the actual router implements. E.g., specifies `GET /api/intent` for intent nodes but actual routes may differ (newer `Ema.Intents` context has its own controller `IntentsController`). References `Ema.Intelligence.SupermanContinuityHook` and `SessionManager` methods that aren't confirmed to exist. References MCP server at `daemon/priv/mcp/wiki-mcp-server.js` (does exist). |
| **`docs/INTEGRATION_GUIDE.md`** | Specifies code to build (SupermanContinuityHook, Generator.regenerate/2, SmartRouter PubSub wiring) that may or may not have been built. The "Checklist: What Coder Needs to Build" section needs verification against actual code. |
| **`docs/DEV_SETUP.md`** | Says "pnpm >= 9" but `CLAUDE.md` doesn't confirm pnpm is actually used (npm appears in many examples). Health check endpoint listed as `GET /api/vm/health` — actual route may differ. |
| **`docs/MONITORING.md`** | References `Ema.Intelligence.VmMonitor` which monitors a VM at 192.168.122.10 — this is the agent-vm, not the host system. The monitoring is misaligned with the host-first architecture. |
| **`docs/TESTING.md`** | References `mix test.watch` requiring `mix_test_watch` dep — not confirmed as installed. References CI at `.github/workflows/ci.yml` (exists). Factory module at `test/support/factory.ex` is aspirational — may not exist. |
| **`docs/DEPLOYMENT.md`** | References `scripts/smoke-test.sh` (exists). References `pkill beam.smp` for daemon restart — crude. References `ema_dev.db` as DB filename (correct for dev). Generally accurate but references `systemd user service` for daemon startup that likely doesn't exist. |

### MINOR — Small inaccuracies

| Doc | What's Wrong |
|-----|-------------|
| **`docs/CLI.md`** | References an escript-based CLI with `ema intent search`, `ema proposal list`, etc. Two CLI namespaces exist (`EmaCli.CLI` and `Ema.CLI`) per `BUILD_PLAN.md`. Python CLI at `bin/ema` (1927 lines) is also mentioned as primary user-facing. Status markers (implemented/stub/not implemented) need re-verification. |
| **`docs/EMA-CLI-REFERENCE.md`** | References `mix escript.build` for installation. May be outdated if the CLI has been restructured. |
| **`docs/BABYSITTER_CHANNELS.md`** | Appears current and well-maintained. References specific Discord channel IDs and the canonical topology source file. |

---

## 2. Unbuilt Features from Specs

### From `ARCHITECTURE-LOCKED-2026-04-05.md` (highest authority)

| Feature | Spec Location | Current State |
|---------|--------------|---------------|
| **Governance module** (`Ema.Governance`) | `docs/ARCHITECTURE-LOCKED-2026-04-05.md` sec 4 | No `governance.ex` or `governance/` directory found. Specced as ~80 lines with `check_dispatch/1` and `maybe_auto_approve/2`. Three starter policies defined. |
| **Auto-approval for proposals** | Same, sec 4C | Not implemented. `requires_approval` defaults to `true` everywhere, with no governance policy engine to override. |
| **`executions:create` pipe action** | Same, sec 2 | Not confirmed in Pipes.Registry stock actions. Needed to complete the responsibility-to-execution flow. |

### From `2026-04-06-intent-engine-design.md` + `INTENT-ENGINE-FEATURES.md`

| Feature | Status |
|---------|--------|
| **Intent Projector GenServer** | Spec'd to generate `vault/intents/by-project/`, `by-level/`, `by-status/` markdown. Directory structure exists but no projector code. |
| **WebSocket channel for intents** | PubSub broadcasts exist on `"intents"` topic but no `IntentChannel` module. Frontend can't get real-time intent updates. |
| **Intent frontend (Wikipedia-style UI)** | No React components for intents in `app/src/`. |
| **CLI `link` subcommand route** | CLI `handle([:link], ...)` posts to `/intents/:id/links` but no such route exists in the router. |
| **MCP tool `ema_create_intent` payload mismatch** | Posts `%{intent: payload}` but controller reads params directly. |
| **Vault convergence** | Merging VaultIndex/Notes/SecondBrain with Intents — not started. |

### From `2026-04-06-workspace-executive-planes-design.md`

| Feature | Status |
|---------|--------|
| **Actor/Container system** | Migrations exist (7 new tables including `actors`, `tags`, `entity_data`, `container_config`). Ecto schemas and context modules NOT confirmed to exist. Default "human" actor not seeded. Controllers and routes not wired. |
| **Agent organic phase cadence** | Spec'd (simulated weeks for agents). No implementation found. |
| **Personal spaces without orgs** | Requires `org_id` nullable change — migration may exist but schema enforcement not verified. |

### From `2026-04-05-intention-backlog-farmer-design.md`

| Feature | Status |
|---------|--------|
| **IntentionFarmer subsystem** | `daemon/lib/ema/intention_farmer/` has 14 files. Appears substantially built. Batch bootstrapper + incremental watcher + parser + cleaner + loader architecture. |
| **Codex CLI session parsing** | Spec'd but unclear if parser handles Codex format in practice. |

### From `2026-04-05-session-onboarding-self-bootstrap-design.md`

| Feature | Status |
|---------|--------|
| **Boot Orchestrator** (`Ema.Onboarding.Orchestrator`) | No `onboarding/` directory found. The full boot sequence (Scanner → IntentionFarmer → Harvesters → WikiWriter → KnowledgeGraph → broadcast) is unbuilt. |
| **Data Import Pipeline** | `Ingestor` described as "40% stub." DataImport.Detector not found. |
| **WikiWriter** | Module for creating vault notes from harvested intents — not found. |

### From `2026-04-04-ema-plugin-architecture.md`

| Feature | Status |
|---------|--------|
| **Plugin system** | Entire spec is unbuilt. OTP Application plugin model, `ema_plugin.json` manifest, ETS-backed hot registration, hook system — none exists. |

### From `FEATURES.md` Next Steps sections

| Feature | Source Section |
|---------|--------------|
| Remaining agent tools (tasks:create, vault:create_note, proposals:create_seed) | Feature 1 (Execution Fabric) |
| Harvester GenServers integration | Feature 1 |
| Result review UI | Feature 1 |
| Genealogy DAG visualization (react-force-graph-2d) | Feature 8 (Project Graph) |
| Unified cross-entity graph API | Feature 8 |
| Auto-approve threshold | Feature 3 (Proposal Intelligence) |
| Outcome feedback loop | Feature 3 |
| Pattern detection in evolution scan | Feature 7 (Pattern Crystallizer) |
| Precedent surfacing for decisions | Feature 4 (Decision Memory) |
| Swimlane visualization for intents | Feature 5 (Intent-Driven Analysis) |

### From Security specs (`docs/security/`)

| Feature | Status |
|---------|--------|
| **Audit log system** (`Ema.Audit.Event` schema, `audit_events` table) | `daemon/lib/ema/intelligence/audit_log.ex` exists but full `Ema.Audit` context with the schema from `AUDIT_LOG_SPEC.md` is not confirmed. No migration for `audit_events` table verified. |
| **Input sanitization for harvesters** | Spec'd in THREAT_MODELS.md and SECURITY_DESIGN.md. Not verified as implemented in actual harvester code. |
| **Rate limiting on pipe executor** | Spec'd (10 per pipe per minute, 100 total). Not verified in code. |
| **Claude CLI hardening checks** | Tests spec'd (`test "Claude.Runner never calls claude with dangerous flags"`) — not confirmed to exist. |

---

## 3. High-Value Tasks to Queue (Prioritized)

### P0 — Blocking core loop

1. **Build `Ema.Governance` module** (~80 lines per locked architecture). Without this, no auto-approval works, and `requires_approval: true` means every execution needs manual click. This is the single biggest bottleneck to the autonomous loop.

2. **Wire proposal approval to execution dispatch end-to-end.** `PASSOVER-2026-04-05.md` flags (Y2): "Approved proposals dispatch nowhere." Verify that `Proposals.approve_proposal/1` actually creates an Execution and the Dispatcher picks it up. If the PubSub wiring is broken, the entire core loop stalls.

3. **Add `executions:create` pipe action to Registry.** Needed for responsibility-to-execution and pipe-triggered execution flows. Without it, responsibilities generate tasks that go nowhere.

### P1 — High-impact user-facing

4. **Implement remaining agent tools.** Priority: `tasks:create` (most common), `vault:create_note`, `proposals:create_seed`. Agent trust erosion is the #1 UX risk (agent claims to create task but can't).

5. **Fix 7 dead WebSocket channel topics.** Frontend stores join channels that don't exist: `intelligence:tokens`, `intelligence:vm`, `jarvis:lobby`, `prompts:lobby`, `decisions:lobby`, `pipeline:lobby`, `project_graph:lobby`. Each gets a silent Phoenix join error.

6. **Add IntentChannel for real-time intent updates.** Populator broadcasts on `"intents"` PubSub but no Phoenix Channel forwards these to the frontend.

7. **Run the intent engine migration against live DB.** `20260412000012_create_intents_engine.exs` has not been applied. The intent system can't operate until this runs.

### P2 — Documentation health

8. **Update wiki Architecture pages.** Five of eleven wiki Architecture pages describe the agent-vm as primary and state the host daemon has no tables. This is severely wrong and will mislead every agent that reads these pages.

9. **Archive or clearly mark stale docs.** `PAP.md` describes a different project. `CONTRADICTIONS-AUDIT-2026-04-04.md` has multiple resolved findings. `IMPLEMENTATION_ROADMAP.md` has stale phase 2 status.

10. **Update CLAUDE.md counts.** Still says "15 stores" and "13 apps." Reality: 67-84 stores, 50+ apps, 78 controllers. Already flagged in contradictions audit but not fixed.

### P3 — System hardening

11. **Verify Bridge actually starts under `ai_backend: :bridge`.** Config says `:bridge` now but `PASSOVER-2026-04-05.md` (R1) says Bridge GenServer still falls back to Runner when unavailable. Confirm `BridgeSupervisor` is in the boot sequence and its children start.

12. **Fix OpenClaw streaming adapter.** `ClaudeCli.stream/4` is called but doesn't exist. Any streaming path through OpenClaw crashes.

13. **Fix SecondBrain.Indexer DB connection race.** 3 test failures from SQLite connection ownership. Task.Supervised processes lose connection mid-transaction.

14. **Standardize vault path resolution.** Four different methods (`compile_env`, `get_env`, `System.get_env`, hardcoded). Create `Ema.Config.vault_path/0` and use it everywhere.

### P4 — Feature completion

15. **Build Onboarding Orchestrator** for boot-time session harvesting and knowledge graph population.

16. **Build `GlassCard` component** to eliminate CSS glass-tier inconsistencies.

17. **Add keyboard shortcuts for proposal triage** (J/K/G/Y/R). Highest UX improvement per researcher UX audit.

18. **Build daily digest / morning briefing view** on Launchpad.

19. **Consolidate VaultIndex + Notes into SecondBrain.** Long-standing tech debt.

---

## 4. Contradictions Found

### Between docs

| Contradiction | Docs Involved |
|---------------|--------------|
| `ai_backend` config: `:runner` vs `:bridge` | `CONTRADICTIONS-AUDIT-2026-04-04.md` says `:runner`. Actual `config.exs` now says `:bridge`. `PASSOVER-2026-04-05.md` says `:bridge` but notes Bridge falls back to Runner. |
| Harvester existence | `CONTRADICTIONS-AUDIT` says 3 harvesters missing. All 5 now exist in `daemon/lib/ema/harvesters/`. |
| Store count | CLAUDE.md: "15 stores". IMPLEMENTATION_ROADMAP: "60+". BUILD_PLAN: "84". PASSOVER: "67". Actual count varies by source. |
| App count | CLAUDE.md: "13 apps". CONTRADICTIONS-AUDIT: "~50". BUILD_PLAN: "84 component directories". |
| Proposal approval effect | CLAUDE.md: "approve -> Task". ARCHITECTURE-LOCKED: "approve -> Execution -> Dispatch". CONTRADICTIONS-AUDIT: "approve -> Execution". PASSOVER: "Approved proposals dispatch nowhere (Y2)." |
| Intent system status | Wiki Architecture/EMA-Overview: "Not Implemented — zero code." INTENT-ENGINE-FEATURES.md: Full schema + context + populator + migration + import script. |
| Pipeline operational status | Wiki Proposal-Pipeline: "Code Exists, Not Operational (no tables)." FEATURES.md + IMPLEMENTATION_ROADMAP: "Working — full pipeline wired via PubSub." |
| Dispatch engine role | Wiki Dispatch-Engine and Execution-System: "bash dispatch is primary." ARCHITECTURE-LOCKED: Elixir Dispatcher is the canonical path. |
| Claude CLI flags | SECURITY_DESIGN: "EMA only calls Claude with `--print` flag." Wiki Execution-System: References `--permission-mode bypassPermissions`. |

### Between docs and code

| Contradiction | Details |
|---------------|---------|
| `INTEGRATION_GUIDE.md` checklist items | Lists modules to build (SupermanContinuityHook, Generator.regenerate/2, SmartRouter PubSub subscription). Status against actual code unverified. |
| `TESTING.md` factory module | Describes `test/support/factory.ex` but this is aspirational — may not exist. |
| `MONITORING.md` VmMonitor target | Monitors 192.168.122.10 (agent-vm). Host-first architecture means this should monitor localhost or be restructured. |
| `API_CONTRACTS.md` endpoint patterns | Specifies `GET /api/intent` for intent nodes. New intents system likely uses `GET /api/intents` (plural, different controller). Two intent systems coexist (old `IntentMap` + new `Intents`). |

---

## 5. Wiki Pages That Need Updating

| Page | Priority | What Needs Changing |
|------|----------|-------------------|
| **`Architecture/EMA-Overview.md`** | **CRITICAL** | Rewrite to reflect host-first architecture. Update endpoint count (29 -> 461+), GenServer count (17 -> 111+), table count, and remove "Code Exists But Can't Operate" section. Update "Not Implemented" section (intent system now exists). |
| **`Architecture/Proposal-Pipeline.md`** | **CRITICAL** | Remove "Code Exists, Not Operational" framing. Pipeline is operational on host daemon with 95+ migrations. |
| **`Architecture/Dispatch-Engine.md`** | **HIGH** | Mark as legacy system. Note that Elixir `Ema.Executions.Dispatcher` is the target execution path. Bash dispatch is being migrated. |
| **`Architecture/Execution-System.md`** | **HIGH** | Reorder paths: Elixir execution (Dispatcher + AgentSession) is Path 1. Bash dispatch is Path 2 (legacy). Remove `--permission-mode bypassPermissions` reference or flag as security concern. |
| **`Architecture/Intent-System.md`** | **MEDIUM** | This page was recently updated and is mostly accurate. Verify it reflects the actual `Ema.Intents` implementation (5 files in `daemon/lib/ema/intents/`). Confirm bootstrap scope matches what's built. |
| **`Architecture/AI-Providers.md`** | **LOW** | Model names may need updating. Provider status (e.g., Codex CLI "Installed", OpenClaw "Active (VM)") should reflect current reality. |
| **`Architecture/Orchestrator.md`** | **LOW** | Generally accurate description of SmartRouter. May need Bridge startup status clarification. |
| **`Architecture/MCP-Topology.md`** | **LOW** | References "OpenClaw VM" as a node. If OpenClaw is being deprecated or restructured, update. |
| **`Architecture/Babysitter-System.md`** | **OK** | Appears current. No changes needed. |
| **`Architecture/Autonomous-Loops.md`** | **OK** | Pattern documentation. Timeless. No changes needed. |
| **`Architecture/Stream-of-Consciousness.md`** | **NOT READ** | Should be checked but not critical. |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Total docs audited | 70+ |
| Critically stale docs | 7 |
| Significantly outdated docs | 8 |
| Unbuilt features from specs | 30+ |
| Active contradictions between docs | 9 |
| Contradictions between docs and code | 4 |
| Wiki pages needing update | 6 (4 critical/high) |
| P0 tasks identified | 3 |
| P1 tasks identified | 4 |
| Total actionable tasks | 19 |

---

## Appendix: Docs Not Read (Low Priority)

These were skipped or only partially read due to size:

- `docs/superpowers/specs/2026-03-30-ema-engine-design.md` (34K tokens — too large)
- `docs/superpowers/plans/2026-03-29-ema-implementation.md` (35K tokens — too large)
- `docs/superpowers/plans/2026-03-29-ema-multiwindow-implementation.md` (19K tokens — too large)
- `docs/archived/*.md` (historical build logs — low priority)
- `docs/features/FEATURE_*.md` (8 files — summaries covered in FEATURES.md)
- `docs/schemas/*.md` (3 files — schema definitions, likely accurate)
- `docs/W7-*.md` (6 files — sprint result logs)
- `docs/SETUP.md`, `docs/EMA-FULL-CONTEXT.md`, `docs/BUILD_RESULT*.md`, `docs/FRONTEND_AUDIT.md`, `docs/INTEGRATION_AUDIT.md`, `docs/DATA_MODELS.md`, `docs/ARCHITECTURE.md`
- `docs/cli/BUILD_RESULT.md`, `docs/cli/BUILD_PLAN.md`, `docs/cli/changelog.md`, `docs/cli/command-tree.md`, `docs/cli/decisions/*.md`
