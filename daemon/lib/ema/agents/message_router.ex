defmodule Ema.Agents.MessageRouter do
  @moduledoc """
  Routes outbound messages to the correct channel(s).

  Supports cross-posting to multiple channels simultaneously and tracks
  delivery status per channel. Broadcasts routed messages on PubSub.
  """

  use GenServer

  require Logger

  alias Ema.Agents

  @pubsub Ema.PubSub
  @messages_topic "channels:messages"

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Routes a message from an agent to one or more channels.

  ## Options
    * `:channel_type` - target channel type (e.g. "discord", "slack")
    * `:channel_id` - specific channel ID to target
    * `:cross_post` - list of additional channel_types to send to
  """
  @spec route_message(String.t(), String.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def route_message(agent_id, content, opts \\ []) do
    GenServer.call(__MODULE__, {:route_message, agent_id, content, opts})
  end

  # --- Server Callbacks ---

  @impl true
  def init(_opts) do
    {:ok, %{deliveries: %{}}}
  end

  @impl true
  def handle_call({:route_message, agent_id, content, opts}, _from, state) do
    channel_type = Keyword.get(opts, :channel_type)
    channel_id = Keyword.get(opts, :channel_id)
    cross_post = Keyword.get(opts, :cross_post, [])

    with {:ok, agent} <- fetch_agent(agent_id),
         channels <- resolve_channels(agent, channel_type, channel_id, cross_post) do
      results = deliver_to_channels(agent, channels, content)
      state = track_deliveries(state, results)

      broadcast_results(results)

      {:reply, {:ok, %{deliveries: results}}, state}
    else
      {:error, reason} -> {:reply, {:error, reason}, state}
    end
  end

  # --- Private ---

  defp fetch_agent(agent_id) do
    case Agents.get_agent(agent_id) do
      nil -> {:error, :agent_not_found}
      agent -> {:ok, agent}
    end
  end

  defp resolve_channels(agent, channel_type, channel_id, cross_post) do
    all_channels = Agents.list_channels_by_agent(agent.id)
    active = Enum.filter(all_channels, & &1.active)

    primary =
      active
      |> maybe_filter_type(channel_type)
      |> maybe_filter_id(channel_id)

    cross_posted =
      if cross_post == [] do
        []
      else
        Enum.filter(active, &(&1.channel_type in cross_post))
      end

    Enum.uniq_by(primary ++ cross_posted, & &1.id)
  end

  defp maybe_filter_type(channels, nil), do: channels

  defp maybe_filter_type(channels, type) do
    Enum.filter(channels, &(&1.channel_type == type))
  end

  defp maybe_filter_id(channels, nil), do: channels

  defp maybe_filter_id(channels, id) do
    Enum.filter(channels, &(&1.id == id))
  end

  defp deliver_to_channels(agent, channels, content) do
    Enum.map(channels, fn channel ->
      result = deliver_single(agent, channel, content)
      {channel.id, result}
    end)
    |> Map.new()
  end

  defp deliver_single(agent, channel, content) do
    case Agents.get_or_create_conversation(
           agent.id,
           channel.channel_type,
           channel.id,
           "system"
         ) do
      {:ok, conversation} ->
        case Agents.add_message(%{
               conversation_id: conversation.id,
               role: "assistant",
               content: content
             }) do
          {:ok, message} ->
            %{status: :delivered, message_id: message.id, channel_type: channel.channel_type}

          {:error, reason} ->
            Logger.error("Failed to store message for channel #{channel.id}: #{inspect(reason)}")
            %{status: :failed, error: reason, channel_type: channel.channel_type}
        end

      {:error, reason} ->
        Logger.error("Failed to get conversation for channel #{channel.id}: #{inspect(reason)}")
        %{status: :failed, error: reason, channel_type: channel.channel_type}
    end
  end

  defp track_deliveries(state, results) do
    updated =
      Enum.reduce(results, state.deliveries, fn {channel_id, result}, acc ->
        entry = %{
          status: result.status,
          timestamp: DateTime.utc_now(),
          channel_type: result[:channel_type]
        }

        Map.update(acc, channel_id, [entry], fn existing ->
          Enum.take([entry | existing], 100)
        end)
      end)

    %{state | deliveries: updated}
  end

  defp broadcast_results(results) do
    Enum.each(results, fn {_channel_id, %{status: :delivered} = result} ->
      Phoenix.PubSub.broadcast(
        @pubsub,
        @messages_topic,
        {:new_message, %{message_id: result.message_id, channel_type: result.channel_type}}
      )
    end)
  rescue
    # Non-delivered results don't match the pattern; that's fine.
    _ -> :ok
  end
end
