defmodule EmaWeb.OrchestrationController do
  @moduledoc """
  API controller for agent orchestration: fitness scores, routing, stats.
  """

  use EmaWeb, :controller
  action_fallback EmaWeb.FallbackController

  alias Ema.Orchestration.{AgentFitnessStore, RoutingEngine}

  @doc "GET /api/orchestration/stats"
  def stats(conn, _params) do
    routing_stats = RoutingEngine.get_routing_stats()
    fitness_scores = AgentFitnessStore.all_fitness_scores()

    json(conn, %{
      routing: routing_stats,
      fitness_count: length(fitness_scores),
      top_agents: Enum.take(fitness_scores, 10)
    })
  end

  @doc "GET /api/orchestration/fitness"
  def fitness(conn, _params) do
    scores = AgentFitnessStore.all_fitness_scores()
    json(conn, %{fitness: scores})
  end

  @doc "POST /api/orchestration/route"
  def route(conn, params) do
    strategy =
      case params["strategy"] do
        "best_fit" -> :best_fit
        "round_robin" -> :round_robin
        "least_loaded" -> :least_loaded
        "specialized" -> :specialized
        _ -> :best_fit
      end

    task = params["task"] || %{}

    case RoutingEngine.route(task, strategy) do
      {:ok, decision} ->
        json(conn, %{decision: decision})

      {:error, :no_available_agents} ->
        conn |> put_status(422) |> json(%{error: "No available agents"})
    end
  end
end
