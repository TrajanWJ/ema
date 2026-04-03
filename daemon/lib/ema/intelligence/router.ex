defmodule Ema.Intelligence.Router do
  @moduledoc """
  Intelligence Layer: Event Router.

  Classifies incoming events by type and routes them to the appropriate
  agent target (hub orchestrator vs domain agents). Enriches each event
  with live context via ContextInjector before returning the routing decision.

  Returns:
    {:hub, :proposal_orchestrator, enriched_event}   — for proposal/multi-domain flows
    {:domain, agent_type, enriched_event}             — for single-domain flows

  Broadcasts all routing decisions to "intelligence:route" for observability.
  """

  require Logger

  alias Ema.Claude.ContextInjector
  alias Ema.Intelligence.RouteTrace

  # ── Public API ──────────────────────────────────────────────────────────────

  @doc """
  Route an event to the appropriate agent target with enriched context.

  Returns:
    {:hub, :proposal_orchestrator, enriched_event}
    {:domain, agent_type, enriched_event}
    {:error, reason}
  """
  def route(event) do
    Logger.debug("[Router] Classifying event: #{inspect(event.type)}")

    case classify_and_enrich(event) do
      {:ok, decision} ->
        RouteTrace.log(event, decision)
        broadcast_decision(event, decision)
        decision

      {:error, reason} ->
        Logger.error("[Router] Routing failed for event #{inspect(event.type)}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Classify an event type without fetching context. Returns the routing target.
  Useful for dry-run routing checks.
  """
  def classify(event) do
    case event.type do
      :proposal_requested -> {:hub, :proposal_orchestrator}
      :journal_entry_saved -> {:domain, :journal_agent}
      :habit_streak_broken -> {:domain, :habits_agent}
      :task_completed -> {:domain, task_completed_target(event)}
      _ -> {:domain, :general_agent}
    end
  end

  # ── Private: Classify + Enrich ───────────────────────────────────────────────

  defp classify_and_enrich(%{type: :proposal_requested} = event) do
    context_keys = [:project, :goals, :vault, :tasks, :proposals]

    with {:ok, context} <- ContextInjector.build_context(event, context_keys) do
      enriched = Map.put(event, :context, context)
      {:ok, {:hub, :proposal_orchestrator, enriched}}
    end
  end

  defp classify_and_enrich(%{type: :journal_entry_saved} = event) do
    context_keys = [:energy, :vault]

    with {:ok, context} <- ContextInjector.build_context(event, context_keys) do
      enriched = Map.put(event, :context, context)
      {:ok, {:domain, :journal_agent, enriched}}
    end
  end

  defp classify_and_enrich(%{type: :habit_streak_broken} = event) do
    context_keys = [:energy, :goals]

    with {:ok, context} <- ContextInjector.build_context(event, context_keys) do
      enriched = Map.put(event, :context, context)
      {:ok, {:domain, :habits_agent, enriched}}
    end
  end

  defp classify_and_enrich(%{type: :task_completed} = event) do
    context_keys = if event_has_project?(event), do: [:project, :goals, :tasks], else: [:tasks, :goals]
    agent_type = task_completed_target(event)

    with {:ok, context} <- ContextInjector.build_context(event, context_keys) do
      enriched = Map.put(event, :context, context)
      {:ok, {:domain, agent_type, enriched}}
    end
  end

  defp classify_and_enrich(event) do
    Logger.debug("[Router] Unknown event type #{inspect(event.type)}, routing to general_agent")

    with {:ok, context} <- ContextInjector.build_context(event, []) do
      enriched = Map.put(event, :context, context)
      {:ok, {:domain, :general_agent, enriched}}
    end
  end

  # ── Private: Helpers ────────────────────────────────────────────────────────

  defp task_completed_target(event) do
    if event_has_project?(event), do: :goal_agent, else: :task_agent
  end

  defp event_has_project?(event) do
    project_id = get_in(event, [:data, :project_id]) || Map.get(event, :project_id)
    not is_nil(project_id) and project_id != ""
  end

  defp broadcast_decision(event, decision) do
    payload = %{
      event_type: event.type,
      decision: format_decision(decision),
      timestamp: DateTime.utc_now()
    }

    Phoenix.PubSub.broadcast(Ema.PubSub, "intelligence:route", {:route_decision, payload})
  rescue
    _ -> :ok
  end

  defp format_decision({:hub, target, _event}), do: %{channel: :hub, target: target}
  defp format_decision({:domain, agent, _event}), do: %{channel: :domain, target: agent}
  defp format_decision(other), do: inspect(other)
end
