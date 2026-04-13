defmodule EmaWeb.ClaudeSessionChannel do
  @moduledoc """
  Phoenix channel for interactive Claude Bridge sessions.

  Join `claude_sessions:lobby` for session list updates.
  Join `claude_sessions:{session_id}` for streaming output from a specific session.
  """

  use Phoenix.Channel
  require Logger

  alias Ema.ClaudeSessions.SessionManager
  alias Ema.Claude.Bridge

  @impl true
  def join("claude_sessions:lobby", _payload, socket) do
    send(self(), :send_snapshot)
    Phoenix.PubSub.subscribe(Ema.PubSub, SessionManager.pubsub_topic())
    {:ok, socket}
  end

  @impl true
  def join("claude_sessions:" <> session_id, _payload, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, Bridge.pubsub_topic())
    {:ok, assign(socket, :session_id, session_id)}
  end

  # --- Incoming messages ---

  @impl true
  def handle_in("create", %{"project_path" => path} = payload, socket) do
    model = Map.get(payload, "model", "sonnet")
    project_id = Map.get(payload, "project_id")
    opts = if project_id, do: [project_id: project_id], else: []

    case SessionManager.create(path, model, opts) do
      {:ok, session} ->
        {:reply, {:ok, serialize_session(session)}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  @impl true
  def handle_in("continue", %{"session_id" => sid, "prompt" => prompt}, socket) do
    case SessionManager.continue(sid, prompt) do
      :ok -> {:reply, :ok, socket}
      {:error, reason} -> {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  @impl true
  def handle_in("kill", %{"session_id" => sid}, socket) do
    case SessionManager.kill(sid) do
      :ok -> {:reply, :ok, socket}
      {:error, reason} -> {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  @impl true
  def handle_in("list", _payload, socket) do
    sessions = SessionManager.list() |> Enum.map(&serialize_session/1)
    {:reply, {:ok, %{sessions: sessions}}, socket}
  end

  # --- PubSub events ---

  @impl true
  def handle_info(:send_snapshot, socket) do
    sessions = SessionManager.list() |> Enum.map(&serialize_session/1)
    push(socket, "snapshot", %{sessions: sessions})
    {:noreply, socket}
  end

  # Session lifecycle events (lobby)
  @impl true
  def handle_info({:session_created, data}, socket) do
    push(socket, "session_created", data)
    {:noreply, socket}
  end

  @impl true
  def handle_info({:session_killed, data}, socket) do
    push(socket, "session_killed", data)
    {:noreply, socket}
  end

  @impl true
  def handle_info({:session_ended, data}, socket) do
    push(socket, "session_ended", data)
    {:noreply, socket}
  end

  # Streaming events (per-session channel)
  @impl true
  def handle_info({:claude_event, session_id, event}, socket) do
    # Only forward events for the session this channel is subscribed to
    if Map.get(socket.assigns, :session_id) == session_id do
      push(socket, "stream_event", encode_event(event))
    end

    {:noreply, socket}
  end

  @impl true
  def handle_info(_msg, socket) do
    {:noreply, socket}
  end

  # --- Serialization ---

  defp serialize_session(session) do
    %{
      id: session.id,
      project_path: session.project_path,
      project_id: session.project_id,
      model: session.model,
      status: session.status,
      started_at: session.started_at,
      last_active: session.last_active
    }
  end

  defp encode_event({type, data}) when is_map(data) do
    %{type: Atom.to_string(type), data: data}
  end

  defp encode_event({:text_delta, text}) do
    %{type: "text_delta", data: %{text: text}}
  end

  defp encode_event({type, data}) do
    %{type: Atom.to_string(type), data: inspect(data)}
  end
end
