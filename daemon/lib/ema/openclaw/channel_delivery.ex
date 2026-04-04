defmodule Ema.OpenClaw.ChannelDelivery do
  @moduledoc """
  Delivers EMA agent replies back to OpenClaw for channel distribution.

  ## Flow

    AgentWorker completes a reply
        ↓
    Broadcasts %{event: :agent_response, channel_type: "openclaw", ...} to "channels:messages"
        ↓
    ChannelDelivery receives it (subscribed to "channels:messages")
        ↓
    Resolves the OpenClaw session key from conversation metadata
        ↓
    Calls chat.inject via GatewayRPC to inject the assistant reply into the session
        ↓
    OpenClaw streams/broadcasts the reply to the originating Discord/Telegram channel

  ## Session key resolution

  The OpenClaw session key is stored in SessionStore under the conversation ID.
  It is written there by EventIngester when a new message arrives.
  Format: "agent:<agent_id>:<channel_type>:channel:<channel_id>"
  """

  use GenServer
  require Logger

  alias Ema.OpenClaw.GatewayRPC
  alias Ema.Persistence.SessionStore

  @pubsub Ema.PubSub
  @messages_topic "channels:messages"

  # -- Public API --

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def status do
    GenServer.call(__MODULE__, :status)
  catch
    :exit, _ -> %{running: false}
  end

  # -- Callbacks --

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(@pubsub, @messages_topic)
    Logger.info("[ChannelDelivery] Started — subscribed to #{@messages_topic}")

    state = %{
      delivered_count: 0,
      failed_count: 0,
      last_delivery: nil
    }

    {:ok, state}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply,
     %{
       running: true,
       delivered_count: state.delivered_count,
       failed_count: state.failed_count,
       last_delivery: state.last_delivery
     }, state}
  end

  # Handle agent_response events from AgentWorker.send_and_route/4
  @impl true
  def handle_info(
        %{event: :agent_response, channel_type: channel_type, conversation_id: conversation_id,
          reply: reply},
        state
      )
      when channel_type in ["openclaw", nil] and is_binary(reply) and reply != "" do
    new_state = attempt_delivery(conversation_id, reply, state)
    {:noreply, new_state}
  end

  # Also handle agent_response when channel_type is set from EventIngester metadata
  def handle_info(
        %{event: :agent_response, conversation_id: conversation_id, reply: reply} = msg,
        state
      )
      when is_binary(reply) and reply != "" do
    channel_type = Map.get(msg, :channel_type)
    # Only intercept if this came from an OpenClaw-originated conversation
    session_key = resolve_session_key(conversation_id)

    if session_key && openclaw_session?(session_key) do
      new_state = deliver_to_session(session_key, reply, state)
      {:noreply, new_state}
    else
      Logger.debug("[ChannelDelivery] Skipping delivery for channel_type=#{channel_type}, no OpenClaw session")
      {:noreply, state}
    end
  end

  # Ignore all other PubSub messages
  def handle_info(_msg, state), do: {:noreply, state}

  # -- Internal --

  defp attempt_delivery(conversation_id, reply, state) do
    case resolve_session_key(conversation_id) do
      nil ->
        Logger.debug("[ChannelDelivery] No OpenClaw session key for conversation #{conversation_id}")
        state

      session_key ->
        deliver_to_session(session_key, reply, state)
    end
  end

  defp deliver_to_session(session_key, reply, state) do
    Logger.info("[ChannelDelivery] Injecting reply into session #{session_key} (#{String.length(reply)} chars)")

    case GatewayRPC.call("chat.inject", %{sessionKey: session_key, message: reply}) do
      {:ok, %{"ok" => true}} ->
        Logger.info("[ChannelDelivery] Delivered reply to #{session_key}")
        %{state | delivered_count: state.delivered_count + 1, last_delivery: DateTime.utc_now()}

      {:ok, other} ->
        Logger.warning("[ChannelDelivery] Unexpected inject response for #{session_key}: #{inspect(other)}")
        %{state | delivered_count: state.delivered_count + 1, last_delivery: DateTime.utc_now()}

      {:error, reason} ->
        Logger.error("[ChannelDelivery] Failed to deliver to #{session_key}: #{inspect(reason)}")
        %{state | failed_count: state.failed_count + 1}
    end
  end

  defp resolve_session_key(conversation_id) do
    # SessionStore maps oc_session_id → %{conversation_id: ..., ...}
    # We scan the reverse index to find which OC session matches this conversation.
    try do
      SessionStore.list_openclaw_sessions()
      |> Enum.find_value(fn entry ->
        if entry.conversation_id == conversation_id, do: entry.oc_session_id, else: nil
      end)
    rescue
      _ -> nil
    end
  end

  defp openclaw_session?(session_key) when is_binary(session_key) do
    String.starts_with?(session_key, "agent:")
  end

  defp openclaw_session?(_), do: false
end
