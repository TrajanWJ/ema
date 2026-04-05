defmodule Ema.Agents.ChannelHealth do
  @moduledoc """
  Monitors channel connections with periodic health checks.

  Tracks connection status (connected, degraded, disconnected) per channel,
  attempts auto-reconnect for disconnected channels, and broadcasts health
  changes on PubSub.
  """

  use GenServer

  require Logger

  alias Ema.Agents

  @pubsub Ema.PubSub
  @health_topic "channels:health"
  @check_interval_ms 30_000

  @type health_entry :: %{
          status: :connected | :degraded | :disconnected,
          last_check: DateTime.t(),
          error: String.t() | nil,
          uptime_start: DateTime.t() | nil
        }

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Returns health status map for all channels."
  @spec get_health() :: %{String.t() => health_entry()}
  def get_health do
    GenServer.call(__MODULE__, :get_health)
  end

  @doc "Returns health for a specific channel."
  @spec get_channel_health(String.t()) :: health_entry() | nil
  def get_channel_health(channel_id) do
    GenServer.call(__MODULE__, {:get_channel_health, channel_id})
  end

  # --- Server Callbacks ---

  @impl true
  def init(_opts) do
    schedule_check()

    health = build_initial_health()

    {:ok, %{health: health}}
  end

  @impl true
  def handle_call(:get_health, _from, state) do
    {:reply, state.health, state}
  end

  @impl true
  def handle_call({:get_channel_health, channel_id}, _from, state) do
    {:reply, Map.get(state.health, channel_id), state}
  end

  @impl true
  def handle_info(:check_health, state) do
    new_health = run_health_checks(state.health)

    broadcast_changes(state.health, new_health)

    schedule_check()

    {:noreply, %{state | health: new_health}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Private ---

  defp schedule_check do
    Process.send_after(self(), :check_health, @check_interval_ms)
  end

  defp build_initial_health do
    Agents.list_active_agents()
    |> Enum.flat_map(&Agents.list_channels_by_agent(&1.id))
    |> Enum.filter(& &1.active)
    |> Map.new(fn channel ->
      status = parse_connection_status(channel.status)
      now = DateTime.utc_now()

      entry = %{
        status: status,
        last_check: now,
        error: channel.error_message,
        uptime_start: if(status == :connected, do: now)
      }

      {channel.id, entry}
    end)
  end

  defp run_health_checks(current_health) do
    channels =
      Agents.list_active_agents()
      |> Enum.flat_map(&Agents.list_channels_by_agent(&1.id))
      |> Enum.filter(& &1.active)

    Map.new(channels, fn channel ->
      previous = Map.get(current_health, channel.id)
      entry = check_single_channel(channel, previous)
      {channel.id, entry}
    end)
  end

  defp check_single_channel(channel, previous) do
    now = DateTime.utc_now()
    status = parse_connection_status(channel.status)

    entry = %{
      status: status,
      last_check: now,
      error: channel.error_message,
      uptime_start: resolve_uptime_start(status, previous, now)
    }

    if status == :disconnected do
      attempt_reconnect(channel)
    end

    entry
  end

  defp resolve_uptime_start(:connected, nil, now), do: now
  defp resolve_uptime_start(:connected, %{status: :connected, uptime_start: start}, _now), do: start
  defp resolve_uptime_start(:connected, _previous, now), do: now
  defp resolve_uptime_start(_status, _previous, _now), do: nil

  defp attempt_reconnect(channel) do
    Logger.info("Attempting reconnect for channel #{channel.id} (#{channel.channel_type})")

    # Look up the channel's agent worker and request reconnection via Registry.
    case Registry.lookup(Ema.Agents.Registry, {:channel, channel.id}) do
      [{pid, _}] ->
        send(pid, {:reconnect, channel.id})

      [] ->
        Logger.warning("No registered process for channel #{channel.id}, skipping reconnect")
    end
  rescue
    error ->
      Logger.error("Reconnect failed for channel #{channel.id}: #{inspect(error)}")
  end

  defp parse_connection_status("connected"), do: :connected
  defp parse_connection_status("degraded"), do: :degraded
  defp parse_connection_status(_), do: :disconnected

  defp broadcast_changes(old_health, new_health) do
    Enum.each(new_health, fn {channel_id, new_entry} ->
      old_entry = Map.get(old_health, channel_id)

      if is_nil(old_entry) or old_entry.status != new_entry.status do
        Phoenix.PubSub.broadcast(
          @pubsub,
          @health_topic,
          {:health_changed, channel_id, new_entry}
        )
      end
    end)
  end
end
