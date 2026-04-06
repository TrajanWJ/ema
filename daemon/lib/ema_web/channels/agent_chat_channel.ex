defmodule EmaWeb.AgentChatChannel do
  @moduledoc """
  Phoenix channel for `agents:chat:*` — webchat interface per agent.

  Delegates to AgentWorker (blocking, returns full response).
  """

  use Phoenix.Channel
  require Logger

  alias Ema.Agents
  alias Ema.Agents.WebchatChannelBridge

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
    metadata = Map.get(payload, "metadata", %{})

    # Send typing indicator
    push(socket, "typing", %{agent: slug})

    handle_standard_message(socket, slug, content, metadata)
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
