defmodule Ema.Proposals.CostAggregator do
  @moduledoc """
  Aggregates per-stage Claude costs for proposals and tracks daily budget.

  ## Cost Model
  Each proposal pipeline stage has a different cost profile:
    - Generator  (haiku)  — cheap
    - Refiner    (sonnet) — mid
    - RiskAnalyzer (sonnet) — mid
    - Formatter  (haiku)  — cheap

  Per-stage costs are tracked via CostTracker's session records and
  linked by proposal_id in the generation_log.

  ## Daily Budget
  A configurable daily spend cap. When 80% is consumed, a PubSub alert
  fires. At 100%, new proposals are blocked.
  """

  use GenServer
  require Logger

  # aliases/imports will be needed when UsageRecord is implemented
  # alias Ema.Claude.CostTracker
  # alias Ema.Repo
  # import Ecto.Query

  # USD
  @daily_budget_default 5.00
  # 80% triggers warning
  @alert_threshold 0.80

  # ── Client API ─────────────────────────────────────────────────────────────

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Get the aggregated cost for a specific proposal.

  Returns a map with:
    - `:total_usd` — total cost across all stages + iterations
    - `:by_stage` — map of stage → cost
    - `:iterations` — number of pipeline iterations run
    - `:display` — formatted string like "$0.08 (4 stages, 2 iter)"
  """
  def proposal_cost(proposal_id) do
    GenServer.call(__MODULE__, {:proposal_cost, proposal_id})
  end

  @doc """
  Get today's total spend across all proposals.
  """
  def daily_spend do
    GenServer.call(__MODULE__, :daily_spend)
  end

  @doc """
  Check if we're within daily budget.
  Returns `:ok` | `{:warning, pct_used}` | `{:blocked, :over_budget}`
  """
  def budget_check do
    GenServer.call(__MODULE__, :budget_check)
  end

  @doc """
  Get the configured daily budget cap in USD.
  """
  def daily_budget do
    Application.get_env(:ema, :daily_ai_budget_usd, @daily_budget_default)
  end

  # ── GenServer Callbacks ────────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    # Subscribe to cost events from Bridge
    Phoenix.PubSub.subscribe(Ema.PubSub, "claude:session_ended")

    {:ok, %{proposal_costs: %{}, daily_alerts_sent: MapSet.new()}}
  end

  @impl true
  def handle_call({:proposal_cost, proposal_id}, _from, state) do
    cost_data = compute_proposal_cost(proposal_id)
    {:reply, cost_data, state}
  end

  @impl true
  def handle_call(:daily_spend, _from, state) do
    total = compute_daily_spend()
    {:reply, total, state}
  end

  @impl true
  def handle_call(:budget_check, _from, state) do
    budget = daily_budget()
    spent = compute_daily_spend()
    pct = if budget > 0, do: spent / budget, else: 0.0

    result =
      cond do
        pct >= 1.0 -> {:blocked, :over_budget}
        pct >= @alert_threshold -> {:warning, pct}
        true -> :ok
      end

    # Send alert if crossing threshold for the first time today
    today = Date.utc_today() |> to_string()
    alert_key = "#{today}_#{threshold_label(pct)}"

    state =
      if result != :ok and not MapSet.member?(state.daily_alerts_sent, alert_key) do
        broadcast_budget_alert(pct, spent, budget)
        %{state | daily_alerts_sent: MapSet.put(state.daily_alerts_sent, alert_key)}
      else
        state
      end

    {:reply, result, state}
  end

  # Handle Bridge session_ended events to update per-proposal cost tracking
  @impl true
  def handle_info({:claude_session_ended, %{session_id: session_id} = _payload}, state) do
    # Check if this session belongs to a proposal
    case extract_proposal_id_from_session(session_id) do
      nil ->
        {:noreply, state}

      _proposal_id ->
        # Cost is already tracked by CostTracker in usage_records
        # We just need to check budget after recording
        check_and_alert_budget(state)
    end
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # ── Cost Computation ───────────────────────────────────────────────────────

  defp compute_proposal_cost(proposal_id) do
    # Look up cost records for sessions named "proposal-<id>"
    # Session IDs are "proposal-<proposal_id>" per Orchestrator convention
    session_pattern = "proposal-#{proposal_id}"

    usage_records = query_usage_records(session_pattern)

    total = Enum.reduce(usage_records, 0.0, fn r, acc -> acc + (r.cost_usd || 0.0) end)
    by_stage = group_by_stage(usage_records)
    iterations = estimate_iterations(usage_records)

    %{
      total_usd: total,
      by_stage: by_stage,
      iterations: iterations,
      display: format_cost_display(total, length(usage_records), iterations)
    }
  end

  defp compute_daily_spend do
    today_start =
      Date.utc_today()
      |> DateTime.new!(~T[00:00:00], "Etc/UTC")

    query_daily_total(today_start)
  end

  defp query_usage_records(session_prefix) do
    # Ema.Claude.UsageRecord not yet defined — return empty list gracefully
    Logger.debug(
      "[CostAggregator] usage record query skipped for #{session_prefix} (module pending)"
    )

    []
  end

  defp query_daily_total(_since) do
    # Ema.Claude.UsageRecord not yet defined — return 0.0 gracefully
    0.0
  end

  defp group_by_stage(usage_records) do
    # Session IDs follow pattern "proposal-<id>-<stage>" or similar
    # Group by the stage portion of the session ID
    Enum.reduce(usage_records, %{}, fn record, acc ->
      stage = extract_stage_from_session(record.session_id)
      current = Map.get(acc, stage, 0.0)
      Map.put(acc, stage, current + (record.cost_usd || 0.0))
    end)
  end

  defp extract_stage_from_session(session_id) when is_binary(session_id) do
    # Session IDs: "proposal-<id>" — stage info comes from sequence
    # We mark stages by the order of usage records
    # For now just return "pipeline" as a generic stage
    cond do
      String.contains?(session_id, "generator") -> "generator"
      String.contains?(session_id, "refiner") -> "refiner"
      String.contains?(session_id, "risk") -> "risk_analyzer"
      String.contains?(session_id, "format") -> "formatter"
      true -> "pipeline"
    end
  end

  defp extract_stage_from_session(_), do: "pipeline"

  defp estimate_iterations(usage_records) do
    # Rough estimate: 4 API calls per iteration
    calls = length(usage_records)
    max(1, div(calls + 3, 4))
  end

  defp format_cost_display(total, calls, iterations) do
    stages = min(calls, 4)
    cost_str = "$#{Float.round(total, 4)}"

    if iterations > 1 do
      "#{cost_str} (#{stages} stages, #{iterations} iter)"
    else
      "#{cost_str} (#{stages} stages)"
    end
  end

  defp extract_proposal_id_from_session(session_id) when is_binary(session_id) do
    case Regex.run(~r/^proposal-(.+)$/, session_id) do
      [_, proposal_id] -> proposal_id
      _ -> nil
    end
  end

  defp extract_proposal_id_from_session(_), do: nil

  defp check_and_alert_budget(state) do
    budget = daily_budget()
    spent = compute_daily_spend()
    pct = if budget > 0, do: spent / budget, else: 0.0

    today = Date.utc_today() |> to_string()
    alert_key = "#{today}_#{threshold_label(pct)}"

    if pct >= @alert_threshold and not MapSet.member?(state.daily_alerts_sent, alert_key) do
      broadcast_budget_alert(pct, spent, budget)
      {:noreply, %{state | daily_alerts_sent: MapSet.put(state.daily_alerts_sent, alert_key)}}
    else
      {:noreply, state}
    end
  end

  defp broadcast_budget_alert(pct, spent, budget) do
    pct_display = Float.round(pct * 100, 0) |> trunc()

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "proposals:events",
      {:budget_alert,
       %{
         pct_used: pct,
         spent_usd: spent,
         budget_usd: budget,
         message: "Daily AI budget at #{pct_display}% ($#{Float.round(spent, 2)} / $#{budget})"
       }}
    )

    Logger.warning(
      "[CostAggregator] Budget alert: #{pct_display}% used ($#{Float.round(spent, 2)} / $#{budget})"
    )
  end

  defp threshold_label(pct) when pct >= 1.0, do: "100"
  defp threshold_label(pct) when pct >= 0.9, do: "90"
  defp threshold_label(pct) when pct >= 0.8, do: "80"
  defp threshold_label(_), do: "ok"
end
