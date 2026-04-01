defmodule Ema.ClaudeSessions do
  @moduledoc """
  Context for tracking and managing Claude Code sessions across projects.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.ClaudeSessions.ClaudeSession

  @doc """
  List sessions with optional filters.

  Options:
    - :project_id - filter by project
    - :status - filter by status (active, completed, abandoned)
    - :limit - max results (default 50)
  """
  def list_sessions(opts \\ []) do
    ClaudeSession
    |> maybe_filter_project(opts[:project_id])
    |> maybe_filter_status(opts[:status])
    |> order_by(desc: :started_at)
    |> limit(^(opts[:limit] || 50))
    |> Repo.all()
  end

  defp maybe_filter_project(query, nil), do: query

  defp maybe_filter_project(query, project_id) do
    where(query, [s], s.project_id == ^project_id)
  end

  defp maybe_filter_status(query, nil), do: query

  defp maybe_filter_status(query, status) do
    where(query, [s], s.status == ^status)
  end

  @doc "Get a single session by ID."
  def get_session(id), do: Repo.get(ClaudeSession, id)

  @doc "Create a new session."
  def create_session(attrs) do
    id = attrs[:id] || attrs["id"] || generate_id()

    %ClaudeSession{}
    |> ClaudeSession.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  @doc "Update an existing session."
  def update_session(%ClaudeSession{} = session, attrs) do
    session
    |> ClaudeSession.changeset(attrs)
    |> Repo.update()
  end

  @doc "Return all sessions with status 'active'."
  def get_active_sessions do
    ClaudeSession
    |> where([s], s.status == "active")
    |> order_by(desc: :last_active)
    |> Repo.all()
  end

  @doc """
  Link a session to a project.
  Accepts a ClaudeSession struct or a session ID string.
  """
  def link_to_project(%ClaudeSession{} = session, project_id) do
    session
    |> ClaudeSession.changeset(%{project_id: project_id})
    |> Repo.update()
  end

  def link_to_project(session_id, project_id) when is_binary(session_id) do
    case get_session(session_id) do
      nil -> {:error, :not_found}
      session -> link_to_project(session, project_id)
    end
  end

  @doc "Mark a session as completed with ended_at timestamp."
  def complete_session(%ClaudeSession{} = session) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    session
    |> ClaudeSession.changeset(%{status: "completed", ended_at: now})
    |> Repo.update()
  end

  @doc "List sessions that have no linked project."
  def list_unlinked do
    ClaudeSession
    |> where([s], is_nil(s.project_id))
    |> order_by(desc: :started_at)
    |> Repo.all()
  end

  defp generate_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "sess_#{timestamp}_#{random}"
  end
end
