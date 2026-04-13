defmodule Ema.ScopeAdvisor do
  @moduledoc """
  Checks agent fitness before task dispatch. Returns warnings when an agent
  shows elevated failure rates or low affinity for the requested task type.
  """

  alias Ema.Orchestration.AgentFitnessStore

  @min_runs_threshold 5
  @failure_rate_threshold 0.6
  @affinity_threshold 0.4

  @doc """
  Check whether `agent_id` is a good fit for `task_type`.

  Returns `{:ok, :proceed}` or `{:warning, message}`.
  """
  @spec check(String.t(), String.t()) :: {:ok, :proceed} | {:warning, String.t()}
  def check(agent_id, task_type) do
    {:ok, fitness} = AgentFitnessStore.get_fitness(agent_id)

    failure_rate = 1.0 - fitness.success_rate
    affinity = Map.get(fitness.task_affinity, task_type, 0.5)

    cond do
      fitness.total_runs >= @min_runs_threshold and failure_rate >= 1.0 - @failure_rate_threshold ->
        {:warning,
         "Agent #{agent_id} shows elevated failure rate for #{task_type} tasks " <>
           "(#{Float.round(failure_rate * 100, 1)}% failures). " <>
           "Consider scope reduction or agent switch."}

      affinity < @affinity_threshold ->
        {:warning,
         "Agent #{agent_id} has low affinity for #{task_type} tasks " <>
           "(#{Float.round(affinity, 3)}). Consider scope reduction or agent switch."}

      true ->
        {:ok, :proceed}
    end
  end

  @doc "API-compatible 3-arity variant; title is ignored."
  @spec check(String.t(), String.t(), any()) :: {:ok, :proceed} | {:warning, String.t()}
  def check(agent_id, task_type, _title), do: check(agent_id, task_type)

  @doc "Convert a check result to a metadata map."
  @spec to_metadata(:ok | {:ok, :proceed} | {:warning, String.t()}) :: map()
  def to_metadata(:ok), do: %{"warn" => false, "reason" => nil}
  def to_metadata({:ok, :proceed}), do: %{"warn" => false, "reason" => nil}
  def to_metadata({:warning, reason}), do: %{"warn" => true, "reason" => reason}
end
