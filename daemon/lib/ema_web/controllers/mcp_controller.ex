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

    result = dispatch_tool(name, arguments, request_id)

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

  defp dispatch_tool(name, arguments, request_id) do
    cond do
      name in ~w(
        ema_get_intents
        ema_create_intent
        ema_get_intent_tree
        ema_get_intent_context
        ema_attach_intent_actor
        ema_attach_intent_execution
        ema_attach_intent_session
        ema_get_intent_runtime
      ) ->
        Tools.call(name, arguments, request_id)

      String.starts_with?(name, "ema_") ->
        SessionTools.call(name, arguments, request_id)

      true ->
        Tools.call(name, arguments, request_id)
    end
  end

  defp request_id do
    "http-" <> (:crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower))
  end
end
