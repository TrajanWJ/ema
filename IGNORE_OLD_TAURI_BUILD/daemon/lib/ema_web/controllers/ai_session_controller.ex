defmodule EmaWeb.AiSessionController do
  use EmaWeb, :controller

  alias Ema.Claude.SessionManager

  def index(conn, params) do
    filters = %{}
    filters = if params["status"], do: Map.put(filters, :status, params["status"]), else: filters

    filters =
      if params["agent_id"], do: Map.put(filters, :agent_id, params["agent_id"]), else: filters

    case SessionManager.list_sessions(filters) do
      {:ok, sessions} ->
        json(conn, %{sessions: Enum.map(sessions, &serialize/1)})

      {:error, reason} ->
        conn |> put_status(500) |> json(%{error: inspect(reason)})
    end
  end

  def create(conn, params) do
    opts = %{
      model: params["model"] || "sonnet",
      title: params["title"],
      project_path: params["project_path"],
      agent_id: params["agent_id"],
      metadata: params["metadata"] || %{}
    }

    case SessionManager.create_session(opts) do
      {:ok, session} ->
        conn |> put_status(201) |> json(%{session: serialize(session)})

      {:error, reason} ->
        conn |> put_status(422) |> json(%{error: inspect(reason)})
    end
  end

  def show(conn, %{"id" => id}) do
    case SessionManager.get_session(id) do
      {:ok, %{session: session, messages: messages}} ->
        json(conn, %{
          session: serialize(session),
          messages: Enum.map(messages, &serialize_message/1)
        })

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "not_found"})
    end
  end

  def resume(conn, %{"id" => id}) do
    case SessionManager.resume_session(id) do
      {:ok, session} ->
        json(conn, %{session: serialize(session)})

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "not_found"})
    end
  end

  def fork(conn, %{"id" => id} = params) do
    message_id = params["message_id"]

    unless message_id do
      conn |> put_status(422) |> json(%{error: "message_id required"})
    else
      case SessionManager.fork_session(id, message_id) do
        {:ok, session} ->
          conn |> put_status(201) |> json(%{session: serialize(session)})

        {:error, :not_found} ->
          conn |> put_status(404) |> json(%{error: "not_found"})

        {:error, reason} ->
          conn |> put_status(422) |> json(%{error: inspect(reason)})
      end
    end
  end

  defp serialize(session) do
    %{
      id: session.id,
      model: session.model,
      status: session.status,
      message_count: session.message_count,
      total_input_tokens: session.total_input_tokens,
      total_output_tokens: session.total_output_tokens,
      cost_usd: session.cost_usd,
      title: session.title,
      project_path: session.project_path,
      parent_session_id: session.parent_session_id,
      agent_id: session.agent_id,
      inserted_at: session.inserted_at,
      updated_at: session.updated_at
    }
  end

  defp serialize_message(msg) do
    %{
      id: msg.id,
      role: msg.role,
      content: msg.content,
      token_count: msg.token_count,
      tool_calls: msg.tool_calls,
      metadata: msg.metadata,
      inserted_at: msg.inserted_at
    }
  end
end
