defmodule Ema.Temporal.Engine do
  @moduledoc """
  GenServer that learns circadian rhythms from user activity signals.
  Subscribes to PubSub events and updates rhythm model.
  """

  use GenServer

  alias Ema.Temporal

  @learn_interval :timer.minutes(15)

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  def current_context, do: GenServer.call(__MODULE__, :current_context)
  def best_time_for(task_type), do: GenServer.call(__MODULE__, {:best_time_for, task_type})

  def record_signal(energy, focus, activity_type) do
    GenServer.cast(__MODULE__, {:signal, energy, focus, activity_type})
  end

  # --- Callbacks ---

  @impl true
  def init(_state) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "habits:events")
    Phoenix.PubSub.subscribe(Ema.PubSub, "journal:events")
    Phoenix.PubSub.subscribe(Ema.PubSub, "tasks:events")
    Phoenix.PubSub.subscribe(Ema.PubSub, "focus:events")
    Phoenix.PubSub.subscribe(Ema.PubSub, "temporal:signals")

    schedule_learn()

    {:ok, %{last_activity: nil}}
  end

  @impl true
  def handle_call(:current_context, _from, state) do
    {:reply, Temporal.current_context(), state}
  end

  def handle_call({:best_time_for, task_type}, _from, state) do
    {:reply, Temporal.best_time_for(task_type), state}
  end

  @impl true
  def handle_cast({:signal, energy, focus, activity_type}, state) do
    now = DateTime.utc_now()
    day = Date.day_of_week(now) - 1
    hour = now.hour

    Temporal.update_rhythm_from_signal(day, hour, energy, focus, activity_type)

    Temporal.log_energy(%{
      energy_level: energy,
      focus_quality: focus,
      activity_type: activity_type,
      source: "manual",
      logged_at: now
    })

    broadcast_update()
    {:noreply, %{state | last_activity: now}}
  end

  @impl true
  def handle_info({:habits, :toggled, _payload}, state) do
    record_activity(6.0, 5.0, "admin")
    {:noreply, %{state | last_activity: DateTime.utc_now()}}
  end

  def handle_info({:journal, :saved, %{mood: mood}}, state) when is_number(mood) do
    energy = mood * 2.0
    record_activity(min(energy, 10.0), 5.0, "creative")
    {:noreply, %{state | last_activity: DateTime.utc_now()}}
  end

  def handle_info({:tasks, :completed, _payload}, state) do
    record_activity(7.0, 7.0, "deep_work")
    {:noreply, %{state | last_activity: DateTime.utc_now()}}
  end

  def handle_info({:focus, :session_completed, %{duration_minutes: mins}}, state)
      when is_number(mins) do
    energy = if mins > 45, do: 8.0, else: 6.0
    focus = min(mins / 5.0, 10.0)
    record_activity(energy, focus, "deep_work")
    {:noreply, %{state | last_activity: DateTime.utc_now()}}
  end

  def handle_info(:learn_tick, state) do
    schedule_learn()
    {:noreply, state}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  # --- Internal ---

  defp record_activity(energy, focus, activity_type) do
    now = DateTime.utc_now()
    day = Date.day_of_week(now) - 1
    hour = now.hour

    Temporal.update_rhythm_from_signal(day, hour, energy, focus, activity_type)

    Temporal.log_energy(%{
      energy_level: energy,
      focus_quality: focus,
      activity_type: activity_type,
      source: "system_inferred",
      logged_at: now
    })

    broadcast_update()
  end

  defp broadcast_update do
    Phoenix.PubSub.broadcast(Ema.PubSub, "temporal:updates", {:temporal, :context_updated, Temporal.current_context()})
  end

  defp schedule_learn do
    Process.send_after(self(), :learn_tick, @learn_interval)
  end
end
