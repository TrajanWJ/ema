defmodule EmaWeb.Router do
  use EmaWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", EmaWeb do
    pipe_through :api

    get "/dashboard/today", DashboardController, :today

    # Organizations
    get "/orgs", OrgController, :index
    post "/orgs", OrgController, :create
    get "/orgs/:id", OrgController, :show
    put "/orgs/:id", OrgController, :update
    delete "/orgs/:id", OrgController, :delete
    post "/orgs/:id/invitations", OrgController, :create_invitation
    delete "/orgs/:org_id/invitations/:id", OrgController, :revoke_invitation
    delete "/orgs/:id/members/:member_id", OrgController, :remove_member
    put "/orgs/:id/members/:member_id/role", OrgController, :update_role
    post "/join/:token", OrgController, :join
    get "/join/:token/preview", OrgController, :preview_invitation

    get "/brain-dump/items", BrainDumpController, :index
    post "/brain-dump/items", BrainDumpController, :create
    patch "/brain-dump/items/:id/process", BrainDumpController, :process
    delete "/brain-dump/items/:id", BrainDumpController, :delete

    get "/habits", HabitsController, :index
    post "/habits", HabitsController, :create
    get "/habits/today", HabitsController, :today_logs
    post "/habits/:id/archive", HabitsController, :archive
    post "/habits/:id/toggle", HabitsController, :toggle
    get "/habits/:id/logs", HabitsController, :logs

    get "/journal/search", JournalController, :search
    get "/journal/:date", JournalController, :show
    put "/journal/:date", JournalController, :update

    get "/settings", SettingsController, :index
    put "/settings", SettingsController, :update

    get "/context/executive-summary", ContextController, :executive_summary

    get "/workspace", WorkspaceController, :index
    put "/workspace/:app_id", WorkspaceController, :update

    # Sessions
    get "/sessions", SessionController, :index
    get "/sessions/active", SessionController, :active
    post "/sessions/:id/link", SessionController, :link

    # Projects — specific routes before resources to avoid :id shadowing
    get "/projects/:slug/context", ProjectController, :context
    get "/projects/:project_id/tasks", TaskController, :by_project
    resources "/projects", ProjectController, except: [:new, :edit]

    # Tasks — specific routes before resources
    post "/tasks/:id/transition", TaskController, :transition
    post "/tasks/:id/comments", TaskController, :add_comment
    resources "/tasks", TaskController, except: [:new, :edit]

    # Proposals — specific routes before general
    get "/proposals", ProposalController, :index
    get "/proposals/surfaced", ProposalController, :surfaced
    get "/proposals/:id", ProposalController, :show
    post "/proposals/:id/approve", ProposalController, :approve
    post "/proposals/:id/redirect", ProposalController, :redirect
    post "/proposals/:id/kill", ProposalController, :kill
    get "/proposals/:id/lineage", ProposalController, :lineage

    # Seeds
    resources "/seeds", SeedController, except: [:new, :edit]
    post "/seeds/:id/toggle", SeedController, :toggle
    post "/seeds/:id/run-now", SeedController, :run_now

    # Engine
    get "/engine/status", EngineController, :status
    post "/engine/pause", EngineController, :pause
    post "/engine/resume", EngineController, :resume

    # Second Brain / Vault
    get "/vault/tree", VaultController, :tree
    get "/vault/note", VaultController, :show
    put "/vault/note", VaultController, :upsert
    delete "/vault/note", VaultController, :delete
    post "/vault/note/move", VaultController, :move
    get "/vault/search", VaultController, :search
    get "/vault/graph", VaultController, :graph
    get "/vault/graph/neighbors/:id", VaultController, :neighbors
    get "/vault/graph/typed-neighbors/:id", VaultController, :typed_neighbors
    get "/vault/graph/orphans", VaultController, :orphans

    # Pipes — specific routes before resources to avoid :id shadowing
    get "/pipes/system", PipeController, :system_pipes
    get "/pipes/catalog", PipeController, :catalog
    get "/pipes/history", PipeController, :execution_history
    post "/pipes/:id/toggle", PipeController, :toggle
    post "/pipes/:id/fork", PipeController, :fork
    resources "/pipes", PipeController, except: [:new, :edit]

    # Responsibilities — specific routes before resources
    get "/responsibilities/at-risk", ResponsibilityController, :at_risk
    post "/responsibilities/:id/check-in", ResponsibilityController, :check_in
    resources "/responsibilities", ResponsibilityController, except: [:new, :edit]

    # Agents — specific routes before resources to avoid :id shadowing
    get "/agents/network/status", AgentController, :network_status
    resources "/agents", AgentController, param: "id", except: [:new, :edit]
    post "/agents/:slug/chat", AgentController, :chat
    get "/agents/:slug/conversations", AgentController, :conversations
    get "/agents/:slug/conversations/:id", AgentController, :conversation_detail
    post "/agents/:slug/channels", AgentChannelController, :create
    put "/agents/:slug/channels/:id", AgentChannelController, :update
    delete "/agents/:slug/channels/:id", AgentChannelController, :delete
    post "/agents/:slug/channels/:id/test", AgentChannelController, :test_connection

    # Notes
    resources "/notes", NotesController, except: [:new, :edit]

    # Canvas templates
    get "/canvas/templates", CanvasController, :templates
    post "/canvas/templates", CanvasController, :create_template
    post "/canvas/:id/instantiate-template", CanvasController, :instantiate_template

    # Canvases
    resources "/canvases", CanvasController, except: [:new, :edit]
    get "/canvases/:id/export", CanvasController, :export
    get "/canvases/:id/data/:element_id", CanvasController, :element_data
    post "/canvases/:id/data/:element_id/refresh", CanvasController, :refresh_data

    # Data Sources
    get "/data-sources", DataSourceController, :index
    get "/data-sources/:id/preview", DataSourceController, :preview

    # Evolution
    get "/evolution/rules", EvolutionController, :index
    get "/evolution/rules/:id", EvolutionController, :show
    post "/evolution/rules", EvolutionController, :create
    put "/evolution/rules/:id", EvolutionController, :update
    post "/evolution/rules/:id/activate", EvolutionController, :activate
    post "/evolution/rules/:id/rollback", EvolutionController, :rollback
    post "/evolution/rules/:id/version", EvolutionController, :apply_version
    get "/evolution/rules/:id/history", EvolutionController, :version_history
    get "/evolution/signals", EvolutionController, :signals
    get "/evolution/stats", EvolutionController, :stats
    post "/evolution/scan", EvolutionController, :scan_now
    post "/evolution/propose", EvolutionController, :propose

    # Channels
    get "/channels", ChannelsController, :index
    get "/channels/health", ChannelsController, :health
    get "/channels/inbox", ChannelsController, :inbox
    get "/channels/:channel_id/messages", ChannelsController, :messages
    post "/channels/:channel_id/messages", ChannelsController, :send_message

    # AI Sessions (streaming conversations)
    get "/ai-sessions", AiSessionController, :index
    post "/ai-sessions", AiSessionController, :create
    get "/ai-sessions/:id", AiSessionController, :show
    post "/ai-sessions/:id/resume", AiSessionController, :resume
    post "/ai-sessions/:id/fork", AiSessionController, :fork

    # Claude Sessions (Bridge)
    get "/claude-sessions", ClaudeSessionController, :index
    post "/claude-sessions", ClaudeSessionController, :create
    get "/claude-sessions/:id", ClaudeSessionController, :show
    post "/claude-sessions/:id/continue", ClaudeSessionController, :continue
    delete "/claude-sessions/:id", ClaudeSessionController, :kill

    # Voice
    get "/voice/sessions", VoiceController, :sessions
    post "/voice/sessions", VoiceController, :create_session
    post "/voice/process", VoiceController, :process
    delete "/voice/sessions/:id", VoiceController, :end_session

    # Vectors / Scoring
    get "/vectors/status", VectorController, :status
    post "/vectors/reindex", VectorController, :reindex
    get "/vectors/query", VectorController, :query

    # MetaMind
    get "/metamind/pipeline", MetaMindController, :pipeline_status
    get "/metamind/library", MetaMindController, :library
    post "/metamind/library", MetaMindController, :save_prompt
    delete "/metamind/library/:id", MetaMindController, :delete_prompt

    # Ralph Loop
    get "/ralph/status", RalphController, :status
    post "/ralph/run", RalphController, :run_cycle
    post "/ralph/configure", RalphController, :configure
    post "/ralph/surface/:id", RalphController, :surface

    # Goals
    resources "/goals", GoalController, except: [:new, :edit]

    # Focus — timer-driven sessions
    get "/focus/current", FocusController, :current
    get "/focus/today", FocusController, :today
    get "/focus/weekly", FocusController, :weekly
    get "/focus/history", FocusController, :history
    get "/focus/sessions", FocusController, :index
    get "/focus/sessions/:id", FocusController, :show
    get "/focus/tasks/:task_id/sessions", FocusController, :task_sessions
    post "/focus/start", FocusController, :start
    post "/focus/stop", FocusController, :stop
    post "/focus/pause", FocusController, :pause
    post "/focus/resume", FocusController, :resume
    post "/focus/break", FocusController, :take_break
    post "/focus/resume-work", FocusController, :resume_work

    # Git Sync / Intelligence
    get "/intelligence/git-events", GitSyncController, :index
    get "/intelligence/git-events/:id/suggestions", GitSyncController, :suggestions
    post "/intelligence/git-events/:id/apply/:action_id", GitSyncController, :apply_suggestion
    get "/intelligence/sync-status", GitSyncController, :sync_status
    post "/intelligence/git-events/scan", GitSyncController, :scan

    # CLI Manager
    get "/cli-manager/tools", CliManagerController, :list_tools
    post "/cli-manager/tools", CliManagerController, :create_tool
    get "/cli-manager/sessions", CliManagerController, :list_sessions
    post "/cli-manager/sessions", CliManagerController, :create_session
    post "/cli-manager/sessions/:id/stop", CliManagerController, :stop_session
    post "/cli-manager/scan", CliManagerController, :scan

    # OpenClaw Gateway
    get "/openclaw/status", OpenClawController, :status
    post "/openclaw/message", OpenClawController, :send_message
    get "/openclaw/sessions", OpenClawController, :sessions
    post "/openclaw/dispatch", OpenClawController, :dispatch

    # Superman — Code Intelligence
    get "/superman/health", SupermanController, :health
    get "/superman/status", SupermanController, :status
    post "/superman/index", SupermanController, :index_repo
    post "/superman/ask", SupermanController, :ask
    get "/superman/gaps", SupermanController, :gaps
    get "/superman/flows", SupermanController, :flows
    post "/superman/apply", SupermanController, :apply_change
    get "/superman/intent", SupermanController, :intent_graph
    post "/superman/simulate", SupermanController, :simulate
    post "/superman/autonomous", SupermanController, :autonomous
    get "/superman/panels", SupermanController, :panels
    post "/superman/build", SupermanController, :build

    # Pipeline analytics
    get "/pipeline/stats", PipelineController, :stats
    get "/pipeline/bottlenecks", PipelineController, :bottlenecks
    get "/pipeline/throughput", PipelineController, :throughput

    # Prompt Workshop
    resources "/prompts", PromptController, except: [:new, :edit]
    post "/prompts/:id/version", PromptController, :create_version

    # Ingestor
    resources "/ingest-jobs", IngestController, except: [:new, :edit]

    # Decisions
    resources "/decisions", DecisionController, except: [:new, :edit]

    # Temporal Intelligence
    get "/temporal/rhythm", TemporalController, :rhythm
    get "/temporal/now", TemporalController, :now
    get "/temporal/best-time", TemporalController, :best_time
    post "/temporal/log", TemporalController, :log
    get "/temporal/history", TemporalController, :history

    # Security Posture
    get "/security/posture", SecurityController, :posture
    post "/security/audit", SecurityController, :audit

    # VM Health Monitoring
    get "/vm/health", VmController, :health
    get "/vm/containers", VmController, :containers
    post "/vm/check", VmController, :check

    # Token & Cost Monitoring
    get "/tokens/summary", TokenController, :summary
    get "/tokens/history", TokenController, :history
    get "/tokens/forecast", TokenController, :forecast
    get "/tokens/budget", TokenController, :budget
    put "/tokens/budget", TokenController, :set_budget

    # Webhooks
    post "/webhooks/telegram", TelegramController, :webhook
    post "/webhooks/discord", DiscordWebhookController, :webhook
  end
end
