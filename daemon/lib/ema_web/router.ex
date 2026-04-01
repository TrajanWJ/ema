defmodule EmaWeb.Router do
  use EmaWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", EmaWeb do
    pipe_through :api

    get "/dashboard/today", DashboardController, :today

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

    # Agents
    resources "/agents", AgentController, param: "id", except: [:new, :edit]
    post "/agents/:slug/chat", AgentController, :chat
    get "/agents/:slug/conversations", AgentController, :conversations
    get "/agents/:slug/conversations/:id", AgentController, :conversation_detail
    post "/agents/:slug/channels", AgentChannelController, :create
    put "/agents/:slug/channels/:id", AgentChannelController, :update
    delete "/agents/:slug/channels/:id", AgentChannelController, :delete
    post "/agents/:slug/channels/:id/test", AgentChannelController, :test_connection

    # Canvases
    resources "/canvases", CanvasController, except: [:new, :edit]
    get "/canvases/:id/export", CanvasController, :export
    get "/canvases/:id/data/:element_id", CanvasController, :element_data
    post "/canvases/:id/data/:element_id/refresh", CanvasController, :refresh_data

    # Data Sources
    get "/data-sources", DataSourceController, :index
    get "/data-sources/:id/preview", DataSourceController, :preview

    # Channels
    get "/channels", ChannelsController, :index
    get "/channels/health", ChannelsController, :health
    get "/channels/inbox", ChannelsController, :inbox
    get "/channels/:channel_id/messages", ChannelsController, :messages
    post "/channels/:channel_id/messages", ChannelsController, :send_message
  end
end
