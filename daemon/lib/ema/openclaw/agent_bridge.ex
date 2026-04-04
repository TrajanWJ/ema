defmodule Ema.OpenClaw.AgentBridge do
  @moduledoc """
  GenServer that polls the OpenClaw gateway for events and broadcasts them via PubSub.

  ## What it does

  1. Every @poll_interval ms, checks if the gateway is reachable (GET /api/status)
  2. If reachable, calls sessions.list via WebSocket RPC to enumerate active sessions
  3. For any session whose updatedAt has advanced since last poll, fetches the last
     few messages via chat.history and broadcasts new user messages as:
       {:openclaw, :message, %{session_id: key, content: text, channel_type: type, agent_id: agent}}
  4. EventIngester is subscribed to "openclaw:events" and will route those messages
     through EMA's agent system.

  ## Degradation

  If the WebSocket RPC fails (gateway unreachable, wrong version, auth issues),
  AgentBridge falls back to HTTP-only mode: it still broadcasts :connected/:disconnected
  but emits a warning and skips message polling until the next cycle.
  """

  use GenServer
  require Logger

  alias Ema.OpenClaw.{Client, GatewayRPC}

  @poll_interval 5_000
  @pubsub Ema.PubSub
  @topic "openclaw:events"

  # Track sessions as %{session_key => updated_at_ms}
  defstruct connected: false,
            last_check: nil,
            last_error: nil,
            seen_sessions: %{}

  # -- Public API --

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def connected? do
    GenServer.call(__MODULE__, :connected?)
  catch
    :exit, _ -> false
  end

  def status do
    GenServer.call(__MODULE__, :status)
  catch
    :exit, _ -> %{connected: false, last_check: nil, error: "bridge not running"}
  end

  def topic, do: @topic

  # -- GenServer callbacks --

  @impl true
  def init(_opts) do
    send(self(), :poll)
    {:ok, %__MODULE__{}}
  end

  @impl true
  def handle_call(:connected?, _from, state) do
    {:reply, state.connected, state}
  end

  def handle_call(:status, _from, state) do
    {:reply,
     %{
       connected: state.connected,
       last_check: state.last_check,
       session_count: map_size(state.seen_sessions),
       error: state.last_error
     }, state}
  end

  @impl true
  def handle_info(:poll, state) do
    new_state =
      case Client.get_status() do
        {:ok, _body} ->
          state = maybe_announce_connected(state)
          state = poll_messages(state)
          %{state | last_check: DateTime.utc_now(), last_error: nil}

        {:error, reason} ->
          if state.connected do
            Logger.warning("[AgentBridge] Lost connection: #{inspect(reason)}")
            broadcast(:disconnected, %{reason: inspect(reason)})
          end

          %{state | connected: false, last_check: DateTime.utc_now(), last_error: inspect(reason)}
      end

    Process.send_after(self(), :poll, @poll_interval)
    {:noreply, new_state}
  end

  # -- Internal --

  defp maybe_announce_connected(%{connected: false} = state) do
    Logger.info("[AgentBridge] Connected to OpenClaw gateway")
    broadcast(:connected, %{})
    %{state | connected: true}
  end

  defp maybe_announce_connected(state), do: state

  defp poll_messages(state) do
    case GatewayRPC.call("sessions.list", %{}) do
      {:ok, sessions} when is_list(sessions) ->
        process_sessions(sessions, state)

      {:ok, %{"sessions" => sessions}} when is_list(sessions) ->
        process_sessions(sessions, state)

      {:error, reason} ->
        Logger.debug("[AgentBridge] sessions.list RPC failed (degraded mode): #{inspect(reason)}")
        state
    end
  end

  defp process_sessions(sessions, state) do
    Enum.reduce(sessions, state, fn session, acc ->
      key = session_key(session)
      updated_at = session_updated_at(session)

      prev_updated_at = Map.get(acc.seen_sessions, key, 0)

      if key && updated_at > prev_updated_at do
        fetch_and_broadcast_messages(key, session)
        %{acc | seen_sessions: Map.put(acc.seen_sessions, key, updated_at)}
      else
        acc
      end
    end)
  end

  defp fetch_and_broadcast_messages(session_key, session_meta) do
    case GatewayRPC.call("chat.history", %{sessionKey: session_key, limit: 5}) do
      {:ok, %{"messages" => messages}} when is_list(messages) ->
        broadcast_new_user_messages(session_key, messages, session_meta)

      {:ok, messages} when is_list(messages) ->
        broadcast_new_user_messages(session_key, messages, session_meta)

      {:error, reason} ->
        Logger.debug("[AgentBridge] chat.history failed for #{session_key}: #{inspect(reason)}")
    end
  end

  defp broadcast_new_user_messages(session_key, messages, session_meta) do
    messages
    |> Enum.filter(fn m ->
      role = Map.get(m, "role", Map.get(m, :role))
      role == "user"
    end)
    |> Enum.take(-2)
    |> Enum.each(fn msg ->
      content = extract_content(msg)

      if content && content != "" do
        payload = %{
          session_id: session_key,
          content: content,
          channel_type: infer_channel_type(session_key, session_meta),
          agent_id: infer_agent_id(session_key)
        }

        Logger.debug("[AgentBridge] Broadcasting message from session #{session_key}")
        broadcast(:message, payload)
      end
    end)
  end

  defp extract_content(%{"content" => content}) when is_binary(content), do: content

  defp extract_content(%{"content" => content}) when is_list(content) do
    content
    |> Enum.filter(fn part -> Map.get(part, "type") == "text" end)
    |> Enum.map(fn part -> Map.get(part, "text", "") end)
    |> Enum.join(" ")
  end

  defp extract_content(_), do: nil

  defp session_key(session) do
    Map.get(session, "key") || Map.get(session, "sessionKey")
  end

  defp session_updated_at(session) do
    Map.get(session, "updatedAt") || Map.get(session, "updated_at") || 0
  end

  defp infer_channel_type(session_key, _meta) when is_binary(session_key) do
    cond do
      String.contains?(session_key, ":discord:") -> "discord"
      String.contains?(session_key, ":telegram:") -> "telegram"
      String.contains?(session_key, ":slack:") -> "slack"
      true -> "openclaw"
    end
  end

  defp infer_channel_type(_, _), do: "openclaw"

  defp infer_agent_id(session_key) when is_binary(session_key) do
    # Session keys look like: "agent:main:discord:channel:12345"
    case String.split(session_key, ":") do
      ["agent", agent_id | _] -> agent_id
      _ -> "main"
    end
  end

  defp infer_agent_id(_), do: "main"

  defp broadcast(event, payload) do
    Phoenix.PubSub.broadcast(@pubsub, @topic, {:openclaw, event, payload})
  end
end
