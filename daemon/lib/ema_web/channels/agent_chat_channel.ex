defmodule EmaWeb.AgentChatChannel do
  @moduledoc """
  Phoenix channel for `agents:chat:*` — webchat interface per agent.

  Supports two flows:
  - Standard agents: delegates to AgentWorker (blocking, returns full response)
  - OpenClaw agents: streams response deltas back via `message_delta` events
  """

  use Phoenix.Channel
  require Logger

  alias Ema.Agents
  alias Ema.Agents.WebchatChannelBridge
  alias Ema.Claude.Adapters.OpenClaw, as: OpenClawAdapter

  @impl true
  def join("agents:chat:" <> slug, _payload, socket) do
    case Agents.get_agent_by_slug(slug) do
      nil ->
        {:error, %{reason: "agent_not_found"}}

      agent ->
        socket =
          socket
          |> assign(:agent_slug, slug)
          |> assign(:agent_id, agent.id)
          |> assign(:agent_settings, agent.settings || %{})

        {:ok, %{agent: %{slug: agent.slug, name: agent.name, status: agent.status}}, socket}
    end
  end

  @impl true
  def handle_in("send_message", %{"content" => _content} = payload, socket) do
    handle_in("message", payload, socket)
  end

  def handle_in("message", %{"content" => content} = payload, socket) do
    slug = socket.assigns.agent_slug
    agent_id = socket.assigns.agent_id
    settings = socket.assigns.agent_settings
    metadata = Map.get(payload, "metadata", %{})

    # Send typing indicator
    push(socket, "typing", %{agent: slug})

    if Map.get(settings, "backend") == "openclaw" do
      handle_openclaw_message(socket, agent_id, slug, content, metadata, settings)
    else
      handle_standard_message(socket, slug, content, metadata)
    end
  end

  # -- OpenClaw streaming flow ------------------------------------------------

  defp handle_openclaw_message(socket, agent_id, slug, content, metadata, settings) do
    openclaw_agent_id = Map.get(settings, "openclaw_agent_id", "main")
    channel_pid = self()

    # Store user message
    case Agents.get_or_create_conversation(agent_id, "webchat", "webchat:#{slug}", "webchat_user") do
      {:ok, conversation} ->
        Agents.add_message(%{
          conversation_id: conversation.id,
          role: "user",
          content: content,
          metadata: metadata
        })

        # Stream in a separate task so we don't block the channel
        Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
          accumulated = stream_openclaw_response(channel_pid, openclaw_agent_id, content)

          # Store the full assistant message
          Agents.add_message(%{
            conversation_id: conversation.id,
            role: "assistant",
            content: accumulated,
            metadata: %{"backend" => "openclaw", "agent" => openclaw_agent_id}
          })
        end)

      {:error, reason} ->
        Logger.error("Failed to get/create conversation for #{slug}: #{inspect(reason)}")
        push(socket, "error", %{message: "Failed to start conversation"})
    end

    {:noreply, socket}
  end

  defp stream_openclaw_response(channel_pid, agent_id, message) do
    {:ok, buffer_pid} = Agent.start_link(fn -> "" end)

    callback = fn
      {:delta, text} ->
        send(channel_pid, {:push_delta, text})
        Agent.update(buffer_pid, fn buf -> buf <> text end)

      {:tool_call, event} ->
        send(channel_pid, {:push_tool_call, event})

      :done ->
        send(channel_pid, :push_complete)
    end

    OpenClawAdapter.stream(message, agent_id, callback)

    result = Agent.get(buffer_pid, & &1)
    Agent.stop(buffer_pid)
    result
  end

  # -- Standard (Runner-based) flow -------------------------------------------

  defp handle_standard_message(socket, slug, content, metadata) do
    channel_pid = self()

    Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
      case WebchatChannelBridge.handle_message(slug, content, metadata) do
        {:ok, result} ->
          send(channel_pid, {:push_response, result})

        {:error, :agent_inactive} ->
          send(channel_pid, {:push_error, "Agent is not active"})

        {:error, reason} ->
          Logger.error("Agent chat error for #{slug}: #{inspect(reason)}")
          send(channel_pid, {:push_error, "Failed to process message"})
      end
    end)

    {:noreply, socket}
  end

  # -- Handle messages from streaming tasks -----------------------------------

  @impl true
  def handle_info({:push_delta, text}, socket) do
    push(socket, "message_delta", %{text: text})
    {:noreply, socket}
  end

  def handle_info({:push_tool_call, event}, socket) do
    push(socket, "tool_call", %{
      name: Map.get(event, "name", "unknown"),
      input: Map.get(event, "input", %{}),
      raw: event
    })

    {:noreply, socket}
  end

  def handle_info(:push_complete, socket) do
    push(socket, "message_complete", %{})
    {:noreply, socket}
  end

  def handle_info({:push_response, result}, socket) do
    push(socket, "response", %{
      reply: result.reply,
      tool_calls: result.tool_calls
    })

    {:noreply, socket}
  end

  def handle_info({:push_error, message}, socket) do
    push(socket, "error", %{message: message})
    {:noreply, socket}
  end

  def handle_info(_msg, socket) do
    {:noreply, socket}
  end
end
