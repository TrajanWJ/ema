defmodule EmaWeb.MCPController do
  @moduledoc """
  HTTP bridge for MCP tool discovery and execution.

  This is not a full JSON-RPC endpoint; it exposes the same underlying tool
  registry and dispatch used by the stdio MCP server so local operators can
  inspect and smoke-test the MCP surface over HTTP.
  """

  use EmaWeb, :controller

  alias Ema.MCP.{Resources, SessionTools, Tools}

  # GET /api/mcp/tools
  def index(conn, _params) do
    json(conn, %{
      tools: Tools.list() ++ SessionTools.list(),
      resources: Resources.list()
    })
  end

  # POST /api/mcp/tools/execute
  def execute(conn, %{"name" => name} = params) do
    arguments = Map.get(params, "arguments", %{})
    request_id = get_in(params, ["_meta", "requestId"]) || request_id()

    result =
      if String.starts_with?(name, "ema_") do
        SessionTools.call(name, arguments, request_id)
      else
        Tools.call(name, arguments, request_id)
      end

    case result do
      {:ok, body} ->
        json(conn, %{ok: true, name: name, result: body, request_id: request_id})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{ok: false, name: name, error: format_error(reason), request_id: request_id})
    end
  end

  def execute(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{ok: false, error: "Missing required parameter 'name'"})
  end

  defp format_error(reason) when is_binary(reason), do: reason
  defp format_error(reason), do: inspect(reason)

  defp request_id do
    "http-" <> (:crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower))
  end
end
