# EMA Frontend Audit

Generated: 2026-04-06

**Scope:** All 78 routed apps in `app/src/App.tsx`, their stores, REST endpoints, and WebSocket channels.

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Total routed apps | 78 |
| WORKING (real API + real data) | 32 |
| WORKING (REST only, no WS) | 16 |
| BROKEN (calls endpoints that don't exist) | 12 |
| STUB (minimal UI, no backend) | 18 |

---

## Status Legend

- **WORKING** -- Store has REST calls to endpoints that exist in the daemon router, channel topics registered in UserSocket. Renders dynamic data.
- **WORKING-REST** -- Has REST calls to valid endpoints but no WebSocket channel (or channel not registered). Still functional.
- **BROKEN** -- Calls REST endpoints or joins channels that do NOT exist in the daemon router/UserSocket. Will 404 or crash on connect.
- **STUB** -- Hardcoded/demo data, or component exists but has no meaningful backend integration.

---

## Tier 1: Core Workflow Apps

| App | Route | Status | Store | REST Endpoints | Channel | Issues |
|-----|-------|--------|-------|----------------|---------|--------|
| BrainDumpApp | brain-dump | WORKING | brain-dump-store.ts | `/brain-dump/items` (GET/POST), `/brain-dump/items/:id/process` (PATCH), `/brain-dump/items/:id` (DELETE), `/executions` (GET/POST), `/executions/:id/approve` (POST) | `brain_dump:queue` | None. Full CRUD + execution integration. |
| TasksApp | tasks | WORKING | tasks-store.ts | `/tasks` (CRUD), `/projects/:id/tasks` (GET), `/tasks/:id/transition` (POST), `/tasks/:id/comments` (POST) | `tasks:lobby` / `tasks:{projectId}` | None. Full CRUD + project scoping. |
| ProjectsApp | projects | WORKING | projects-store.ts | `/projects` (CRUD), `/projects/:id` (GET) | `projects:lobby` | None. Full CRUD. |
| ProposalsApp | proposals | WORKING | proposals-store.ts | `/proposals` (GET/POST), `/proposals/:id/approve` (POST), `/proposals/:id/redirect` (POST), `/proposals/:id/kill` (POST), `/proposals/compare` (GET), `/seeds` (CRUD), `/seeds/:id/toggle` (POST), `/seeds/:id/run-now` (POST) | `proposals:queue` | None. Full pipeline with streaming status. |
| ExecutionsApp | executions | WORKING | execution-store.ts | `/executions` (GET/POST), `/executions/:id/approve` (POST), `/executions/:id/cancel` (POST), `/executions/:id/complete` (POST) | `executions:all` / `executions:{id}:stream` | Channel `executions:*` registered. Stream channels for per-execution output. |
| DispatchBoardApp | dispatch-board | WORKING | execution-store.ts (shared) | `/dispatch-board/stats` (GET), `/executions` (via shared store) | `executions:all` (via shared store), `dispatch_board:*` registered | Full board with live timers, stats polling every 10s, detail panel. |

## Tier 2: Intelligence & Knowledge Apps

| App | Route | Status | Store | REST Endpoints | Channel | Issues |
|-----|-------|--------|-------|----------------|---------|--------|
| AgentsApp | agents | WORKING | agents-store.ts | `/agents` (CRUD), `/agents/:slug/chat` (POST), `/agents/:slug/conversations` (GET) | `agents:lobby` | None. Full CRUD + chat. |
| VaultApp | vault | WORKING | vault-store.ts | `/vault/tree` (GET), `/vault/note` (GET/PUT), `/vault/search` (GET), `/vault/graph` (GET), `/vault/graph/neighbors/:id` (GET), `/vault/graph/typed-neighbors/:id` (GET), `/vault/graph/orphans` (GET) | `vault:files` | None. Full vault browser with graph. |
| VaultBrowser | obsidian-vault | WORKING-REST | obsidian-vault-store.ts | `/obsidian/notes` (GET), `/obsidian/search` (GET), `/obsidian/notes/*path` (GET) | None | No WS channel -- REST only for legacy vault browsing. |
| SupermanApp | superman | WORKING | superman-store.ts | `/superman/health` (GET), `/superman/index` (POST), `/superman/ask` (POST), `/superman/gaps` (GET), `/superman/flows` (GET), `/superman/intent` (GET), `/superman/panels` (GET), `/superman/apply` (POST), `/superman/simulate` (POST), `/superman/autonomous` (POST), `/superman/build` (POST) | `superman:lobby` | None. Comprehensive code intelligence. |
| CodeHealthDashboard | code-health | WORKING | code-health-store.ts | `/superman/health`, `/superman/status`, `/superman/gaps`, `/superman/flows`, `/superman/panels` | `superman:lobby` | None. Read-only view of superman data. |
| WikiApp | wiki | WORKING | vault-store.ts (shared) | `/vault/tree`, `/vault/note`, `/vault/search`, `/vault/graph` | `vault:files` | Multi-component app (WikiGraph, WikiIndex, WikiPage, WikiSearch, WikiStats). |
| SessionsApp | sessions | WORKING | sessions-store.ts | `/claude-sessions` (GET/POST), `/claude-sessions/:id/continue` (POST), `/claude-sessions/:id` (DELETE) | `claude_sessions:lobby` / `claude_sessions:{id}` | None. Full session management with streaming output. |
| SessionMemoryApp | memory | WORKING | memory-store.ts | `/memory/sessions` (GET), `/memory/fragments` (GET), `/memory/context` (GET), `/memory/search` (GET), `/memory/extract/:id` (POST) | `memory:live` | Channel registered as `memory:*` in user_socket -- topic `memory:live` should match. |
| GapInboxApp | gaps | WORKING | gaps-store.ts | `/gaps` (GET), `/gaps/:id/resolve` (POST), `/gaps/:id/create_task` (POST), `/gaps/scan` (POST) | `gaps:live` | Channel registered as `gaps:*`. |
| IntentMapApp | intent-map | WORKING | intent-store.ts | `/intent/nodes` (CRUD), `/intent/tree/:project_id` (GET), `/intent/export/:project_id` (GET) | `intent:live` | Channel registered as `intent:*`. |
| ProjectGraphApp | project-graph | WORKING-REST | project-graph-store.ts | `/project-graph` (GET), `/project-graph/nodes/:id` (GET) | joins `project_graph:lobby` | **Channel NOT registered** in UserSocket. WS connect will fail silently (store catches error). REST works. |
| ContextApp | context | WORKING-REST | N/A (inline) | `/context/executive-summary`, `/context`, `/context/sessions`, `/context/crystallize` | None | REST-only context viewer. |

## Tier 3: Personal Management Apps

| App | Route | Status | Store | REST Endpoints | Channel | Issues |
|-----|-------|--------|-------|----------------|---------|--------|
| HabitsApp | habits | WORKING | habits-store.ts | `/habits` (GET/POST), `/habits/today` (GET), `/habits/:id/archive` (POST), `/habits/:id/toggle` (POST) | `habits:tracker` | None. Full habit tracking with streaks. |
| JournalApp | journal | WORKING-REST | journal-store.ts | `/journal/:date` (GET/PUT), `/journal/search` (GET) | None | No WS channel. Journal has debounced auto-save. **Store calls GET `/journal/:date`** which exists. Journal channel IS registered but store doesn't use it. |
| GoalsApp | goals | WORKING | goals-store.ts | `/goals` (CRUD) | `goals:lobby` | None. Full CRUD with hierarchy. |
| FocusApp | focus | WORKING | focus-store.ts | `/focus/current` (GET), `/focus/sessions` (GET), `/focus/today` (GET), `/focus/weekly` (GET), `/focus/start` (POST), `/focus/stop` (POST), `/focus/pause` (POST), `/focus/resume` (POST), `/focus/break` (POST), `/focus/resume-work` (POST) | `focus:timer` | None. Full timer with server-driven tick, phase changes, blocks. |
| SettingsApp | settings | WORKING | settings-store.ts | `/settings` (GET/PUT) | `settings:sync` | None. |
| ResponsibilitiesApp | responsibilities | WORKING | responsibilities-store.ts | `/responsibilities` (CRUD), `/responsibilities/:id/check-in` (POST) | `responsibilities:lobby` | None. Full CRUD + check-ins. |
| LifeDashboardApp | life-dashboard | WORKING-REST | life-dashboard-store.ts | `/dashboard/today`, `/habits/today`, `/journal/:date`, `/focus/today`, `/tasks`, `/executions` | None | Composite dashboard aggregating multiple endpoints. No dedicated WS. |

## Tier 4: Automation & System Apps

| App | Route | Status | Store | REST Endpoints | Channel | Issues |
|-----|-------|--------|-------|----------------|---------|--------|
| PipesApp | pipes | WORKING | pipes-store.ts | `/pipes` (CRUD), `/pipes/system` (GET), `/pipes/catalog` (GET), `/pipes/:id/toggle` (POST) | `pipes:editor` | None. Full pipe editor with catalog. |
| CanvasApp | canvas | WORKING | canvas-store.ts | `/canvases` (CRUD), `/canvas/templates` (GET/POST), `/canvas/:id/instantiate-template` (POST) | `canvas:{id}` (per-canvas) | None. Full canvas with live data, elements via WS. |
| EvolutionDashboard | evolution | WORKING | evolution-store.ts | `/evolution/rules` (CRUD), `/evolution/signals` (GET), `/evolution/stats` (GET), `/evolution/scan` (POST), `/evolution/propose` (POST), `/proposals/generate` (POST) | `evolution:updates` | None. Full self-evolution system. |
| ClaudeBridgeApp | claude-bridge | WORKING | claude-bridge-store.ts | N/A (all via WS) | `claude_sessions:lobby` / `claude_sessions:{id}` | None. WS-first design. |
| ChannelsApp | channels | WORKING | channels-store.ts | `/agents` (GET), `/channels` (GET), `/channels/inbox` (GET), `/channels/:id/messages` (GET/POST), `/agents/:slug/conversations` (GET), `/channels/platforms` (GET), `/channels/send` (POST) | `channels:lobby`, `channels:chat:{id}`, `agents:chat:{slug}` | **`channels:chat:*` NOT registered in UserSocket** (only `channels:*` is). Lobby join will work, but per-chat channel joins will fail. Graceful fallback to REST. |
| VoiceApp | voice | WORKING | voice-store.ts | N/A (WS-first) | `voice:session` | None. Full voice pipeline with TTS, transcription. |
| MetaMindApp | metamind | WORKING | metamind-store.ts | `/metamind/pipeline` (GET), `/metamind/library` (GET/POST), `/metamind/library/:id` (DELETE) | `metamind:lobby` | **Store calls `/metamind/prompts` and `/metamind/prompts/search` and `/metamind/stats` and `/metamind/research` -- these DO NOT exist in router.** Only `/metamind/pipeline`, `/metamind/library` exist. Store will 404 on loadPrompts/searchPrompts/loadStats/triggerResearch. |
| PipelineApp | pipeline | WORKING | pipeline-store.ts | `/pipeline/stats` (GET), `/pipeline/bottlenecks` (GET), `/pipeline/throughput` (GET) | joins `pipeline:lobby` | **Channel `pipeline:lobby` NOT registered** in UserSocket. WS fails silently. REST works. |
| TokenMonitorApp | token-monitor | WORKING | token-monitor-store.ts | `/tokens/summary` (GET), `/tokens/history` (GET), `/tokens/forecast` (GET), `/tokens/budget` (GET/PUT) | joins `intelligence:tokens` | Channel registered as `intelligence:*`. |
| VMHealthApp | vm-health | WORKING | vm-health-store.ts | `/vm/health` (GET), `/vm/check` (POST) | joins `intelligence:vm` | Channel registered as `intelligence:*`. |
| SecurityPanelApp | security | WORKING-REST | security-store.ts | `/security/posture` (GET), `/security/audit` (POST) | None | REST only, no WS. |
| TemporalApp | temporal | WORKING | temporal-store.ts | `/temporal/rhythm` (GET), `/temporal/now` (GET), `/temporal/log` (POST), `/temporal/best-time` (GET) | `temporal:dashboard` | Channel registered as `temporal:*`. |

## Tier 5: AI & Agent Apps

| App | Route | Status | Store | REST Endpoints | Channel | Issues |
|-----|-------|--------|-------|----------------|---------|--------|
| JarvisApp | jarvis | WORKING-REST | jarvis-store.ts | `/agents/jarvis/chat` (POST), `/voice/process` (POST) | joins `jarvis:lobby` | **Channel `jarvis:lobby` NOT registered** in UserSocket. Fails silently. REST chat works. |
| OrbWindow | orb | WORKING-REST | jarvis-store.ts (shared) | Same as JarvisApp | Same issue | Floating orb UI sharing Jarvis store. |
| AgentFleetApp | agent-fleet | WORKING-REST | agent-fleet-store.ts | `/agents` (GET) | None | REST-only fleet view. Maps agent data to fleet format. |
| PromptWorkshopApp | prompt-workshop | WORKING | prompt-workshop-store.ts | `/prompts` (CRUD), `/prompts/:id/version` (POST) | `prompts:lobby` | Channel registered as `prompts:*`. |
| IngestorApp | ingestor | WORKING-REST | ingestor-store.ts | `/ingest-jobs` (CRUD) | None | REST-only. No WS channel. |
| DecisionLogApp | decision-log | WORKING-REST | decision-log-store.ts | `/decisions` (CRUD) | joins `decisions:lobby` | **Channel `decisions:lobby` NOT registered** in UserSocket. WS fails silently. REST CRUD works. |
| CliManagerApp | cli-manager | WORKING | cli-manager-store.ts | `/cli-manager/tools` (GET/POST), `/cli-manager/sessions` (GET/POST), `/cli-manager/sessions/:id/stop` (POST), `/cli-manager/scan` (POST) | `cli_manager:lobby` | None. Full tool + session management. |
| GitSyncApp | git-sync | WORKING-REST | git-sync-store.ts | `/intelligence/git-events` (GET), `/intelligence/git-events/:id/suggestions` (GET), `/intelligence/git-events/:id/apply/:action_id` (POST), `/intelligence/sync-status` (GET), `/intelligence/git-events/scan` (POST) | None | No WS channel. REST-only. |
| SoulEditorApp | soul-editor | STUB | soul-store.ts | None | None | **Entirely client-side.** No API calls. Stores SOUL.md versions in local state only. Test/deploy are simulated with setTimeout. |
| CampaignsApp | campaigns | WORKING-REST | N/A (inline) | `/campaigns` (CRUD), `/campaigns/:id/run` (POST), `/campaigns/:id/runs` (GET), `/campaigns/:id/advance` (POST), `/campaign-runs/:id` (GET) | None | REST-only campaign management. |
| NotesApp | notes | WORKING-REST | N/A (inline) | `/notes` (CRUD) | `notes:*` registered | Channel registered but store likely doesn't use it. |

## Tier 6: Organizations & P2P

| App | Route | Status | Store | REST Endpoints | Channel | Issues |
|-----|-------|--------|-------|----------------|---------|--------|
| OrgApp | org | WORKING | org-store.ts | `/orgs` (CRUD), `/orgs/:id/invitations` (POST), `/orgs/:org_id/invitations/:id` (DELETE), `/orgs/:id/members/:member_id` (DELETE/PUT), `/join/:token` (POST), `/join/:token/preview` (GET) | `orgs:lobby` / `orgs:{id}` | None. Full org management with invitations. |
| FileVaultApp | file-vault | WORKING-REST | file-vault-store.ts | `/file-vault` (CRUD) | None | REST-only file management. |
| MessageHubApp | message-hub | WORKING-REST | message-hub-store.ts | `/messages/conversations` (GET), `/messages` (GET), `/messages/send` (POST) | None | REST-only. **Store calls POST `/messages/conversations` to create -- router has no POST route for that**, only GET. createConversation will 404. |
| SharedClipboardApp | shared-clipboard | WORKING-REST | clipboard-store.ts | `/clipboard` (CRUD), `/clipboard/:id/pin` (POST) | None | REST-only. |
| ServiceDashboardApp | service-dashboard | WORKING-REST | service-dashboard-store.ts | `/vm/health`, `/tokens/summary`, `/pipeline/stats` | None | Composite dashboard. All endpoints exist. |
| TunnelManagerApp | tunnel-manager | WORKING-REST | tunnel-store.ts | `/tunnels` (GET/POST), `/tunnels/:pid` (DELETE) | None | REST-only. |
| TeamPulseApp | team-pulse | WORKING-REST | team-pulse-store.ts | `/team-pulse` (GET), `/team-pulse/agents` (GET), `/team-pulse/velocity` (GET) | None | **Store calls `/team-pulse/standups` (GET/POST) -- NOT in router.** loadStandups/submitStandup will 404. Main loadViaRest works. |

## Tier 7: Business Management

| App | Route | Status | Store | REST Endpoints | Channel | Issues |
|-----|-------|--------|-------|----------------|---------|--------|
| ContactsCRMApp | contacts-crm | WORKING-REST | contacts-store.ts | `/contacts` (CRUD) | None | REST-only. |
| FinanceTrackerApp | finance-tracker | WORKING-REST | finance-store.ts | `/finance` (CRUD), `/finance/summary` (GET) | None | REST-only. |
| InvoiceBillingApp | invoice-billing | WORKING-REST | invoice-store.ts | `/invoices` (CRUD), `/invoices/:id/send` (POST), `/invoices/:id/mark-paid` (POST) | None | REST-only. |
| RoutineBuilderApp | routine-builder | WORKING-REST | routine-store.ts | `/routines` (CRUD), `/routines/:id/toggle` (POST), `/routines/:id/run` (POST) | None | REST-only. |
| MeetingRoomApp | meeting-room | WORKING-REST | meeting-store.ts | `/meetings` (CRUD), `/meetings/upcoming` (GET) | None | REST-only. |
| GoalPlannerApp | goal-planner | BROKEN | goal-planner-store.ts | `/goal-planner/goals` (CRUD), `/goal-planner/goals/:id/check-ins`, `/goal-planner/goals/:id/key-results/:id` | None | **ALL endpoints are fictional.** No `/goal-planner/*` routes in daemon router. Every API call will 404. GoalsApp (`/goals`) exists as the real goals backend. |
| ProjectPortfolioApp | project-portfolio | BROKEN | portfolio-store.ts | `/portfolio/projects` (GET) | None | **Endpoint `/portfolio/projects` does NOT exist** in daemon router. Will 404. |
| AuditTrailApp | audit-trail | WORKING-REST | audit-trail-store.ts | `/security/posture` (GET), `/security/audit` (POST) | None | REST-only. Uses same security endpoints as SecurityPanel. |
| IntegrationsApp | integrations | WORKING-REST | integrations-store.ts | `/integrations/status` (GET), `/integrations/github/connect` (POST), `/integrations/slack/connect` (POST) | None | REST-only. **disconnect calls DELETE `/integrations/{service}/connect` -- not in router.** disconnect will fail. |

## Tier 8: Monitoring & Graphs

| App | Route | Status | Store | REST Endpoints | Channel | Issues |
|-----|-------|--------|-------|----------------|---------|--------|
| KnowledgeGraphApp | knowledge-graph | BROKEN | knowledge-graph-store.ts | `/intelligence/graph` (GET) | joins `knowledge_graph:lobby` | **Endpoint `/intelligence/graph` does NOT exist** in router. **Channel `knowledge_graph:lobby` NOT registered** in UserSocket. Both will fail. |
| OutcomeDashboard | outcome-dashboard | BROKEN | N/A (inline) | Unknown | None | Likely calls non-existent endpoints. Single-file component. |
| QualityApp | quality | WORKING-REST | N/A (inline) | `/quality/report`, `/quality/friction`, `/quality/gradient`, `/quality/budget`, `/quality/threats` | None | REST-only quality monitoring. |
| OrchestrationApp | orchestration | WORKING-REST | N/A (inline) | `/orchestration/stats`, `/orchestration/fitness`, `/orchestration/route` | None | REST-only. |

## Tier 9: Agent Cross-Pollination Apps

| App | Route | Status | Store | REST Endpoints | Channel | Issues |
|-----|-------|--------|-------|----------------|---------|--------|
| AgentStreamApp | agent-stream | STUB | N/A | Unknown | Unknown | Single-file component. Likely placeholder. |
| AgentBridgeApp | agent-bridge | STUB | N/A | Unknown | Unknown | Single-file component. Likely placeholder. |
| AgentSystemApp | agent-system | STUB | N/A | Unknown | Unknown | Single-file component. Likely placeholder. |
| AgentGraphApp | agent-graph | STUB | N/A | Unknown | Unknown | Single-file component. Likely placeholder. |

## Tier 10: Wave2 & Misc Apps

| App | Route | Status | Store | REST Endpoints | Channel | Issues |
|-----|-------|--------|-------|----------------|---------|--------|
| HarvestersApp | harvesters | BROKEN | N/A (inline) | `/harvesters` (GET), `/harvesters/recent` (GET), `/harvesters/:name/run` (POST) | None | **ALL endpoints are fictional.** No `/harvesters/*` routes in daemon router. |
| PersistenceApp | persistence | BROKEN | N/A (inline) | `/persistence/stats` (GET), `/persistence/backup` (POST) | None | **ALL endpoints are fictional.** No `/persistence/*` routes in daemon router. |
| BuildItApp | build-it | WORKING-REST | N/A (inline) | `/superman/ask` (POST -- for planning), `/proposals` (POST -- for launching) | None | Creative use of existing endpoints. Plan step may fail if superman/ask returns unexpected format, but gracefully falls back to defaults. |
| BriefingApp | briefing | WORKING-REST | N/A (inline) | `/dashboard/today`, `/temporal/now`, `/executions`, `/gaps`, `/habits`, `/habits/today` | None | Composite briefing. **Some calls pass query params like `?status=running&limit=5` which may not be supported but fail gracefully.** |
| MCPApp | mcp | BROKEN | N/A (inline) | `/mcp/tools` (GET), `/mcp/tools/execute` (POST) | None | **ALL endpoints are fictional.** No `/mcp/*` routes in daemon router. |
| VectorsApp | vectors | WORKING-REST | N/A (inline) | `/vectors/status` (GET), `/vectors/reindex` (POST), `/vectors/query` (GET) | None | REST-only. Endpoints exist in router. |

---

## Broken/Missing Endpoint Summary

### Entirely Missing Route Groups (all calls will 404)
| Frontend | Calls | Fix |
|----------|-------|-----|
| GoalPlannerApp | `/goal-planner/goals/*` | Remove app or wire to existing `/goals` CRUD |
| ProjectPortfolioApp | `/portfolio/projects` | Remove app or create PortfolioController |
| KnowledgeGraphApp | `/intelligence/graph` | Create endpoint or wire to `/project-graph` |
| HarvestersApp | `/harvesters/*` | Create HarvesterController or remove |
| PersistenceApp | `/persistence/*` | Create PersistenceController or remove |
| MCPApp | `/mcp/tools/*` | Create MCPController or remove |
| OutcomeDashboard | (unknown endpoints) | Verify and fix |

### Partially Missing Endpoints
| Frontend | Missing Endpoint | Existing Alternative |
|----------|-----------------|---------------------|
| MetaMindApp store | `/metamind/prompts`, `/metamind/stats`, `/metamind/research` | `/metamind/library` exists -- store should use that |
| TeamPulseApp store | `/team-pulse/standups` (GET/POST) | None -- need to add or remove standup feature |
| MessageHubApp store | POST `/messages/conversations` | Only GET `/messages/conversations` exists |
| IntegrationsApp store | DELETE `/integrations/{service}/connect` | Only POST connect exists |

### Missing WebSocket Channels (registered topic patterns)
| Store Joins | Registered? | Impact |
|-------------|-------------|--------|
| `pipeline:lobby` | No | Stats won't live-update, REST fallback works |
| `decisions:lobby` | No | Decisions won't live-update, REST fallback works |
| `project_graph:lobby` | No | Graph won't live-update, REST fallback works |
| `knowledge_graph:lobby` | No | KG entirely broken (REST also broken) |
| `jarvis:lobby` | No | Orb state won't push, REST chat works |
| `channels:chat:{id}` | Only `channels:*` registered | Per-chat joins may fail depending on wildcard matching |

---

## Recommended Fixes (Priority Order)

### P0 -- Fix Broken Core Experiences
1. **MetaMindApp**: Change store to use `/metamind/library` instead of `/metamind/prompts`. The router has `library` endpoints.
2. **ChannelsApp**: Verify `channels:*` wildcard matches `channels:chat:general`. If not, add explicit `channel "channels:chat:*"` to UserSocket.

### P1 -- Remove or Wire Broken Apps
3. **GoalPlannerApp**: Delete component and route. The existing `GoalsApp` + `goals-store.ts` already covers goal management with working endpoints.
4. **ProjectPortfolioApp**: Either create a PortfolioController that wraps `/projects` data, or remove the app.
5. **KnowledgeGraphApp**: Either create `/intelligence/graph` endpoint that aggregates project-graph data, or remove. Currently a dead screen.
6. **MCPApp**: Create an MCP tools endpoint or remove. No daemon support exists.
7. **HarvestersApp**: Create a HarvesterController or remove. Harvesters are "designed but not implemented" per CLAUDE.md.
8. **PersistenceApp**: Create a simple PersistenceController returning DB stats, or remove.

### P2 -- Fix Partial Breakages
9. **MessageHubApp**: Add POST `/messages/conversations` route to create conversations, or remove createConversation from the store.
10. **TeamPulseApp**: Add `/team-pulse/standups` endpoints, or remove standup features from store.
11. **IntegrationsApp**: Add DELETE routes for disconnecting integrations.

### P3 -- Register Missing Channels
12. Add to UserSocket: `channel "pipeline:*", EmaWeb.PipelineChannel`
13. Add to UserSocket: `channel "decisions:*", EmaWeb.DecisionChannel`
14. Add to UserSocket: `channel "jarvis:*", EmaWeb.JarvisChannel`
15. Add to UserSocket: `channel "project_graph:*", EmaWeb.ProjectGraphChannel` (channel module may already exist)

### P4 -- Clean Up Stubs
16. **SoulEditorApp**: Currently all client-side simulated. Either wire to vault for SOUL.md persistence, or mark as demo.
17. **Agent cross-pollination apps** (agent-stream, agent-bridge, agent-system, agent-graph): Verify if these have any real UI or are empty shells. Single-file components likely need backend work.
18. **OutcomeDashboard**: Verify what endpoints it calls and fix.

---

## Store Pattern Summary

| Pattern | Count | Description |
|---------|-------|-------------|
| Full (REST + WS + CRUD) | 22 | `loadViaRest()` + `connect()` + event handlers |
| REST-only with store | 18 | `loadViaRest()` only, no WS channel |
| Inline state (no store) | 16 | Component uses `useState` + direct `api.get/post` |
| Client-only (no API) | 2 | SoulEditor, some agent-* apps |
| Shared store | 4 | DispatchBoard shares execution-store, Jarvis/Orb share jarvis-store, Wiki shares vault-store |

---

## Channel Registration Cross-Reference

Channels registered in `daemon/lib/ema_web/user_socket.ex`:

```
dashboard:*     brain_dump:*    habits:*        journal:*
settings:*      workspace:*     projects:*      sessions:*
tasks:*         proposals:*     vault:*         pipes:*
responsibilities:*  agent_network:*  agents:lobby   agents:chat:*
canvas:*        claude_sessions:*  voice:*       channels:*
evolution:*     metamind:*      goals:*         focus:*
notes:*         cli_manager:*   dispatch_board:*  superman:*
orgs:*          temporal:*      memory:*        gaps:*
intent:*        executions:*    intelligence:*   prompts:*
```

**NOT registered but attempted by stores:**
- `pipeline:*` (pipeline-store.ts)
- `decisions:*` (decision-log-store.ts)
- `project_graph:*` (project-graph-store.ts)
- `knowledge_graph:*` (knowledge-graph-store.ts)
- `jarvis:*` (jarvis-store.ts)
