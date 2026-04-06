defmodule Ema.Intelligence.SignalProcessor do
  @moduledoc """
  Aggregates implicit and explicit signals for the self-improvement loop.

  Subscribes to proposal, agent, quality, and routing events and feeds the
  AgentFitnessStore with normalized success and failure outcomes.
  """

  use GenServer
  require Logger

  alias Ema.Orchestration.AgentFitnessStore

  @pubsub_topics [
    "proposals:pipeline",
    "agent:runs",
    "quality:gate",
    "intelligence:route"
  ]

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def record(signal) when is_map(signal) do
    GenServer.cast(__MODULE__, {:signal, signal})
  end

  def summary(agent_id) do
    GenServer.call(__MODULE__, {:summary, agent_id})
  end

  @impl true
  def init(_opts) do
    Enum.each(@pubsub_topics, &Phoenix.PubSub.subscribe(Ema.PubSub, &1))
    Logger.info("[SignalProcessor] started, subscribed to #{length(@pubsub_topics)} topics")
    {:ok, %{signals: [], counts: %{}}}
  end

  @impl true
  def handle_info({:proposal_completed, proposal, duration_ms}, state) do
    signal = %{
      source: "proposal_pipeline",
      agent_id: "orchestrator",
      task_type: :proposal_generation,
      outcome: :success,
      duration_ms: duration_ms,
      metadata: %{proposal_id: proposal.id, quality_score: Map.get(proposal, :quality_score)}
    }

    {:noreply, process_and_store(state, signal)}
  end

  def handle_info({:proposal_failed, proposal, reason, duration_ms}, state) do
    signal = %{
      source: "proposal_pipeline",
      agent_id: "orchestrator",
      task_type: :proposal_generation,
      outcome: :failure,
      duration_ms: duration_ms,
      metadata: %{proposal_id: proposal_id(proposal), reason: inspect(reason)}
    }

    {:noreply, process_and_store(state, signal)}
  end

  def handle_info({:agent_run_completed, agent_id, task_type, duration_ms}, state) do
    signal = %{
      source: "agent_run",
      agent_id: agent_id,
      task_type: task_type,
      outcome: :success,
      duration_ms: duration_ms,
      metadata: %{}
    }

    {:noreply, process_and_store(state, signal)}
  end

  def handle_info({:agent_run_failed, agent_id, task_type, reason}, state) do
    signal = %{
      source: "agent_run",
      agent_id: agent_id,
      task_type: task_type,
      outcome: :failure,
      duration_ms: 0,
      metadata: %{reason: inspect(reason)}
    }

    {:noreply, process_and_store(state, signal)}
  end

  def handle_info({:quality_gate_passed, proposal}, state) do
    signal = %{
      source: "quality_gate",
      agent_id: "orchestrator",
      task_type: :quality_evaluation,
      outcome: :success,
      duration_ms: 0,
      metadata: %{proposal_id: proposal.id, score: Map.get(proposal, :quality_score)}
    }

    {:noreply, process_and_store(state, signal)}
  end

  def handle_info({:quality_gate_passed, agent_id, score}, state) do
    signal = %{
      source: "quality_gate",
      agent_id: agent_id,
      task_type: :quality_evaluation,
      outcome: :success,
      duration_ms: 0,
      metadata: %{score: score}
    }

    {:noreply, process_and_store(state, signal)}
  end

  def handle_info({:quality_gate_failed, feedback, iteration}, state) do
    signal = %{
      source: "quality_gate",
      agent_id: "orchestrator",
      task_type: :quality_evaluation,
      outcome: :failure,
      duration_ms: 0,
      metadata: %{feedback: feedback, iteration: iteration}
    }

    {:noreply, process_and_store(state, signal)}
  end

  def handle_info({:route_decision, payload}, state) do
    signal = %{
      source: "router",
      agent_id: route_target(payload),
      task_type: :routing,
      outcome: :success,
      duration_ms: 0,
      metadata: payload
    }

    {:noreply, process_and_store(state, signal)}
  end

  def handle_info(_event, state), do: {:noreply, state}

  @impl true
  def handle_cast({:signal, signal}, state) do
    {:noreply, process_and_store(state, signal)}
  end

  @impl true
  def handle_call({:summary, agent_id}, _from, state) do
    agent_signals = Enum.filter(state.signals, &(&1.agent_id == agent_id))

    summary = %{
      agent_id: agent_id,
      total_signals: length(agent_signals),
      success_count: Enum.count(agent_signals, &(&1.outcome == :success)),
      failure_count: Enum.count(agent_signals, &(&1.outcome == :failure)),
      recent: Enum.take(agent_signals, 10)
    }

    {:reply, summary, state}
  end

  defp process_and_store(state, signal) do
    process_signal(signal)
    update_state(state, signal)
  end

  defp process_signal(
         %{
           agent_id: agent_id,
           task_type: task_type,
           outcome: outcome,
           duration_ms: duration_ms
         } = signal
       ) do
    Logger.debug("[SignalProcessor] signal #{agent_id}/#{task_type} -> #{outcome}")
    AgentFitnessStore.record_outcome(agent_id, task_type, outcome, duration_ms)

    # Update UCB1 routing weights
    ucb_agent = agent_id |> to_string() |> String.to_atom()
    ucb_task = (task_type || :general) |> to_string() |> String.to_atom()
    ucb_outcome = if outcome in [:success, :win], do: :win, else: :loss
    Ema.Intelligence.UCBRouter.record_outcome(ucb_agent, ucb_task, ucb_outcome)

    # Update PromptVariantStore if a variant_id is present in the signal
    if variant_id = Map.get(signal, :variant_id) do
      Ema.Intelligence.PromptVariantStore.record_outcome(
        ucb_agent,
        ucb_task,
        variant_id,
        ucb_outcome
      )
    end

    Phoenix.PubSub.broadcast(Ema.PubSub, "signals:processed", {:signal, signal})
  end

  defp process_signal(signal) do
    Logger.warning("[SignalProcessor] malformed signal: #{inspect(signal)}")
  end

  defp update_state(state, signal) do
    signals = [signal | state.signals] |> Enum.take(500)
    counts = Map.update(state.counts, signal.agent_id, 1, &(&1 + 1))
    %{state | signals: signals, counts: counts}
  end

  defp route_target(%{decision: %{target: target}}), do: normalize_target(target)
  defp route_target(%{"decision" => %{"target" => target}}), do: normalize_target(target)
  defp route_target(_payload), do: "router"

  defp normalize_target(target) when is_atom(target), do: Atom.to_string(target)
  defp normalize_target(target) when is_binary(target), do: target
  defp normalize_target(_target), do: "router"

  defp proposal_id(%{id: id}), do: id
  defp proposal_id(%{"id" => id}), do: id
  defp proposal_id(_proposal), do: nil
end
