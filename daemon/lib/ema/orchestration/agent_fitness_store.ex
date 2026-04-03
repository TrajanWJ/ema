defmodule Ema.Orchestration.AgentFitnessStore do
  @moduledoc """
  ETS-backed fitness tracking for agents. Records outcomes and computes
  composite scores from success rate, latency, and task affinity.
  """

  use GenServer
  require Logger

  @table :agent_fitness
  @default_fitness 0.5

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Record an outcome for an agent. outcome is :success or :failure."
  def record_outcome(agent_id, task_type, outcome, duration_ms) do
    GenServer.cast(__MODULE__, {:record, agent_id, task_type, outcome, duration_ms})
  end

  def get_fitness(agent_id) do
    case :ets.lookup(@table, agent_id) do
      [{^agent_id, fitness}] -> {:ok, fitness}
      [] -> {:ok, default_entry(agent_id)}
    end
  end

  def all_fitness_scores do
    :ets.tab2list(@table)
    |> Enum.map(fn {_id, fitness} -> fitness end)
    |> Enum.sort_by(& &1.composite_score, :desc)
  end

  @doc "Top agents for a given task type, limited."
  def top_agents(task_type, limit \\ 5) do
    all_fitness_scores()
    |> Enum.sort_by(fn f ->
      Map.get(f.task_affinity, task_type, 0.0)
    end, :desc)
    |> Enum.take(limit)
  end

  @impl true
  def init(_opts) do
    :ets.new(@table, [:named_table, :set, :public, read_concurrency: true])
    {:ok, %{}}
  end

  @impl true
  def handle_cast({:record, agent_id, task_type, outcome, duration_ms}, state) do
    entry =
      case :ets.lookup(@table, agent_id) do
        [{^agent_id, existing}] -> existing
        [] -> default_entry(agent_id)
      end

    success = if outcome == :success, do: 1, else: 0

    new_total = entry.total_runs + 1
    new_successes = entry.successes + success
    new_success_rate = new_successes / new_total

    # EMA 0.9/0.1 weighting for latency
    new_avg_latency =
      if entry.avg_latency_ms == 0.0 do
        duration_ms * 1.0
      else
        entry.avg_latency_ms * 0.9 + duration_ms * 0.1
      end

    # Update task affinity — move toward 1.0 on success, toward 0.0 on failure
    current_affinity = Map.get(entry.task_affinity, task_type, @default_fitness)
    affinity_delta = if outcome == :success, do: 0.05, else: -0.05
    new_affinity = max(0.0, min(1.0, current_affinity + affinity_delta))
    new_task_affinity = Map.put(entry.task_affinity, task_type, Float.round(new_affinity, 3))

    # Composite: 60% success + 20% latency_factor + 20% base
    latency_factor = max(0.0, 1.0 - new_avg_latency / 60_000.0)
    composite = Float.round(new_success_rate * 0.6 + latency_factor * 0.2 + @default_fitness * 0.2, 3)

    updated = %{
      entry
      | total_runs: new_total,
        successes: new_successes,
        success_rate: Float.round(new_success_rate, 3),
        avg_latency_ms: Float.round(new_avg_latency, 1),
        task_affinity: new_task_affinity,
        composite_score: composite,
        last_run: DateTime.utc_now()
    }

    :ets.insert(@table, {agent_id, updated})
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp default_entry(agent_id) do
    %{
      agent_id: agent_id,
      total_runs: 0,
      successes: 0,
      success_rate: 0.0,
      avg_latency_ms: 0.0,
      task_affinity: %{},
      composite_score: @default_fitness,
      last_run: nil
    }
  end
end
