defmodule EmaWeb.MCPController do
  @moduledoc """
  Stub controller for MCP (Model Context Protocol) tool listing and execution.
  """

  use EmaWeb, :controller

  action_fallback EmaWeb.FallbackController

  # GET /api/mcp/tools
  def index(conn, _params) do
    json(conn, %{tools: []})
  end

  # POST /api/mcp/tools/execute
  def execute(conn, _params) do
    conn
    |> put_status(501)
    |> json(%{error: "MCP execution not yet implemented"})
  end
end
