defmodule Ema.Feedback.DiscordDelivery do
  @moduledoc """
  Supervisor + per-channel workers that consume discord:outbound:<id> PubSub topics
  and deliver messages to Discord REST API + mirror to ema:feedback.

  The registered channel list comes from `Ema.Babysitter.ChannelTopology`, which
  includes active babysitter streams, dormant-but-kept stream channels, and
  delivery-only Discord channels used by other EMA publishers.

  Each channel gets its own lightweight worker process that:
    1. Subscribes to "discord:outbound:<channel_id>"
    2. Receives {:post, msg} or {:send_message, msg}
    3. POSTs to Discord API
    4. Broadcasts to "ema:feedback" PubSub for EMA internal consumers

  New channels can be registered at runtime via register_channel/1.
  """

  use DynamicSupervisor
  require Logger

  alias Ema.Babysitter.ChannelTopology
  alias Ema.Feedback.DiscordDelivery.Worker

  @registry Ema.Feedback.DiscordDelivery.Registry

  def start_link(opts \\ []) do
    DynamicSupervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    # DynamicSupervisor is not a general-purpose GenServer for custom mailbox bootstraps.
    # Seed static workers from a detached task after the supervisor is registered.
    Task.start(fn ->
      Process.sleep(50)

      Enum.each(ChannelTopology.all_delivery_channels(), fn {channel_id, name} ->
        start_worker(channel_id, name)
      end)
    end)

    DynamicSupervisor.init(strategy: :one_for_one)
  end

  @doc "Register a new channel for delivery at runtime"
  def register_channel(channel_id, name \\ nil) when is_binary(channel_id) do
    start_worker(channel_id, name || channel_id)
  end

  @doc "List all active channel workers"
  def channels do
    Registry.select(@registry, [{{:"$1", :_, :_}, [], [:"$1"]}])
  end

  @doc "Status overview"
  def status do
    workers = channels()
    %{worker_count: length(workers), channels: workers}
  end

  defp start_worker(channel_id, name) do
    case Registry.lookup(@registry, channel_id) do
      [{_pid, _}] ->
        Logger.debug("[DiscordDelivery] Channel #{name} already registered")
        :ok

      [] ->
        case DynamicSupervisor.start_child(__MODULE__, {Worker, channel_id: channel_id, name: name}) do
          {:ok, _pid} ->
            Logger.info("[DiscordDelivery] Worker started for ##{name} (#{channel_id})")
            :ok
          {:error, reason} ->
            Logger.warning("[DiscordDelivery] Failed to start worker for #{channel_id}: #{inspect(reason)}")
            {:error, reason}
        end
    end
  end
end


defmodule Ema.Feedback.DiscordDelivery.Worker do
  @moduledoc """
  Per-channel worker: subscribes to discord:outbound:<channel_id>,
  delivers to Discord REST, mirrors to ema:feedback.
  """

  use GenServer
  require Logger

  alias Ema.Feedback.Broadcast

  @pubsub Ema.PubSub
  @registry Ema.Feedback.DiscordDelivery.Registry

  def start_link(opts) do
    channel_id = Keyword.fetch!(opts, :channel_id)
    GenServer.start_link(__MODULE__, opts, name: via(channel_id))
  end

  @impl true
  def init(opts) do
    channel_id = Keyword.fetch!(opts, :channel_id)
    name = Keyword.get(opts, :name, channel_id)

    Registry.register(@registry, channel_id, name)
    Phoenix.PubSub.subscribe(@pubsub, "discord:outbound:#{channel_id}")

    {:ok, %{channel_id: channel_id, name: name, delivered: 0, failed: 0}}
  end

  # {:post, message} — from StreamTicker / StreamChannels
  @impl true
  def handle_info({:post, message}, state) when is_binary(message) do
    new_state = do_deliver(state, message)
    {:noreply, new_state}
  end

  # {:send_message, message} — from NotifyAction / OrgController
  def handle_info({:send_message, message}, state) when is_binary(message) do
    new_state = do_deliver(state, message)
    {:noreply, new_state}
  end

  # {:discord_post, channel_id, message} — explicit form
  def handle_info({:discord_post, _ch, message}, state) when is_binary(message) do
    new_state = do_deliver(state, message)
    {:noreply, new_state}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  defp do_deliver(state, message) do
    case Broadcast.emit(:stream, state.channel_id, message, %{channel_name: state.name}) do
      :ok ->
        %{state | delivered: state.delivered + 1}
      {:error, reason} ->
        Logger.warning("[DiscordDelivery.Worker] #{state.name} delivery failed: #{inspect(reason)}")
        %{state | failed: state.failed + 1}
    end
  end

  defp via(channel_id) do
    {:via, Registry, {@registry, channel_id}}
  end
end
