defmodule EmaWeb.PersistenceController do
  @moduledoc """
  Stub controller for database persistence stats and backup triggers.
  """

  use EmaWeb, :controller

  action_fallback EmaWeb.FallbackController

  # GET /api/persistence/stats
  def stats(conn, _params) do
    db_path = Application.get_env(:ema, Ema.Repo)[:database] || "~/.local/share/ema/ema.db"

    size =
      case File.stat(db_path) do
        {:ok, %{size: s}} -> s
        _ -> 0
      end

    json(conn, %{database_size: size, migration_count: 96, table_count: 50})
  end

  # POST /api/persistence/backup
  def backup(conn, _params) do
    json(conn, %{ok: true, message: "Backup not yet implemented"})
  end
end
