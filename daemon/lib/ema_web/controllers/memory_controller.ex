defmodule EmaWeb.MemoryController do
  use EmaWeb, :controller

  alias Ema.Intelligence.SessionMemory

  action_fallback EmaWeb.FallbackController

  def sessions(conn, params) do
    opts =
      []
      |> maybe_add(:project_path, params["project_path"])
      |> maybe_add(:limit, parse_int(params["limit"]))

    sessions = SessionMemory.list_sessions(opts) |> Enum.map(&serialize_session/1)
    stats = SessionMemory.session_stats()

    json(conn, %{sessions: sessions, stats: serialize_stats(stats)})
  end

  def show_session(conn, %{"id" => id}) do
    case SessionMemory.get_session(id) do
      nil -> {:error, :not_found}
      session -> json(conn, serialize_session(session))
    end
  end

  def fragments(conn, params) do
    opts =
      []
      |> maybe_add(:session_id, params["session_id"])
      |> maybe_add(:project_path, params["project_path"])
      |> maybe_add(:fragment_type, params["fragment_type"])
      |> maybe_add(:limit, parse_int(params["limit"]))

    fragments = SessionMemory.list_fragments(opts) |> Enum.map(&serialize_fragment/1)
    json(conn, %{fragments: fragments})
  end

  def extract(conn, %{"session_id" => session_id}) do
    with {:ok, fragments} <- SessionMemory.extract_fragments_for_session(session_id) do
      json(conn, %{fragments: Enum.map(fragments, &serialize_fragment/1)})
    end
  end

  def context(conn, params) do
    project_path = params["project_path"] || ""
    limit = parse_int(params["limit"]) || 20
    result = SessionMemory.context_for_project(project_path, limit)
    json(conn, result)
  end

  def search(conn, %{"q" => query}) do
    sessions = SessionMemory.search_sessions(query) |> Enum.map(&serialize_session/1)
    json(conn, %{sessions: sessions})
  end

  def search(conn, _params) do
    json(conn, %{sessions: []})
  end

  # ── Serializers ──

  defp serialize_session(s) do
    %{
      id: s.id,
      session_id: s.session_id,
      project_path: s.project_path,
      status: s.status,
      token_count: s.token_count,
      tool_calls: s.tool_calls,
      summary: s.summary,
      last_active: s.last_active,
      started_at: s.started_at,
      ended_at: s.ended_at,
      project_id: s.project_id,
      created_at: s.inserted_at
    }
  end

  defp serialize_fragment(f) do
    %{
      id: f.id,
      session_id: f.session_id,
      fragment_type: f.fragment_type,
      content: f.content,
      importance_score: f.importance_score,
      project_path: f.project_path,
      created_at: f.inserted_at
    }
  end

  defp serialize_stats(stats) do
    %{
      total_sessions: stats.total_sessions,
      total_tokens: stats.total_tokens,
      most_active_project: stats.most_active_project
    }
  end

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)

  defp parse_int(nil), do: nil
  defp parse_int(val) when is_integer(val), do: val
  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> nil
    end
  end
end
