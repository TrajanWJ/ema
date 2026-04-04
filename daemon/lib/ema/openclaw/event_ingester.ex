defmodule Ema.OpenClaw.EventIngester do
  @moduledoc """
  Consumes OpenClaw gateway events and routes them through EMA's agent system.

  ## Architecture

  OpenClaw is now a thin I/O adapter:
  - OpenClaw receives messages from Discord/Telegram
  - This module ingests those events via AgentBridge polling
  - Routes them through EMA's AgentWorker/RoutingEngine
  - Returns results back to OpenClaw for channel delivery

  ## Flow

    Discord/Telegram
        ↓
    OpenClaw Gateway (I/O adapter)
        ↓  (polled by AgentBridge)
    EventIngester (this module)
        ↓
    RoutingEngine → AgentWorker → Claude
        ↓
    OpenClaw.Client.chat() → channel delivery

  ## State management

  Conversation continuity is maintained in EMA's SQLite (agent_messages table),
  not in OpenClaw's file-based session store. AgentMemory handles compression
  and context loading on agent spawn.
  """

  use GenServer
  require Logger

  alias Ema.OpenClaw.{Client, Config, AgentBridge}
  alias Ema.Agents
  alias Ema.Agents.{AgentWorker, AgentMemory}
  alias Ema.Persistence.SessionStore

  @poll_interval 5_000
  @pubsub Ema.PubSub
  @events_topic "openclaw:events"
  @ingester_topic "openclaw:ingested"

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def status do
    GenServer.call(__MODULE__, :status)
  catch
    :exit, _ -> %{running: false}
  end

  @doc """
  Manually ingest a message event (for testing or manual routing).
  """
  def ingest_event(event) do
    GenServer.cast(__MODULE__, {:ingest, event})
  end

  # --- Callbacks ---

  @impl true
  def init(_opts) do
    # Subscribe to AgentBridge events
    Phoenix.PubSub.subscribe(@pubsub, @events_topic)

    state = %{
      ingested_count: 0,
      routed_count: 0,
      last_event: nil,
      errors: []
    }

    Logger.info("[EventIngester] Started — subscribed to #{@events_topic}")
    {:ok, state}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply,
     %{
       running: true,
       ingested_count: state.ingested_count,
       routed_count: state.routed_count,
       last_event: state.last_event,
       openclaw_sessions: SessionStore.openclaw_session_count()
     }, state}
  end

  @impl true
  def handle_cast({:ingest, event}, state) do
    new_state = process_event(event, state)
    {:noreply, new_state}
  end

  # Receive broadcast events from AgentBridge
  @impl true
  def handle_info({:openclaw, :connected, _payload}, state) do
    Logger.info("[EventIngester] OpenClaw connected — refreshing session mappings")
    {:noreply, state}
  end

  def handle_info({:openclaw, :disconnected, _payload}, state) do
    Logger.info("[EventIngester] OpenClaw disconnected")
    {:noreply, state}
  end

  def handle_info({:openclaw, event_type, payload}, state) do
    new_state = process_openclaw_event(event_type, payload, state)
    {:noreply, new_state}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  # --- Internal ---

  defp process_openclaw_event(:message, payload, state) do
    process_event(payload, state)
  end

  defp process_openclaw_event(_event_type, _payload, state) do
    state
  end

  defp process_event(event, state) when is_map(event) do
    session_id = Map.get(event, "session_id", Map.get(event, :session_id))
    content = Map.get(event, "content", Map.get(event, :content, ""))
    channel_type = Map.get(event, "channel_type", Map.get(event, :channel_type, "discord"))
    agent_id_hint = Map.get(event, "agent_id", Map.get(event, :agent_id))

    if is_nil(session_id) or content == "" do
      state
    else
      state = %{state | ingested_count: state.ingested_count + 1, last_event: DateTime.utc_now()}

      case route_to_ema(session_id, content, channel_type, agent_id_hint) do
        {:ok, reply} ->
          broadcast_result(session_id, reply, channel_type)
          %{state | routed_count: state.routed_count + 1}

        {:error, reason} ->
          Logger.warning("[EventIngester] Routing failed for session #{session_id}: #{inspect(reason)}")
          %{state | errors: [{session_id, reason} | Enum.take(state.errors, 9)]}
      end
    end
  end

  defp process_event(_event, state), do: state

  defp route_to_ema(oc_session_id, content, channel_type, agent_id_hint) do
    # Resolve or create an EMA conversation for this OC session
    with {:ok, agent_id, conversation_id} <- resolve_context(oc_session_id, channel_type, agent_id_hint) do
      metadata = %{
        channel_type: channel_type,
        openclaw_session_id: oc_session_id,
        source: "openclaw_ingester"
      }

      Logger.info("[EventIngester] Routing OC #{oc_session_id} → agent #{agent_id}, conversation #{conversation_id}")

      case AgentWorker.send_and_route(agent_id, conversation_id, content, metadata) do
        {:ok, result} -> {:ok, result.reply}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp resolve_context(oc_session_id, channel_type, agent_id_hint) do
    case SessionStore.get_openclaw_session(oc_session_id) do
      {:ok, %{agent_id: agent_id, conversation_id: conversation_id}} when not is_nil(conversation_id) ->
        {:ok, agent_id, conversation_id}

      _ ->
        # New session — create or look up agent + conversation
        create_context_for_session(oc_session_id, channel_type, agent_id_hint)
    end
  end

  defp create_context_for_session(oc_session_id, channel_type, agent_id_hint) do
    agent_slug = resolve_agent_slug(agent_id_hint)

    case Agents.get_agent_by_slug(agent_slug) do
      nil ->
        Logger.warning("[EventIngester] No agent found for slug #{agent_slug}")
        {:error, {:agent_not_found, agent_slug}}

      agent ->
        # Find or create a conversation for this OC session
        conversation_id = find_or_create_conversation(agent.id, oc_session_id, channel_type)

        # Register in SessionStore for future lookups
        SessionStore.put_openclaw_session(oc_session_id, agent.id,
          conversation_id: conversation_id,
          channel_type: channel_type
        )

        # Also track in AgentMemory if the agent is running
        case Registry.lookup(Ema.Agents.Registry, {:memory, agent.id}) do
          [{_pid, _}] ->
            AgentMemory.record_openclaw_session(agent.id, oc_session_id, conversation_id)
          [] ->
            :ok
        end

        {:ok, agent.id, conversation_id}
    end
  end

  defp find_or_create_conversation(agent_id, oc_session_id, channel_type) do
    # Look for an existing conversation tagged with this OC session
    existing =
      Agents.list_conversations_by_agent(agent_id)
      |> Enum.find(fn conv ->
        meta = conv.metadata || %{}
        Map.get(meta, "openclaw_session_id") == oc_session_id
      end)

    if existing do
      existing.id
    else
      title = "OpenClaw #{channel_type} — #{String.slice(oc_session_id, 0, 12)}"

      case Agents.create_conversation(%{
             agent_id: agent_id,
             title: title,
             status: "active",
             metadata: %{
               "openclaw_session_id" => oc_session_id,
               "channel_type" => channel_type,
               "source" => "openclaw_ingester"
             }
           }) do
        {:ok, conv} -> conv.id
        {:error, reason} ->
          Logger.error("[EventIngester] Failed to create conversation: #{inspect(reason)}")
          "fallback_#{oc_session_id}"
      end
    end
  end

  defp resolve_agent_slug(nil), do: Config.default_agent()
  defp resolve_agent_slug(agent_id) when is_binary(agent_id) do
    # Normalize "main" → "right-hand" (EMA slug convention)
    case agent_id do
      "main" -> "right-hand"
      slug -> slug
    end
  end

  defp broadcast_result(oc_session_id, reply, channel_type) do
    Phoenix.PubSub.broadcast(@pubsub, @ingester_topic, %{
      event: :routed_reply,
      oc_session_id: oc_session_id,
      reply: reply,
      channel_type: channel_type,
      timestamp: DateTime.utc_now()
    })
  end
end
