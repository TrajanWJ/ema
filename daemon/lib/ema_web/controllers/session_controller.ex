defmodule EmaWeb.SessionController do
  use EmaWeb, :controller

  alias Ema.ClaudeSessions

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:project_id, params["project_id"])
      |> maybe_add(:status, params["status"])
      |> maybe_add(:limit, parse_int(params["limit"]))

    sessions =
      ClaudeSessions.list_sessions(opts)
      |> Enum.map(&serialize_session/1)

    json(conn, %{sessions: sessions})
  end

  def active(conn, _params) do
    sessions =
      ClaudeSessions.get_active_sessions()
      |> Enum.map(&serialize_session/1)

    json(conn, %{sessions: sessions})
  end

  def link(conn, %{"id" => id} = params) do
    project_id = params["project_id"]

    if is_nil(project_id) do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{error: "project_id is required"})
    else
      case ClaudeSessions.link_to_project(id, project_id) do
        {:ok, session} ->
          json(conn, serialize_session(session))

        {:error, :not_found} ->
          {:error, :not_found}

        {:error, changeset} ->
          {:error, changeset}
      end
    end
  end

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, value), do: Keyword.put(opts, key, value)

  defp parse_int(nil), do: nil
  defp parse_int(val) when is_integer(val), do: val

  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> nil
    end
  end

  defp serialize_session(session) do
    %{
      id: session.id,
      session_id: session.session_id,
      project_path: session.project_path,
      project_id: session.project_id,
      started_at: session.started_at,
      ended_at: session.ended_at,
      last_active: session.last_active,
      status: session.status,
      token_count: session.token_count,
      tool_calls: session.tool_calls,
      files_touched: session.files_touched,
      summary: session.summary,
      raw_path: session.raw_path,
      metadata: session.metadata,
      created_at: session.inserted_at,
      updated_at: session.updated_at
    }
  end
end
