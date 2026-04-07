defmodule EmaWeb.ChannelsChannel do
  @moduledoc """
  Phoenix channel for `channels:*` — real-time updates for the unified channels UI.

  Topics:
    - `channels:lobby` — server list, health, presence updates
    - `channels:chat:<channel_id>` — per-channel message stream

  Pushed events: new_message, health_update, typing, member_update
  """

  use Phoenix.Channel
  require Logger

  alias Ema.Agents
  alias Ema.Agents.WebchatChannelBridge

  @impl true
  def join("channels:lobby", _payload, socket) do
    agents = Agents.list_active_agents()

    # Subscribe to cross-cutting PubSub topics
    Phoenix.PubSub.subscribe(Ema.PubSub, "channels:messages")
    Phoenix.PubSub.subscribe(Ema.PubSub, "channels:health")

    servers = build_servers(agents)
    health = build_health(agents)

    {:ok, %{servers: servers, health: health}, socket}
  end

  @impl true
  def join("channels:chat:" <> channel_id, _payload, socket) do
    # Subscribe to channel-specific PubSub topic
    Phoenix.PubSub.subscribe(Ema.PubSub, "channels:chat:#{channel_id}")

    socket =
      socket
      |> assign(:channel_id, channel_id)

    # Load recent messages
    messages = load_recent_messages(channel_id)

    {:ok, %{messages: messages, channel_id: channel_id}, socket}
  end

  @impl true
  def handle_in("message", %{"content" => content}, socket) do
    channel_id = socket.assigns.channel_id

    # Broadcast user message immediately
    broadcast!(socket, "new_message", %{
      channel_id: channel_id,
      role: "user",
      content: content,
      timestamp: DateTime.utc_now()
    })

    # Push typing indicator
    broadcast!(socket, "typing", %{channel_id: channel_id, who: "agent"})

    # Route to agent in a background task
    task_ref = make_ref()
    me = self()

    Task.start(fn ->
      result = route_message(channel_id, content)
      send(me, {:agent_reply, task_ref, result})
    end)

    {:noreply, assign(socket, :pending_task, task_ref)}
  end

  @impl true
  def handle_in("typing", _payload, socket) do
    broadcast!(socket, "typing", %{
      channel_id: socket.assigns.channel_id,
      who: "user"
    })

    {:noreply, socket}
  end

  # Handle agent reply from background task
  @impl true
  def handle_info({:agent_reply, _ref, {:ok, result}}, socket) do
    push(socket, "new_message", %{
      channel_id: socket.assigns.channel_id,
      role: "assistant",
      content: result.reply,
      tool_calls: result.tool_calls,
      conversation_id: result.conversation_id,
      timestamp: DateTime.utc_now()
    })

    {:noreply, socket}
  end

  def handle_info({:agent_reply, _ref, {:error, reason}}, socket) do
    Logger.error("Channel message error: #{inspect(reason)}")

    push(socket, "error", %{
      message: "Failed to process message",
      channel_id: socket.assigns.channel_id
    })

    {:noreply, socket}
  end

  # Handle PubSub broadcasts
  def handle_info({:new_message, msg}, socket) do
    push(socket, "new_message", msg)
    {:noreply, socket}
  end

  def handle_info({:health_update, status}, socket) do
    push(socket, "health_update", status)
    {:noreply, socket}
  end

  def handle_info({:member_update, member}, socket) do
    push(socket, "member_update", member)
    {:noreply, socket}
  end

  # --- Private helpers ---

  defp build_servers(agents) do
    system_channels = ["general", "agents", "tasks", "logs"]

    ema_server = %{
      id: "ema",
      name: "EMA",
      icon: "brain",
      channels:
        Enum.map(system_channels, fn name ->
          %{id: "ema:#{name}", name: name, type: "text"}
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
            %{id: "#{agent.slug}:chat", name: "chat", type: "text"}
          ]
        }
      end)

    [ema_server | agent_servers]
  end

  defp build_health(agents) do
    Enum.map(agents, fn agent ->
      channels = Agents.list_channels_by_agent(agent.id)

      %{
        agent_slug: agent.slug,
        status: agent.status,
        channels:
          Enum.map(channels, fn ch ->
            %{
              channel_type: ch.channel_type,
              active: ch.active,
              connection_status: channel_connection_status(ch)
            }
          end)
      }
    end)
  end

  defp load_recent_messages(channel_id) do
    case parse_channel_id(channel_id) do
      {:agent, slug, _name} ->
        case Agents.get_agent_by_slug(slug) do
          nil ->
            []

          agent ->
            case Agents.get_or_create_conversation(agent.id, "webchat", channel_id, "trajan") do
              {:ok, conv} ->
                Agents.list_messages_by_conversation(conv.id)
                |> Enum.take(-50)
                |> Enum.map(&serialize_message/1)

              _ ->
                []
            end
        end

      _ ->
        []
    end
  end

  defp route_message(channel_id, content) do
    case parse_channel_id(channel_id) do
      {:agent, slug, _name} ->
        WebchatChannelBridge.handle_message(slug, content, %{"source" => "channels_ui"})

      {:system, _name} ->
        {:error, :system_channel_read_only}

      :error ->
        {:error, :invalid_channel_id}
    end
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

  defp channel_connection_status(channel) do
    Map.get(channel, :connection_status) || Map.get(channel, :status) || "unknown"
  end
end
