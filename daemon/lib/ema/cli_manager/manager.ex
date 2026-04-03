defmodule Ema.CliManager do
  @moduledoc """
  Context module for CLI tool and session management.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.CliManager.{CliTool, CliSession}

  # -- Tools --

  def list_tools do
    Repo.all(from t in CliTool, order_by: [asc: t.name])
  end

  def get_tool(id), do: Repo.get(CliTool, id)

  def get_tool_by_name(name), do: Repo.get_by(CliTool, name: name)

  def create_tool(attrs) do
    id = "cli_#{System.system_time(:millisecond)}_#{:rand.uniform(9999)}"

    %CliTool{}
    |> CliTool.changeset(Map.put(attrs, "id", id))
    |> Repo.insert()
  end

  def upsert_tool(attrs) do
    case get_tool_by_name(attrs["name"] || attrs[:name]) do
      nil -> create_tool(attrs)
      tool -> tool |> CliTool.changeset(attrs) |> Repo.update()
    end
  end

  # -- Sessions --

  def list_sessions(opts \\ []) do
    query = from(s in CliSession, order_by: [desc: s.started_at], preload: [:cli_tool])

    query
    |> maybe_filter_status(opts[:status])
    |> maybe_filter_tool(opts[:cli_tool_id])
    |> maybe_limit(opts[:limit])
    |> Repo.all()
  end

  def active_sessions do
    list_sessions(status: "running")
  end

  def get_session(id) do
    Repo.get(CliSession, id) |> Repo.preload(:cli_tool)
  end

  def create_session(attrs) do
    id = "clisess_#{System.system_time(:millisecond)}_#{:rand.uniform(9999)}"

    %CliSession{}
    |> CliSession.changeset(Map.merge(attrs, %{"id" => id, "started_at" => DateTime.utc_now()}))
    |> Repo.insert()
    |> tap_broadcast(:session_created)
  end

  def update_session(%CliSession{} = session, attrs) do
    session
    |> CliSession.changeset(attrs)
    |> Repo.update()
    |> tap_broadcast(:session_updated)
  end

  def complete_session(id, exit_code \\ 0, output_summary \\ nil) do
    case get_session(id) do
      nil -> {:error, :not_found}
      session ->
        update_session(session, %{
          "status" => "completed",
          "ended_at" => DateTime.utc_now(),
          "exit_code" => exit_code,
          "output_summary" => output_summary
        })
    end
  end

  def stop_session(id) do
    case get_session(id) do
      nil -> {:error, :not_found}
      session ->
        update_session(session, %{
          "status" => "stopped",
          "ended_at" => DateTime.utc_now()
        })
    end
  end

  # -- Broadcast --

  defp tap_broadcast({:ok, record} = result, event) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "cli_manager:events", {:cli_manager, event, record})
    result
  end

  defp tap_broadcast(error, _event), do: error

  # -- Query helpers --

  defp maybe_filter_status(query, nil), do: query
  defp maybe_filter_status(query, status), do: from(s in query, where: s.status == ^status)

  defp maybe_filter_tool(query, nil), do: query
  defp maybe_filter_tool(query, tool_id), do: from(s in query, where: s.cli_tool_id == ^tool_id)

  defp maybe_limit(query, nil), do: query
  defp maybe_limit(query, limit), do: from(s in query, limit: ^limit)
end
