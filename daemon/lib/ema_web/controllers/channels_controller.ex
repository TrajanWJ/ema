defmodule EmaWeb.ChannelsController do
  @moduledoc """
  REST controller for the unified channels view.
  Exposes agents as "servers" with chat channels, plus a meta EMA server.
  """

  use EmaWeb, :controller

  alias Ema.Agents
  alias Ema.Agents.WebchatChannelBridge

  action_fallback EmaWeb.FallbackController

  @system_channels ["general", "agents", "tasks", "logs"]

  # GET /api/channels
  def index(conn, _params) do
    agents = Agents.list_active_agents()

    json(conn, %{
      servers: build_servers(agents),
      members: build_members(agents)
    })
  end

  # GET /api/channels/:channel_id/messages
  def messages(conn, %{"channel_id" => channel_id}) do
    case parse_channel_id(channel_id) do
      {:system, _channel_name} ->
        # System channels don't have persisted messages yet
        json(conn, %{messages: []})

      {:agent, slug, _channel_name} ->
        case Agents.get_agent_by_slug(slug) do
          nil ->
            {:error, :not_found}

          agent ->
            {:ok, conv} =
              Agents.get_or_create_conversation(
                agent.id,
                "webchat",
                channel_id,
                "trajan"
              )

            messages =
              Agents.list_messages_by_conversation(conv.id)
              |> Enum.map(&serialize_message/1)

            json(conn, %{
              messages: messages,
              conversation_id: conv.id
            })
        end

      :error ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "invalid_channel_id", message: "Expected format: slug:channel"})
    end
  end

  # POST /api/channels/:channel_id/messages
  def send_message(conn, %{"channel_id" => channel_id, "content" => content}) do
    case parse_channel_id(channel_id) do
      {:system, _channel_name} ->
        # System channels are read-only for now
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "read_only", message: "System channels are read-only"})

      {:agent, slug, _channel_name} ->
        case WebchatChannelBridge.handle_message(slug, content, %{"source" => "channels_ui"}) do
          {:ok, result} ->
            # Broadcast to channel subscribers
            EmaWeb.Endpoint.broadcast(
              "channels:chat:#{channel_id}",
              "new_message",
              %{
                channel_id: channel_id,
                role: "assistant",
                content: result.reply,
                tool_calls: result.tool_calls,
                timestamp: DateTime.utc_now()
              }
            )

            json(conn, %{
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

      :error ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "invalid_channel_id", message: "Expected format: slug:channel"})
    end
  end

  # GET /api/channels/health
  def health(conn, _params) do
    agents = Agents.list_active_agents()

    statuses =
      Enum.flat_map(agents, fn agent ->
        channels = Agents.list_channels_by_agent(agent.id)

        Enum.map(channels, fn ch ->
          %{
            agent_slug: agent.slug,
            channel_type: ch.channel_type,
            active: ch.active,
            connection_status: ch.connection_status,
            config: ch.config
          }
        end)
      end)

    json(conn, %{
      status: "ok",
      channels: statuses,
      agent_count: length(agents)
    })
  end

  # GET /api/channels/inbox
  def inbox(conn, params) do
    limit = parse_int(params["limit"], 50)
    agents = Agents.list_active_agents()

    # Gather recent messages across all agent conversations
    messages =
      agents
      |> Enum.flat_map(fn agent ->
        case Agents.get_or_create_conversation(agent.id, "webchat", nil, "trajan") do
          {:ok, conv} ->
            Agents.list_messages_by_conversation(conv.id)
            |> Enum.map(fn msg ->
              serialize_message(msg)
              |> Map.put(:agent_slug, agent.slug)
              |> Map.put(:agent_name, agent.name)
            end)

          _ ->
            []
        end
      end)
      |> Enum.sort_by(& &1.created_at, {:desc, DateTime})
      |> Enum.take(limit)

    json(conn, %{messages: messages})
  end

  # GET /api/channels/platforms
  def platforms(conn, _params) do
    agents = Agents.list_active_agents()

    # Build platform status from agent channel configs
    platform_map =
      agents
      |> Enum.flat_map(fn agent ->
        channels = Agents.list_channels_by_agent(agent.id)

        Enum.map(channels, fn ch ->
          %{
            platform: ch.channel_type,
            agent_slug: agent.slug,
            agent_name: agent.name,
            active: ch.active,
            connection_status: ch.connection_status || "unknown",
            config: redact_config(ch.config)
          }
        end)
      end)
      |> Enum.group_by(& &1.platform)

    platforms =
      known_platforms()
      |> Enum.map(fn {key, label, icon} ->
        connections = Map.get(platform_map, key, [])
        connected = Enum.any?(connections, & &1.active)

        %{
          key: key,
          label: label,
          icon: icon,
          status: if(connected, do: "connected", else: "not_connected"),
          connections: connections,
          active_channels: length(Enum.filter(connections, & &1.active)),
          total_channels: length(connections)
        }
      end)

    json(conn, %{platforms: platforms})
  end

  # POST /api/channels/send
  def send_cross_platform(conn, %{"platform" => _platform, "channel" => channel_ref, "content" => content}) do
    # Proxy to OpenClaw gateway via HTTP client
    # channel_ref is used as the OpenClaw session ID
    case Ema.OpenClaw.Client.send_message(channel_ref, content) do
      {:ok, result} ->
        json(conn, %{ok: true, result: result})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "send_failed", message: inspect(reason)})
    end
  rescue
    _ ->
      conn
      |> put_status(:service_unavailable)
      |> json(%{error: "openclaw_unavailable", message: "OpenClaw gateway not running"})
  end

  # --- Private helpers ---

  defp known_platforms do
    [
      {"discord", "Discord", "💬"},
      {"telegram", "Telegram", "✈️"},
      {"slack", "Slack", "📨"},
      {"matrix", "Matrix", "🌐"},
      {"signal", "Signal", "🔐"},
      {"whatsapp", "WhatsApp", "📱"},
      {"irc", "IRC", "💻"},
      {"webchat", "Webchat", "💬"},
      {"teams", "Teams", "👥"}
    ]
  end

  defp redact_config(nil), do: %{}
  defp redact_config(config) when is_map(config) do
    config
    |> Map.drop(["token", "api_key", "secret", "password", "webhook_url"])
    |> Map.new(fn {k, v} ->
      if String.contains?(String.downcase(to_string(k)), ["token", "key", "secret"]) do
        {k, "***"}
      else
        {k, v}
      end
    end)
  end
  defp redact_config(_), do: %{}

  defp build_servers(agents) do
    ema_server = %{
      id: "ema",
      name: "EMA",
      icon: "brain",
      channels:
        Enum.map(@system_channels, fn name ->
          %{
            id: "ema:#{name}",
            name: name,
            type: "text",
            unread: 0
          }
        end)
    }

    agent_servers =
      Enum.map(agents, fn agent ->
        %{
          id: agent.slug,
          name: agent.name,
          icon: agent.avatar || "bot",
          status: agent.status,
          channels: [
            %{
              id: "#{agent.slug}:chat",
              name: "chat",
              type: "text",
              unread: 0
            }
          ]
        }
      end)

    [ema_server | agent_servers]
  end

  defp build_members(agents) do
    user = %{
      id: "trajan",
      name: "Trajan",
      role: "admin",
      status: "online",
      avatar: nil
    }

    agent_members =
      Enum.map(agents, fn agent ->
        %{
          id: agent.slug,
          name: agent.name,
          role: "agent",
          status: agent.status,
          avatar: agent.avatar,
          model: agent.model
        }
      end)

    [user | agent_members]
  end

  defp parse_channel_id(channel_id) do
    case String.split(channel_id, ":", parts: 2) do
      ["ema", channel_name] -> {:system, channel_name}
      [slug, channel_name] -> {:agent, slug, channel_name}
      _ -> :error
    end
  end

  defp serialize_message(msg) do
    %{
      id: msg.id,
      role: msg.role,
      content: msg.content,
      tool_calls: msg.tool_calls,
      metadata: msg.metadata,
      created_at: msg.inserted_at
    }
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
