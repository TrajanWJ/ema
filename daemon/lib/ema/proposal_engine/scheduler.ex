defmodule Ema.ProposalEngine.Scheduler do
  @moduledoc """
  Manages seed schedules. Periodically checks active seeds and dispatches
  them to the Generator when their schedule fires.
  """

  use GenServer

  require Logger

  @tick_interval :timer.minutes(1)

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def pause do
    GenServer.call(__MODULE__, :pause)
  end

  def resume do
    GenServer.call(__MODULE__, :resume)
  end

  def status do
    GenServer.call(__MODULE__, :status)
  end

  def run_seed(seed_id) do
    GenServer.cast(__MODULE__, {:run_seed, seed_id})
  end

  # --- Server ---

  @impl true
  def init(opts) do
    paused = Keyword.get(opts, :paused, false)

    unless paused do
      schedule_tick()
    end

    {:ok,
     %{
       paused: paused,
       last_tick_at: nil,
       seeds_dispatched: 0
     }}
  end

  @impl true
  def handle_call(:pause, _from, state) do
    Logger.info("ProposalEngine.Scheduler: paused")
    {:reply, :ok, %{state | paused: true}}
  end

  @impl true
  def handle_call(:resume, _from, state) do
    unless state.paused == false do
      schedule_tick()
    end

    Logger.info("ProposalEngine.Scheduler: resumed")
    {:reply, :ok, %{state | paused: false}}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply,
     %{
       paused: state.paused,
       last_tick_at: state.last_tick_at,
       seeds_dispatched: state.seeds_dispatched
     }, state}
  end

  @impl true
  def handle_cast({:run_seed, seed_id}, state) do
    case Ema.Proposals.get_seed(seed_id) do
      nil ->
        Logger.warning("ProposalEngine.Scheduler: seed #{seed_id} not found")
        {:noreply, state}

      seed ->
        dispatch_seed(seed)
        {:noreply, %{state | seeds_dispatched: state.seeds_dispatched + 1}}
    end
  end

  @impl true
  def handle_info(:tick, %{paused: true} = state) do
    schedule_tick()
    {:noreply, state}
  end

  @impl true
  def handle_info(:tick, state) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    seeds = Ema.Proposals.list_seeds(active: true)

    dispatched =
      seeds
      |> Enum.filter(&should_run?(&1, now))
      |> Enum.count(fn seed ->
        dispatch_seed(seed)
        true
      end)

    if dispatched > 0 do
      Logger.info("ProposalEngine.Scheduler: dispatched #{dispatched} seed(s) at #{now}")
    end

    Ema.ProposalEngine.Diagnostics.record_scheduler_tick(%{
      last_scheduler_tick_at: DateTime.to_iso8601(now)
    })

    schedule_tick()

    {:noreply,
     %{
       state
       | last_tick_at: now,
         seeds_dispatched: state.seeds_dispatched + dispatched
     }}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Private ---

  defp schedule_tick do
    Process.send_after(self(), :tick, @tick_interval)
  end

  defp should_run?(%{schedule: nil}, _now), do: false

  defp should_run?(%{last_run_at: nil}, _now), do: true

  defp should_run?(%{schedule: schedule, last_run_at: last_run}, now) do
    interval_seconds = parse_schedule(schedule)
    diff = DateTime.diff(now, last_run, :second)
    diff >= interval_seconds
  end

  defp parse_schedule("every_" <> rest) do
    case Integer.parse(rest) do
      {n, "h"} -> n * 3600
      {n, "m"} -> n * 60
      {n, "s"} -> n
      _ -> 3600
    end
  end

  defp parse_schedule(_), do: 3600

  defp dispatch_seed(seed) do
    Logger.info("ProposalEngine.Scheduler: dispatching seed #{seed.id} (#{seed.name})")
    Ema.ProposalEngine.Diagnostics.record_dispatch(seed)
    Ema.ProposalEngine.Generator.generate(seed)
    Ema.Proposals.increment_seed_run_count(seed)
  end
end
