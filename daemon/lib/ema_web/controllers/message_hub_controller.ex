defmodule EmaWeb.MessageHubController do
  @moduledoc """
  Message Hub — aggregates messages from channels and agent conversations.
  """

  use EmaWeb, :controller

  alias Ema.Agents

  action_fallback EmaWeb.FallbackController

  # GET /api/messages — aggregate recent messages across all sources
  def index(conn, params) do
    limit = parse_int(params["limit"], 50)
    agents = Agents.list_active_agents()

    messages =
      agents
      |> Enum.flat_map(fn agent ->
        try do
          convs = Agents.list_conversations_by_agent(agent.id)
          Enum.flat_map(convs, fn conv ->
            Agents.list_messages_by_conversation(conv.id)
            |> Enum.map(fn msg ->
              %{
                id: msg.id,
                role: msg.role,
                content: msg.content,
                agent_slug: agent.slug,
                agent_name: agent.name,
                platform: conv.channel_type,
                created_at: msg.inserted_at
              }
            end)
          end)
        rescue
          _ -> []
        end
      end)
      |> Enum.sort_by(& &1.created_at, {:desc, DateTime})
      |> Enum.take(limit)

    json(conn, %{messages: messages})
  end

  # GET /api/messages/conversations — list all active conversations
  def conversations(conn, _params) do
    agents = Agents.list_active_agents()

    conversations =
      agents
      |> Enum.flat_map(fn agent ->
        case Agents.list_conversations_by_agent(agent.id) do
          convs when is_list(convs) ->
            Enum.map(convs, fn conv ->
              %{
                id: conv.id,
                agent_slug: agent.slug,
                agent_name: agent.name,
                platform: conv.channel_type,
                channel_ref: conv.channel_id,
                status: conv.status,
                created_at: conv.inserted_at,
                updated_at: conv.updated_at
              }
            end)

          _ ->
            []
        end
      end)
      |> Enum.sort_by(& &1.updated_at, {:desc, DateTime})

    json(conn, %{conversations: conversations})
  end

  # POST /api/messages/send — route message to appropriate channel
  def send_message(conn, %{"agent_slug" => slug, "content" => content} = params) do
    platform = params["platform"] || "webchat"

    case Agents.WebchatChannelBridge.handle_message(slug, content, %{"source" => platform}) do
      {:ok, result} ->
        json(conn, %{
          ok: true,
          reply: result.reply,
          conversation_id: result.conversation_id,
          tool_calls: result.tool_calls
        })

      {:error, :agent_not_found} ->
        {:error, :not_found}

      {:error, :agent_inactive} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "agent_inactive", message: "Agent is not active"})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "send_failed", message: inspect(reason)})
    end
  end

  def send_message(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "missing_params", message: "Required: agent_slug, content"})
  end

  defp parse_int(nil, default), do: default

  defp parse_int(val, default) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> default
    end
  end

  defp parse_int(val, _default) when is_integer(val), do: val
end
