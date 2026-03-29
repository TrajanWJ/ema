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
  end
end
