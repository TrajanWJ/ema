defmodule Ema.Orchestration.RoutingEngine do
  @moduledoc """
  Routes tasks to agents using configurable strategies:
  best_fit, round_robin, least_loaded, or specialized.
  """

  use GenServer
  require Logger
  import Ecto.Query

  alias Ema.Repo
  alias Ema.Orchestration.AgentFitnessStore

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Route a task to the best agent using the given strategy."
  def route(task, strategy \\ :best_fit) do
    GenServer.call(__MODULE__, {:route, task, strategy})
  end

  def get_routing_stats do
    GenServer.call(__MODULE__, :get_stats)
  end

  @impl true
  def init(_opts) do
    {:ok,
     %{
       total_routed: 0,
       strategy_counts: %{},
       recent_decisions: []
     }}
  end

  @impl true
  def handle_call({:route, task, strategy}, _from, state) do
    agents = get_available_agents()
    task_type = Map.get(task, :type, Map.get(task, "type", "general"))

    result =
      case select_agent(agents, task_type, strategy) do
        nil ->
          {:error, :no_available_agents}

        agent ->
          decision = %{
            agent_id: agent.id,
            agent_slug: agent.slug,
            task_type: task_type,
            strategy: strategy,
            decided_at: DateTime.utc_now()
          }

          Phoenix.PubSub.broadcast(
            Ema.PubSub,
            "orchestration:routing",
            {:routing_decision, decision}
          )

          {:ok, decision}
      end

    new_state = %{
      state
      | total_routed: state.total_routed + 1,
        strategy_counts:
          Map.update(state.strategy_counts, strategy, 1, &(&1 + 1)),
        recent_decisions:
          Enum.take(
            [%{task_type: task_type, strategy: strategy, at: DateTime.utc_now()} | state.recent_decisions],
            50
          )
    }

    {:reply, result, new_state}
  end

  @impl true
  def handle_call(:get_stats, _from, state) do
    {:reply, state, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp get_available_agents do
    try do
      from(a in "agents", where: a.status == "active", select: %{id: a.id, slug: a.slug})
      |> Repo.all()
    rescue
      _ -> []
    end
  end

  defp select_agent([], _task_type, _strategy), do: nil

  defp select_agent(agents, task_type, :best_fit) do
    agents
    |> Enum.max_by(fn agent ->
      case AgentFitnessStore.get_fitness(agent.id) do
        {:ok, fitness} ->
          affinity = Map.get(fitness.task_affinity, task_type, 0.5)
          fitness.composite_score * 0.5 + affinity * 0.5

        _ ->
          0.5
      end
    end, fn -> nil end)
  end

  defp select_agent(agents, _task_type, :round_robin) do
    Enum.random(agents)
  end

  defp select_agent(agents, _task_type, :least_loaded) do
    agents
    |> Enum.min_by(fn agent ->
      case AgentFitnessStore.get_fitness(agent.id) do
        {:ok, fitness} -> fitness.total_runs
        _ -> 0
      end
    end, fn -> nil end)
  end

  defp select_agent(agents, task_type, :specialized) do
    scored =
      agents
      |> Enum.map(fn agent ->
        case AgentFitnessStore.get_fitness(agent.id) do
          {:ok, fitness} ->
            {agent, Map.get(fitness.task_affinity, task_type, 0.0)}

          _ ->
            {agent, 0.0}
        end
      end)
      |> Enum.filter(fn {_agent, score} -> score > 0.0 end)
      |> Enum.sort_by(fn {_agent, score} -> score end, :desc)

    case scored do
      [{agent, _} | _] -> agent
      [] -> Enum.random(agents)
    end
  end

  defp select_agent(agents, task_type, _unknown) do
    select_agent(agents, task_type, :best_fit)
  end
end
