defmodule Ema.Loops.Escalator do
  @moduledoc """
  Hourly tick that recomputes escalation levels for all open loops.
  Broadcasts `{:loop_escalated, loop}` on `loops:lobby` for each level bump.
  """

  use GenServer
  require Logger

  @default_interval :timer.hours(1)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Force a tick now (for tests / manual escalation)."
  def tick_now, do: GenServer.cast(__MODULE__, :tick)

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval, @default_interval)
    # Wait a bit so the rest of the app is up before the first tick.
    Process.send_after(self(), :tick, :timer.seconds(45))
    {:ok, %{interval: interval}}
  end

  @impl true
  def handle_info(:tick, state) do
    do_tick()
    Process.send_after(self(), :tick, state.interval)
    {:noreply, state}
  end

  @impl true
  def handle_cast(:tick, state) do
    do_tick()
    {:noreply, state}
  end

  defp do_tick do
    {updated, by_level} = Ema.Loops.escalate_all()

    if updated > 0 do
      Logger.info(
        "[Loops.Escalator] Escalated #{updated} loops " <>
          "(L0:#{by_level[0]} L1:#{by_level[1]} L2:#{by_level[2]} L3:#{by_level[3]})"
      )
    end
  rescue
    e ->
      Logger.error("[Loops.Escalator] tick failed: #{inspect(e)}")
  end
end
