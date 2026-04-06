defmodule EmaWeb.IntelligenceController do
  @moduledoc """
  Handles MCP audit logging and outcome tracking.

  POST /api/intelligence/outcomes   — log task outcomes (success/failure/warning)
  POST /api/intelligence/mcp-calls  — audit log for every MCP tool invocation
  """

  use EmaWeb, :controller

  require Logger

  @doc """
  Log a task outcome from MCP tool execution.

  Params: task_id, outcome, feedback, duration_seconds, source, mcp_request_id
  """
  def log_outcome(conn, params) do
    outcome = %{
      task_id: params["task_id"],
      outcome: params["outcome"],
      feedback: params["feedback"],
      duration_seconds: params["duration_seconds"],
      source: params["source"],
      mcp_request_id: params["mcp_request_id"],
      logged_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }

    Logger.info("[Intelligence] Outcome logged: #{params["outcome"]} for task #{params["task_id"]}")

    # Broadcast for any listeners (pipes, dashboard, etc.)
    Phoenix.PubSub.broadcast(Ema.PubSub, "intelligence:outcomes", {:outcome_logged, outcome})

    json(conn, %{
      status: "ok",
      outcome: outcome,
      insights: [],
      patterns_detected: []
    })
  end

  @doc """
  Audit log for MCP tool calls (cost tracking, debugging).

  Params: tool, request_id, result, duration_ms, depth, logged_at
  """
  def log_mcp_call(conn, params) do
    call_record = %{
      tool: params["tool"],
      request_id: params["request_id"],
      result: params["result"],
      duration_ms: params["duration_ms"],
      depth: params["depth"],
      logged_at: params["logged_at"] || DateTime.utc_now() |> DateTime.to_iso8601()
    }

    Logger.debug("[Intelligence] MCP call: #{params["tool"]} => #{params["result"]} (#{params["duration_ms"]}ms)")

    # Broadcast for observability
    Phoenix.PubSub.broadcast(Ema.PubSub, "intelligence:mcp_calls", {:mcp_call_logged, call_record})

    json(conn, %{status: "ok", call: call_record})
  end
end
