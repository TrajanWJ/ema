defmodule EmaWeb.Router do
  use EmaWeb, :router

  pipeline :api do
    plug(:accepts, ["json"])
  end

  scope "/api", EmaWeb do
    pipe_through(:api)

    get("/health", HealthController, :index)
    get("/status", ControlPlaneController, :status)
    get("/surfaces", ControlPlaneController, :surfaces)
    get("/surfaces/host-truth", ControlPlaneController, :host_truth)
    get("/surfaces/gateway", ControlPlaneController, :gateway)
    get("/surfaces/peers", ControlPlaneController, :peers)
    get("/dashboard/today", DashboardController, :today)

    # Organizations
    get("/orgs", OrgController, :index)
    post("/orgs", OrgController, :create)
    get("/orgs/:id", OrgController, :show)
    put("/orgs/:id", OrgController, :update)
    delete("/orgs/:id", OrgController, :delete)
    post("/orgs/:id/invitations", OrgController, :create_invitation)
    delete("/orgs/:org_id/invitations/:id", OrgController, :revoke_invitation)
    delete("/orgs/:id/members/:member_id", OrgController, :remove_member)
    put("/orgs/:id/members/:member_id/role", OrgController, :update_role)
    post("/join/:token", OrgController, :join)
    get("/join/:token/preview", OrgController, :preview_invitation)

    get("/brain-dump/items", BrainDumpController, :index)
    post("/brain-dump/items", BrainDumpController, :create)
    patch("/brain-dump/items/:id/process", BrainDumpController, :process)
    delete("/brain-dump/items/:id", BrainDumpController, :delete)

    # Onboarding / bootstrap
    get("/onboarding/status", OnboardingController, :status)
    get("/onboarding/readiness", OnboardingController, :readiness)
    post("/onboarding/run", OnboardingController, :run)

    get("/habits", HabitsController, :index)
    post("/habits", HabitsController, :create)
    get("/habits/today", HabitsController, :today_logs)
    post("/habits/:id/archive", HabitsController, :archive)
    post("/habits/:id/toggle", HabitsController, :toggle)
    get("/habits/:id/logs", HabitsController, :logs)

    get("/journal/search", JournalController, :search)
    get("/journal/:date", JournalController, :show)
    put("/journal/:date", JournalController, :update)

    get("/settings", SettingsController, :index)
    put("/settings", SettingsController, :update)

    get("/context/executive-summary", ContextController, :executive_summary)
    get("/context/operator/package", ControlPlaneController, :operator_package)
    get("/context/project/:id/package", ControlPlaneController, :project_package)

    # DCC Session Context
    get("/context", ContextController, :index)
    get("/context/sessions", ContextController, :sessions)
    post("/context/crystallize", ContextController, :crystallize)

    # Quality Monitoring
    get("/quality/report", QualityController, :report)
    get("/quality/friction", QualityController, :friction)
    get("/quality/gradient", QualityController, :gradient)
    get("/quality/budget", QualityController, :budget)
    get("/quality/threats", QualityController, :threats)

    # Orchestration
    get("/orchestration/stats", OrchestrationController, :stats)
    get("/orchestration/fitness", OrchestrationController, :fitness)
    post("/orchestration/route", OrchestrationController, :route)

    get("/workspace", WorkspaceController, :index)
    put("/workspace/:app_id", WorkspaceController, :update)

    # Sessions
    get("/sessions", SessionController, :index)
    get("/sessions/active", SessionController, :active)
    post("/sessions/:id/link", SessionController, :link)

    # Session Orchestrator — spawn/monitor/manage Claude Code sessions
    get("/orchestrator/sessions", SessionOrchestratorController, :index)
    get("/orchestrator/sessions/:id", SessionOrchestratorController, :show)
    get("/orchestrator/sessions/:id/check", SessionOrchestratorController, :check)
    post("/orchestrator/sessions/spawn", SessionOrchestratorController, :spawn)
    post("/orchestrator/sessions/:id/resume", SessionOrchestratorController, :resume)
    post("/orchestrator/sessions/:id/kill", SessionOrchestratorController, :kill)
    get("/orchestrator/context", SessionOrchestratorController, :context)
    get("/orchestrator/context/prompt", SessionOrchestratorController, :context_prompt)

    # Projects — specific routes before resources to avoid :id shadowing
    get("/projects/:id/context", ProjectController, :context)
    get("/projects/:slug/context-fragments", ProjectController, :context_fragments)
    get("/projects/:project_id/tasks", TaskController, :by_project)
    resources("/projects", ProjectController, except: [:new, :edit])

    # Providers — AI provider management
    get("/providers", ProviderController, :index)
    post("/providers/detect", ProviderController, :detect)
    get("/providers/:id", ProviderController, :show)
    post("/providers/:id/health", ProviderController, :health)

    # Routing / Intent Classification
    post("/routing/classify", RoutingController, :classify)
    get("/routing/stats", RoutingController, :stats)

    # Tasks — specific routes before resources
    post("/tasks/:id/transition", TaskController, :transition)
    post("/tasks/:id/comments", TaskController, :add_comment)
    get("/tasks/:id/scope-advice", TaskController, :scope_advice)
    resources("/tasks", TaskController, except: [:new, :edit])

    # Proposals — specific routes before general (param :id wildcard)
    post("/proposals", ProposalController, :create)
    get("/proposals", ProposalController, :index)
    get("/proposals/surfaced", ProposalController, :surfaced)
    # Batch 3: Orchestrator pipeline endpoints (must be before :id routes)
    post("/proposals/generate", ProposalController, :generate)
    get("/proposals/pipelines", ProposalController, :pipelines)
    get("/proposals/budget", ProposalController, :budget)
    get("/proposals/compare", ProposalController, :compare)
    get("/proposals/:id", ProposalController, :show)
    get("/proposals/:id/outcome", ProposalController, :outcome)
    get("/proposals/:id/cost", ProposalController, :cost)
    post("/proposals/:id/approve", ProposalController, :approve)
    post("/proposals/:id/redirect", ProposalController, :redirect)
    post("/proposals/:id/kill", ProposalController, :kill)
    post("/proposals/:id/cancel", ProposalController, :cancel)
    get("/proposals/:id/lineage", ProposalController, :lineage)

    # Seeds
    resources("/seeds", SeedController, except: [:new, :edit])
    post("/seeds/:id/toggle", SeedController, :toggle)
    post("/seeds/:id/run-now", SeedController, :run_now)

    # Engine
    get("/engine/status", EngineController, :status)
    post("/engine/pause", EngineController, :pause)
    post("/engine/resume", EngineController, :resume)

    # Second Brain / Vault
    get("/vault/tree", VaultController, :tree)
    get("/vault/note", VaultController, :show)
    put("/vault/note", VaultController, :upsert)
    delete("/vault/note", VaultController, :delete)
    post("/vault/note/move", VaultController, :move)
    get("/vault/search", VaultController, :search)
    get("/vault/graph", VaultController, :graph)
    get("/vault/graph/neighbors/:id", VaultController, :neighbors)
    get("/vault/graph/typed-neighbors/:id", VaultController, :typed_neighbors)
    get("/vault/graph/orphans", VaultController, :orphans)

    # Obsidian Vault Bridge
    get("/obsidian/notes", ObsidianVaultController, :index)
    get("/obsidian/search", ObsidianVaultController, :search)
    get("/obsidian/notes/*path", ObsidianVaultController, :show)
    post("/obsidian/notes", ObsidianVaultController, :create)

    # Pipes — specific routes before resources to avoid :id shadowing
    get("/pipes/system", PipeController, :system_pipes)
    get("/pipes/catalog", PipeController, :catalog)
    get("/pipes/history", PipeController, :execution_history)
    post("/pipes/:id/toggle", PipeController, :toggle)
    post("/pipes/:id/fork", PipeController, :fork)
    resources("/pipes", PipeController, except: [:new, :edit])

    # Responsibilities — specific routes before resources
    get("/responsibilities/at-risk", ResponsibilityController, :at_risk)
    post("/responsibilities/:id/check-in", ResponsibilityController, :check_in)
    resources("/responsibilities", ResponsibilityController, except: [:new, :edit])

    # Agents — specific routes before resources to avoid :id shadowing
    get("/agents/network/status", AgentController, :network_status)
    resources("/agents", AgentController, param: "id", except: [:new, :edit])
    post("/agents/:slug/chat", AgentController, :chat)
    get("/agents/:slug/conversations", AgentController, :conversations)
    get("/agents/:slug/conversations/:id", AgentController, :conversation_detail)
    post("/agents/:slug/channels", AgentChannelController, :create)
    put("/agents/:slug/channels/:id", AgentChannelController, :update)
    delete("/agents/:slug/channels/:id", AgentChannelController, :delete)
    post("/agents/:slug/channels/:id/test", AgentChannelController, :test_connection)

    # Campaigns (templates + runs)
    get("/campaigns", CampaignController, :index)
    post("/campaigns", CampaignController, :create)
    get("/campaigns/:id", CampaignController, :show)
    put("/campaigns/:id", CampaignController, :update)
    delete("/campaigns/:id", CampaignController, :delete)
    post("/campaigns/:id/run", CampaignController, :start_run)
    get("/campaigns/:id/runs", CampaignController, :list_runs)
    post("/campaigns/:id/advance", CampaignController, :advance)
    # Campaign run detail
    get("/campaign-runs/:id", CampaignController, :show_run)

    # Notes
    resources("/notes", NotesController, except: [:new, :edit])

    # Canvas templates
    get("/canvas/templates", CanvasController, :templates)
    post("/canvas/templates", CanvasController, :create_template)
    post("/canvas/:id/instantiate-template", CanvasController, :instantiate_template)

    # Canvases
    resources("/canvases", CanvasController, except: [:new, :edit])
    get("/canvases/:id/export", CanvasController, :export)
    get("/canvases/:id/data/:element_id", CanvasController, :element_data)
    post("/canvases/:id/data/:element_id/refresh", CanvasController, :refresh_data)

    # Data Sources
    get("/data-sources", DataSourceController, :index)
    get("/data-sources/:id/preview", DataSourceController, :preview)

    # Evolution
    get("/evolution/rules", EvolutionController, :index)
    get("/evolution/rules/:id", EvolutionController, :show)
    post("/evolution/rules", EvolutionController, :create)
    put("/evolution/rules/:id", EvolutionController, :update)
    post("/evolution/rules/:id/activate", EvolutionController, :activate)
    post("/evolution/rules/:id/rollback", EvolutionController, :rollback)
    post("/evolution/rules/:id/version", EvolutionController, :apply_version)
    get("/evolution/rules/:id/history", EvolutionController, :version_history)
    get("/evolution/signals", EvolutionController, :signals)
    get("/evolution/stats", EvolutionController, :stats)
    post("/evolution/scan", EvolutionController, :scan_now)
    post("/evolution/propose", EvolutionController, :propose)

    # Channels
    get("/channels", ChannelsController, :index)
    get("/channels/health", ChannelsController, :health)
    get("/channels/inbox", ChannelsController, :inbox)
    get("/channels/platforms", ChannelsController, :platforms)
    post("/channels/send", ChannelsController, :send_cross_platform)
    get("/channels/:channel_id/messages", ChannelsController, :messages)
    post("/channels/:channel_id/messages", ChannelsController, :send_message)

    # AI Sessions (streaming conversations)
    get("/ai-sessions", AiSessionController, :index)
    post("/ai-sessions", AiSessionController, :create)
    get("/ai-sessions/:id", AiSessionController, :show)
    post("/ai-sessions/:id/resume", AiSessionController, :resume)
    post("/ai-sessions/:id/fork", AiSessionController, :fork)

    # Claude Sessions (Bridge)
    get("/claude-sessions", ClaudeSessionController, :index)
    post("/claude-sessions", ClaudeSessionController, :create)
    get("/claude-sessions/:id", ClaudeSessionController, :show)
    post("/claude-sessions/:id/continue", ClaudeSessionController, :continue)
    delete("/claude-sessions/:id", ClaudeSessionController, :kill)

    # Voice
    get("/voice/sessions", VoiceController, :sessions)
    post("/voice/sessions", VoiceController, :create_session)
    post("/voice/process", VoiceController, :process)
    delete("/voice/sessions/:id", VoiceController, :end_session)

    # Vectors / Scoring
    get("/vectors/status", VectorController, :status)
    post("/vectors/reindex", VectorController, :reindex)
    get("/vectors/query", VectorController, :query)

    # MetaMind
    get("/metamind/pipeline", MetaMindController, :pipeline_status)
    get("/metamind/library", MetaMindController, :library)
    post("/metamind/library", MetaMindController, :save_prompt)
    delete("/metamind/library/:id", MetaMindController, :delete_prompt)

    # Ralph Loop
    get("/ralph/status", RalphController, :status)
    post("/ralph/run", RalphController, :run_cycle)
    post("/ralph/configure", RalphController, :configure)
    post("/ralph/surface/:id", RalphController, :surface)

    # Dispatch Board — execution overview
    get("/dispatch-board", DispatchBoardController, :index)
    get("/dispatch-board/stats", DispatchBoardController, :stats)

    # Executions — runtime linkage object
    get("/executions", ExecutionController, :index)
    get("/executions/:id", ExecutionController, :show)
    post("/executions", ExecutionController, :create)
    post("/executions/:id/approve", ExecutionController, :approve)
    post("/executions/:id/cancel", ExecutionController, :cancel)
    get("/executions/:id/events", ExecutionController, :events)
    get("/executions/:id/agent-sessions", ExecutionController, :agent_sessions)
    get("/executions/:id/diff", ExecutionController, :diff)
    post("/executions/:id/complete", ExecutionController, :complete)
    get("/intents/:project_slug/:intent_slug/status", ExecutionController, :intent_status)

    # Reflexion memory
    get("/reflexion/entries", ReflexionController, :index)
    post("/reflexion/entries", ReflexionController, :create)

    # Goals
    resources("/goals", GoalController, except: [:new, :edit])

    # Actors
    resources("/actors", ActorController, except: [:new, :edit])
    post("/actors/:id/transition", ActorController, :transition_phase)
    get("/actors/:id/tags", ActorController, :list_tags)
    get("/actors/:id/commands", ActorController, :list_commands)
    post("/actors/:id/commands", ActorController, :register_command)
    get("/actors/:id/phases", ActorController, :list_phases)

    get("/tags", TagController, :index)
    post("/tags", TagController, :create)
    delete("/tags", TagController, :delete)

    get("/entity-data", EntityDataController, :index)
    post("/entity-data", EntityDataController, :create)
    delete("/entity-data", EntityDataController, :delete)

    get("/container-config", ContainerConfigController, :index)
    post("/container-config", ContainerConfigController, :create)
    delete("/container-config", ContainerConfigController, :delete)

    get("/phase-transitions", PhaseTransitionController, :index)
    post("/phase-transitions", PhaseTransitionController, :create)

    resources("/spaces", SpaceController, except: [:new, :edit, :update, :delete])

    # Focus — timer-driven sessions
    get("/focus", FocusController, :current)
    get("/focus/current", FocusController, :current)
    get("/focus/today", FocusController, :today)
    get("/focus/weekly", FocusController, :weekly)
    get("/focus/history", FocusController, :history)
    get("/focus/sessions", FocusController, :index)
    get("/focus/sessions/:id", FocusController, :show)
    get("/focus/tasks/:task_id/sessions", FocusController, :task_sessions)
    post("/focus/start", FocusController, :start)
    post("/focus/stop", FocusController, :stop)
    post("/focus/pause", FocusController, :pause)
    post("/focus/resume", FocusController, :resume)
    post("/focus/break", FocusController, :take_break)
    post("/focus/resume-work", FocusController, :resume_work)

    # Intelligence — MCP audit logging + outcome tracking
    post("/intelligence/outcomes", IntelligenceController, :log_outcome)
    post("/intelligence/mcp-calls", IntelligenceController, :log_mcp_call)

    # Git Sync / Intelligence
    get("/intelligence/git-events", GitSyncController, :index)
    get("/intelligence/git-events/:id/suggestions", GitSyncController, :suggestions)
    post("/intelligence/git-events/:id/apply/:action_id", GitSyncController, :apply_suggestion)
    get("/intelligence/sync-status", GitSyncController, :sync_status)
    post("/intelligence/git-events/scan", GitSyncController, :scan)

    # CLI Manager
    get("/cli-manager/tools", CliManagerController, :list_tools)
    post("/cli-manager/tools", CliManagerController, :create_tool)
    get("/cli-manager/sessions", CliManagerController, :list_sessions)
    post("/cli-manager/sessions", CliManagerController, :create_session)
    post("/cli-manager/sessions/:id/stop", CliManagerController, :stop_session)
    post("/cli-manager/scan", CliManagerController, :scan)

    # Async dispatch — non-blocking Claude task dispatch
    post("/dispatch/async", DispatchController, :async)

    # Superman — Code Intelligence
    get("/superman/health", SupermanController, :health)
    get("/superman/status", SupermanController, :status)
    get("/superman/context/:project_slug", SupermanController, :context)
    post("/superman/context", SupermanController, :context_post)
    post("/superman/index", SupermanController, :index_repo)
    post("/superman/ask", SupermanController, :ask)
    get("/superman/gaps", SupermanController, :gaps)
    get("/superman/flows", SupermanController, :flows)
    post("/superman/apply", SupermanController, :apply_change)
    get("/superman/intent", SupermanController, :intent_graph)
    post("/superman/simulate", SupermanController, :simulate)
    post("/superman/autonomous", SupermanController, :autonomous)
    get("/superman/panels", SupermanController, :panels)
    post("/superman/build", SupermanController, :build)

    # Pipeline analytics
    get("/pipeline/stats", PipelineController, :stats)
    get("/pipeline/bottlenecks", PipelineController, :bottlenecks)
    get("/pipeline/throughput", PipelineController, :throughput)

    # Prompt Workshop
    get("/prompts/optimizer/status", PromptOptimizerController, :status)
    resources("/prompts", PromptController, except: [:new, :edit])
    post("/prompts/:id/version", PromptController, :create_version)

    # Ingestor
    resources("/ingest-jobs", IngestController, except: [:new, :edit])

    # Decisions
    resources("/decisions", DecisionController, except: [:new, :edit])

    # Temporal Intelligence
    get("/temporal/rhythm", TemporalController, :rhythm)
    get("/temporal/now", TemporalController, :now)
    get("/temporal/best-time", TemporalController, :best_time)
    post("/temporal/log", TemporalController, :log)
    get("/temporal/history", TemporalController, :history)

    # Security Posture
    get("/security/posture", SecurityController, :posture)
    post("/security/audit", SecurityController, :audit)

    # VM Health Monitoring
    get("/vm/health", VmController, :health)
    get("/vm/containers", VmController, :containers)
    post("/vm/check", VmController, :check)

    # Token & Cost Monitoring
    get("/tokens/summary", TokenController, :summary)
    get("/tokens/history", TokenController, :history)
    get("/tokens/forecast", TokenController, :forecast)
    get("/tokens/budget", TokenController, :budget)
    put("/tokens/budget", TokenController, :set_budget)

    # Intent Map (legacy)
    get("/intent/nodes", IntentController, :index)
    get("/intent/tree/:project_id", IntentController, :tree)
    get("/intent/export/:project_id", IntentController, :export)
    post("/intent/nodes", IntentController, :create)
    get("/intent/nodes/:id", IntentController, :show)
    put("/intent/nodes/:id", IntentController, :update)
    delete("/intent/nodes/:id", IntentController, :delete)

    # Intents (Intent Engine) — specific routes before resources
    get("/intents/status", IntentsController, :status)
    get("/intents/tree", IntentsController, :tree)
    get("/intents/:id/tree", IntentsController, :tree)
    get("/intents/:id/lineage", IntentsController, :lineage)
    get("/intents/:id/runtime", IntentsController, :runtime)
    post("/intents/:id/actors", IntentsController, :attach_actor)
    post("/intents/:id/executions", IntentsController, :attach_execution)
    post("/intents/:id/sessions", IntentsController, :attach_session)
    post("/intents/:id/links", IntentsController, :create_link)
    resources("/intents", IntentsController, except: [:new, :edit])

    # Gap Inbox
    get("/gaps", GapController, :index)
    post("/gaps/:id/resolve", GapController, :resolve)
    post("/gaps/:id/create_task", GapController, :create_task)
    post("/gaps/scan", GapController, :scan)

    # Project Graph
    get("/project-graph", ProjectGraphController, :index)
    get("/project-graph/nodes/:id", ProjectGraphController, :show)

    # Session Memory
    get("/memory/sessions", MemoryController, :sessions)
    get("/memory/sessions/:id", MemoryController, :show_session)
    get("/memory/fragments", MemoryController, :fragments)
    get("/memory/context", MemoryController, :context)
    get("/memory/search", MemoryController, :search)
    post("/memory/extract/:session_id", MemoryController, :extract)

    # Contacts CRM
    resources("/contacts", ContactController, except: [:new, :edit])

    # Finance Tracker
    get("/finance/summary", FinanceController, :summary)
    resources("/finance", FinanceController, except: [:new, :edit])

    # Invoices
    post("/invoices/:id/send", InvoiceController, :send_invoice)
    post("/invoices/:id/mark-paid", InvoiceController, :mark_paid)
    resources("/invoices", InvoiceController, except: [:new, :edit])

    # Routines
    post("/routines/:id/toggle", RoutineController, :toggle)
    post("/routines/:id/run", RoutineController, :run)
    resources("/routines", RoutineController, except: [:new, :edit])

    # Meetings
    get("/meetings/upcoming", MeetingController, :upcoming)
    resources("/meetings", MeetingController, except: [:new, :edit])

    # Shared Clipboard
    post("/clipboard/:id/pin", ClipboardController, :pin)
    resources("/clipboard", ClipboardController, except: [:new, :edit, :update])

    # Tunnels
    get("/tunnels", TunnelController, :index)
    post("/tunnels", TunnelController, :create)
    delete("/tunnels/:pid", TunnelController, :delete)

    # File Vault
    resources("/file-vault", FileVaultController, except: [:new, :edit, :update])

    # Message Hub
    get("/messages", MessageHubController, :index)
    get("/messages/conversations", MessageHubController, :conversations)
    post("/messages/send", MessageHubController, :send_message)

    # Team Pulse
    get("/team-pulse", TeamPulseController, :index)
    get("/team-pulse/agents", TeamPulseController, :agents)
    get("/team-pulse/velocity", TeamPulseController, :velocity)
    get("/team-pulse/standups", TeamPulseController, :standups)
    post("/team-pulse/standups", TeamPulseController, :create_standup)

    # Metrics
    get("/metrics/summary", MetricsController, :summary)
    get("/metrics/by_domain", MetricsController, :by_domain)

    # Integrations
    get("/integrations/status", IntegrationsController, :status)
    post("/integrations/github/connect", IntegrationsController, :github_connect)
    post("/integrations/slack/connect", IntegrationsController, :slack_connect)

    # Babysitter — system observability and Discord stream-of-consciousness
    get("/babysitter/state", BabysitterController, :state)
    post("/babysitter/config", BabysitterController, :config)
    post("/babysitter/nudge", BabysitterController, :nudge)
    post("/babysitter/tick", BabysitterController, :tick)

    # Feedback stream — Discord delivery + EMA internal visibility
    get("/feedback", FeedbackController, :index)
    get("/feedback/status", FeedbackController, :status)
    post("/feedback/emit", FeedbackController, :emit)

    # Webhooks
    post("/webhooks/github", WebhookController, :github)
    post("/webhooks/slack/commands", WebhookController, :slack_command)
    post("/webhooks/slack/events", WebhookController, :slack_event)
    post("/webhooks/telegram", TelegramController, :webhook)
    post("/webhooks/discord", DiscordWebhookController, :webhook)
    # Voice-integrated Discord bridge (messages → VoiceCore → Jarvis response)
    post("/discord/message", DiscordWebhookController, :receive)

    # Harvesters
    get("/harvesters", HarvesterController, :index)
    get("/harvesters/recent", HarvesterController, :recent)
    post("/harvesters/:name/run", HarvesterController, :run)

    # Persistence
    get("/persistence/stats", PersistenceController, :stats)
    post("/persistence/backup", PersistenceController, :backup)

    # MCP Tools
    get("/mcp/tools", MCPController, :index)
    post("/mcp/tools/execute", MCPController, :execute)
  end
end
