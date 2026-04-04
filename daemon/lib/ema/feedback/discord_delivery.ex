defmodule Ema.Feedback.DiscordDelivery do
  @moduledoc """
  Supervisor + per-channel workers that consume discord:outbound:<id> PubSub topics
  and deliver messages to Discord REST API + mirror to ema:feedback.

  Each channel gets its own lightweight worker process that:
    1. Subscribes to "discord:outbound:<channel_id>"
    2. Receives {:post, msg} or {:send_message, msg}
    3. POSTs to Discord API
    4. Broadcasts to "ema:feedback" PubSub for EMA internal consumers

  New channels can be registered at runtime via register_channel/1.
  """

  use DynamicSupervisor
  require Logger

  alias Ema.Feedback.DiscordDelivery.Worker

  @registry Ema.Feedback.DiscordDelivery.Registry

  # Static channel seed — all known stream channels
  @static_channels [
    # 🧵 STREAM OF CONSCIOUSNESS
    {"1489786483970936933", "babysitter-live"},
    {"1489820670333423827", "system-heartbeat"},
    {"1489820673760301156", "intent-stream"},
    {"1489820676859756606", "pipeline-flow"},
    {"1489820679472677044", "agent-thoughts"},
    {"1489820682198974525", "intelligence-layer"},
    {"1489820685101699193", "memory-writes"},
    {"1489820687563493408", "execution-log"},
    {"1489820691074387979", "evolution-signals"},
    {"1489820693758607370", "speculative-feed"},
    # 🔨 ACTIVE SPRINT
    {"1489751362211282954", "critical-blockers-track"},
    {"1489751362215608441", "core-loop-implementation"},
    {"1489751362613805317", "intelligence-integrations"},
    {"1485847116227280966", "deliberation"},
    {"1485847117078724629", "prompt-lab"},
    # 📡 FEEDS
    {"1482258431997116531", "research-feed"},
    {"1484014829156175893", "code-output"},
    {"1484031239680823316", "alerts"},
    {"1482256984811114688", "ops-log"},
  ]

  def start_link(opts \\ []) do
    DynamicSupervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    # Start workers for all static channels after supervisor is up
    send(self(), :start_static)
    DynamicSupervisor.init(strategy: :one_for_one)
  end

  def handle_info(:start_static, state) do
    Enum.each(@static_channels, fn {channel_id, name} ->
      start_worker(channel_id, name)
    end)
    {:noreply, state}
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
