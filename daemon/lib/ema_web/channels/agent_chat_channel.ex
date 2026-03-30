defmodule EmaWeb.AgentChatChannel do
  @moduledoc """
  Phoenix channel for `agents:chat:*` — webchat interface per agent.
  Messages received here are forwarded to the AgentWorker via WebchatChannelBridge.
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

        {:ok, %{agent: %{slug: agent.slug, name: agent.name, status: agent.status}}, socket}
    end
  end

  @impl true
  def handle_in("message", %{"content" => content} = payload, socket) do
    slug = socket.assigns.agent_slug
    metadata = Map.get(payload, "metadata", %{})

    # Send typing indicator
    push(socket, "typing", %{agent: slug})

    # Process in a task to avoid blocking the channel
    task =
      Task.async(fn ->
        WebchatChannelBridge.handle_message(slug, content, metadata)
      end)

    case Task.await(task, 180_000) do
      {:ok, result} ->
        push(socket, "response", %{
          reply: result.reply,
          tool_calls: result.tool_calls
        })

        {:noreply, socket}

      {:error, :agent_inactive} ->
        push(socket, "error", %{message: "Agent is not active"})
        {:noreply, socket}

      {:error, reason} ->
        Logger.error("Agent chat error for #{slug}: #{inspect(reason)}")
        push(socket, "error", %{message: "Failed to process message"})
        {:noreply, socket}
    end
  end
end
