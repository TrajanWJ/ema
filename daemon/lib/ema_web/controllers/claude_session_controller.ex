defmodule EmaWeb.ClaudeSessionController do
  use EmaWeb, :controller

  alias Ema.ClaudeSessions
  alias Ema.ClaudeSessions.SessionManager

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    # Prefer live bridge sessions from SessionManager, fall back to DB
    bridge_sessions = SessionManager.list() |> Enum.map(&serialize_bridge_session/1)

    db_opts =
      []
      |> maybe_put(:project_id, params["project_id"])
      |> maybe_put(:status, params["status"])
      |> maybe_put(:limit, parse_int(params["limit"]))

    db_sessions = ClaudeSessions.list_sessions(db_opts) |> Enum.map(&serialize_db_session/1)

    json(conn, %{bridge_sessions: bridge_sessions, sessions: db_sessions})
  end

  def create(conn, params) do
    project_path = params["project_path"]
    model = params["model"] || "sonnet"
    opts = if params["project_id"], do: [project_id: params["project_id"]], else: []

    case SessionManager.create(project_path, model, opts) do
      {:ok, session} ->
        conn
        |> put_status(:created)
        |> json(%{session: serialize_bridge_session(session)})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "create_failed", message: inspect(reason)})
    end
  end

  def show(conn, %{"id" => id}) do
    case SessionManager.find(id) do
      {:ok, session} ->
        json(conn, %{session: serialize_bridge_session(session)})

      :not_found ->
        # Fall back to DB lookup
        case ClaudeSessions.get_session(id) do
          nil -> {:error, :not_found}
          session -> json(conn, %{session: serialize_db_session(session)})
        end
    end
  end

  def continue(conn, %{"id" => id} = params) do
    prompt = params["prompt"] || ""

    case SessionManager.continue(id, prompt) do
      :ok ->
        json(conn, %{ok: true, session_id: id})

      {:error, :not_found} ->
        {:error, :not_found}

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "continue_failed", message: inspect(reason)})
    end
  end

  def kill(conn, %{"id" => id}) do
    case SessionManager.kill(id) do
      :ok ->
        json(conn, %{ok: true, session_id: id})

      {:error, :not_found} ->
        {:error, :not_found}

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "kill_failed", message: inspect(reason)})
    end
  end

  # --- Serializers ---

  defp serialize_bridge_session(session) do
    %{
      id: session.id,
      project_path: session[:project_path],
      project_id: session[:project_id],
      model: session[:model],
      status: session.status,
      started_at: session[:started_at],
      last_active: session[:last_active]
    }
  end

  defp serialize_db_session(session) do
    %{
      id: session.id,
      session_id: session.session_id,
      project_path: session.project_path,
      status: session.status,
      token_count: session.token_count,
      files_touched: session.files_touched,
      started_at: session.started_at,
      ended_at: session.ended_at,
      last_active: session.last_active,
      summary: session.summary,
      created_at: session.inserted_at
    }
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)

  defp parse_int(nil), do: nil

  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, ""} -> n
      _ -> nil
    end
  end

  defp parse_int(val) when is_integer(val), do: val
  defp parse_int(_), do: nil
end
