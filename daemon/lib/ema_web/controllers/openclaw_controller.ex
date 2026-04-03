defmodule EmaWeb.OpenClawController do
  use EmaWeb, :controller

  alias Ema.OpenClaw.{Client, AgentBridge}

  action_fallback EmaWeb.FallbackController

  def status(conn, _params) do
    bridge_status = AgentBridge.status()
    json(conn, bridge_status)
  end

  def send_message(conn, %{"session_id" => session_id, "content" => content}) do
    case Client.send_message(session_id, content) do
      {:ok, body} -> json(conn, %{ok: true, data: body})
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def send_message(conn, _params) do
    conn |> put_status(400) |> json(%{error: "session_id and content required"})
  end

  def sessions(conn, _params) do
    case Client.list_sessions() do
      {:ok, body} ->
        sessions = if is_list(body), do: body, else: Map.get(body, "sessions", [])
        json(conn, %{sessions: sessions})

      {:error, reason} ->
        conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def dispatch(conn, %{"agent_type" => agent_type} = params) do
    opts = Map.drop(params, ["agent_type"])

    case Client.spawn_agent(agent_type, opts) do
      {:ok, body} -> json(conn, %{ok: true, data: body})
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def dispatch(conn, _params) do
    conn |> put_status(400) |> json(%{error: "agent_type required"})
  end
end
