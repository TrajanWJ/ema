defmodule Ema.Orchestration.SpecializationAutotune do
  @moduledoc """
  Periodic analysis of agent fitness scores to identify task specializations.
  Runs every 2 hours, broadcasting specialization insights.
  """

  use GenServer
  require Logger

  alias Ema.Orchestration.AgentFitnessStore

  @autotune_interval :timer.hours(2)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def run_autotune do
    GenServer.call(__MODULE__, :run_autotune, 30_000)
  end

  @impl true
  def init(_opts) do
    schedule_autotune()
    {:ok, %{last_run: nil, specializations: []}}
  end

  @impl true
  def handle_call(:run_autotune, _from, state) do
    specializations = do_autotune()
    new_state = %{state | last_run: DateTime.utc_now(), specializations: specializations}
    {:reply, {:ok, specializations}, new_state}
  end

  @impl true
  def handle_info(:autotune, state) do
    specializations = do_autotune()
    schedule_autotune()
    {:noreply, %{state | last_run: DateTime.utc_now(), specializations: specializations}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp schedule_autotune do
    Process.send_after(self(), :autotune, @autotune_interval)
  end

  defp do_autotune do
    scores = AgentFitnessStore.all_fitness_scores()

    specializations =
      scores
      |> Enum.flat_map(fn fitness ->
        fitness.task_affinity
        |> Enum.filter(fn {_type, score} -> score > 0.7 end)
        |> Enum.map(fn {task_type, score} ->
          %{
            agent_id: fitness.agent_id,
            task_type: task_type,
            affinity: score,
            total_runs: fitness.total_runs,
            success_rate: fitness.success_rate
          }
        end)
      end)

    if specializations != [] do
      Phoenix.PubSub.broadcast(
        Ema.PubSub,
        "orchestration:autotune",
        {:specializations_detected, specializations}
      )
    end

    specializations
  end
end
