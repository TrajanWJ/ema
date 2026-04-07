defmodule Ema.Intelligence.CostGovernor do
  @moduledoc """
  Real-time cost governor with tiered degradation.

  Tracks API spend in ETS for O(1) lookups. When budget thresholds are hit,
  the system auto-degrades through four tiers:

    - 50%  → :pause_engine   — Proposal engine paused
    - 75%  → :downgrade_models — Downgraded to haiku
    - 90%  → :agent_only     — Only agent chat allowed
    - 100% → :hard_stop      — All AI calls blocked

  Consolidates functionality from TokenTracker (DB persistence),
  BudgetEnforcer (fuse), and CostAggregator (proposal costs) into a
  single source of truth for budget enforcement.

  ## ETS Table

  `:cost_governor` table stores:
    - `{:spend, domain, date}` → {cost_usd, token_count}
    - `{:total, date}` → {cost_usd, token_count}
    - `:daily_budget` → float
    - `:current_tier` → tier atom
  """

  use GenServer
  require Logger

  alias Ema.Intelligence.TokenTracker

  @table :cost_governor
  @default_daily_budget 10.0

  @tiers [
    {0.50, :pause_engine, "Proposal engine paused"},
    {0.75, :downgrade_models, "Downgraded to haiku"},
    {0.90, :agent_only, "Only agent chat allowed"},
    {1.00, :hard_stop, "All AI calls blocked"}
  ]

  @tier_check_interval :timer.seconds(30)

  # Domains that can make AI calls
  @domains ~w(proposal_engine agent_chat agent_dispatch superman system)a

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Record a cost event. Updates ETS running totals and persists via TokenTracker.

  ## Parameters
    - domain: atom like :proposal_engine, :agent_chat, :agent_dispatch, :superman, :system
    - provider: string like "claude_cli", "ollama", "openrouter"
    - model: string like "sonnet", "haiku", "opus"
    - cost_usd: float
    - tokens: integer (total tokens, input + output)
  """
  def record_cost(domain, provider, model, cost_usd, tokens) do
    GenServer.cast(__MODULE__, {:record_cost, domain, provider, model, cost_usd, tokens})
  end

  @doc "Get current spend for a time window (:daily, :weekly, :monthly)."
  def current_spend(window \\ :daily) do
    case window do
      :daily -> read_daily_total(Date.utc_today())
      :weekly -> sum_range(Date.add(Date.utc_today(), -6), Date.utc_today())
      :monthly -> sum_range(first_of_month(), Date.utc_today())
    end
  end

  @doc "Get remaining budget for the given window."
  def budget_remaining(window \\ :daily) do
    budget = get_budget()
    spent = current_spend(window)
    max(0.0, budget - spent)
  end

  @doc "Get current tier based on spend/budget ratio."
  def current_tier do
    case :ets.lookup(@table, :current_tier) do
      [{:current_tier, tier}] -> tier
      [] -> :normal
    end
  end

  @doc """
  Check if a domain is allowed to make AI calls under the current tier.

  Returns :ok or {:error, :budget_exceeded, tier, message}.
  """
  def allowed?(domain) do
    tier = current_tier()

    case {tier, domain} do
      {:normal, _} ->
        :ok

      {:pause_engine, :proposal_engine} ->
        {:error, :budget_exceeded, tier, "Proposal engine paused — 50% of daily budget used"}

      {:pause_engine, _} ->
        :ok

      {:downgrade_models, :proposal_engine} ->
        {:error, :budget_exceeded, tier, "Proposal engine paused — 75% of daily budget used"}

      {:downgrade_models, _} ->
        # Allowed but caller should use haiku
        :ok

      {:agent_only, domain} when domain in [:agent_chat, :agent_dispatch] ->
        :ok

      {:agent_only, _} ->
        {:error, :budget_exceeded, tier, "Only agent chat allowed — 90% of daily budget used"}

      {:hard_stop, _} ->
        {:error, :budget_exceeded, tier, "All AI calls blocked — daily budget exhausted"}
    end
  end

  @doc "Get the recommended model for the current tier."
  def recommended_model(preferred \\ "sonnet") do
    case current_tier() do
      tier when tier in [:downgrade_models, :agent_only] -> "haiku"
      _ -> preferred
    end
  end

  @doc "Get the daily budget in USD."
  def get_budget do
    case :ets.lookup(@table, :daily_budget) do
      [{:daily_budget, budget}] -> budget
      [] -> @default_daily_budget
    end
  end

  @doc "Set the daily budget in USD."
  def set_budget(amount) when is_number(amount) and amount > 0 do
    GenServer.call(__MODULE__, {:set_budget, amount})
  end

  @doc "Get spend breakdown by domain for today."
  def spend_by_domain do
    today = Date.utc_today()

    @domains
    |> Enum.map(fn domain ->
      key = {:spend, domain, today}

      case :ets.lookup(@table, key) do
        [{^key, cost, _tokens}] -> {domain, cost}
        [] -> {domain, 0.0}
      end
    end)
    |> Enum.reject(fn {_d, cost} -> cost == 0.0 end)
    |> Map.new()
  end

  @doc "Full status report for CLI/API."
  def status do
    budget = get_budget()
    spent = current_spend(:daily)
    tier = current_tier()
    ratio = if budget > 0, do: Float.round(spent / budget * 100, 1), else: 0.0

    %{
      daily_budget: budget,
      daily_spend: Float.round(spent, 4),
      budget_remaining: Float.round(budget_remaining(), 4),
      percent_used: ratio,
      current_tier: tier,
      tier_label: tier_label(tier),
      by_domain: spend_by_domain(),
      weekly_spend: Float.round(current_spend(:weekly), 2),
      monthly_spend: Float.round(current_spend(:monthly), 2)
    }
  end

  @doc "Reset today's spend counters (for testing or manual override)."
  def reset_today do
    GenServer.call(__MODULE__, :reset_today)
  end

  # --- GenServer Callbacks ---

  @impl true
  def init(opts) do
    table = :ets.new(@table, [:named_table, :public, :set, read_concurrency: true])
    budget = Keyword.get(opts, :daily_budget, @default_daily_budget)
    :ets.insert(table, {:daily_budget, budget})
    :ets.insert(table, {:current_tier, :normal})

    # Hydrate from TokenTracker's DB data for today
    hydrate_from_db()

    # Recalculate tier on boot
    recalculate_tier()

    schedule_tier_check()
    {:ok, %{table: table}}
  end

  @impl true
  def handle_cast({:record_cost, domain, provider, model, cost_usd, tokens}, state) do
    today = Date.utc_today()

    # Update per-domain counter
    domain_key = {:spend, domain, today}
    update_counter(domain_key, cost_usd, tokens)

    # Update daily total
    total_key = {:total, today}
    update_counter(total_key, cost_usd, tokens)

    # Update per-provider counter
    provider_key = {:provider, provider, today}
    update_counter(provider_key, cost_usd, tokens)

    # Update per-model counter
    model_key = {:model, model, today}
    update_counter(model_key, cost_usd, tokens)

    # Persist to TokenTracker (DB) async
    persist_async(domain, provider, model, cost_usd, tokens)

    # Check for tier changes
    old_tier = current_tier()
    new_tier = recalculate_tier()

    if old_tier != new_tier do
      handle_tier_change(old_tier, new_tier)
    end

    {:noreply, state}
  end

  @impl true
  def handle_call({:set_budget, amount}, _from, state) do
    :ets.insert(@table, {:daily_budget, amount})

    # Also persist to Settings
    Ema.Settings.set("daily_ai_budget_usd", to_string(amount))

    # Recalculate tier with new budget
    old_tier = current_tier()
    new_tier = recalculate_tier()

    if old_tier != new_tier do
      handle_tier_change(old_tier, new_tier)
    end

    Logger.info("[CostGovernor] Daily budget set to $#{amount}")
    {:reply, :ok, state}
  end

  @impl true
  def handle_call(:reset_today, _from, state) do
    today = Date.utc_today()

    # Delete all today's counters
    :ets.match_delete(@table, {{:spend, :_, today}, :_, :_})
    :ets.match_delete(@table, {{:total, today}, :_, :_})
    :ets.match_delete(@table, {{:provider, :_, today}, :_, :_})
    :ets.match_delete(@table, {{:model, :_, today}, :_, :_})

    recalculate_tier()
    Logger.info("[CostGovernor] Today's spend counters reset")
    {:reply, :ok, state}
  end

  @impl true
  def handle_info(:tier_check, state) do
    recalculate_tier()
    schedule_tier_check()
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Internal ---

  defp update_counter(key, cost_usd, tokens) do
    case :ets.lookup(@table, key) do
      [{^key, existing_cost, existing_tokens}] ->
        :ets.insert(@table, {key, existing_cost + cost_usd, existing_tokens + tokens})

      [] ->
        :ets.insert(@table, {key, cost_usd, tokens})
    end
  end

  defp read_daily_total(date) do
    key = {:total, date}

    case :ets.lookup(@table, key) do
      [{^key, cost, _tokens}] -> cost
      [] -> 0.0
    end
  end

  defp sum_range(from_date, to_date) do
    Date.range(from_date, to_date)
    |> Enum.reduce(0.0, fn date, acc -> acc + read_daily_total(date) end)
  end

  defp first_of_month do
    today = Date.utc_today()
    Date.new!(today.year, today.month, 1)
  end

  defp recalculate_tier do
    budget = get_budget()
    spent = current_spend(:daily)
    ratio = if budget > 0, do: spent / budget, else: 0.0

    new_tier =
      @tiers
      |> Enum.reverse()
      |> Enum.find(fn {threshold, _tier, _label} -> ratio >= threshold end)
      |> case do
        {_threshold, tier, _label} -> tier
        nil -> :normal
      end

    :ets.insert(@table, {:current_tier, new_tier})
    new_tier
  end

  defp handle_tier_change(old_tier, new_tier) do
    {_threshold, _tier, label} =
      Enum.find(@tiers, {0, new_tier, "Normal"}, fn {_t, t, _l} -> t == new_tier end)

    msg =
      if new_tier == :normal do
        "Budget tier returned to normal (was #{old_tier})"
      else
        "Budget tier changed: #{old_tier} → #{new_tier} — #{label}"
      end

    Logger.warning("[CostGovernor] #{msg}")

    # Broadcast tier change on system:alerts
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "system:alerts",
      {:cost_tier_changed,
       %{
         old_tier: old_tier,
         new_tier: new_tier,
         label: label,
         message: msg,
         daily_spend: current_spend(:daily),
         daily_budget: get_budget()
       }}
    )

    # Also broadcast on intelligence:tokens for existing listeners
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "intelligence:tokens",
      {:tier_changed,
       %{
         old_tier: old_tier,
         new_tier: new_tier,
         label: label
       }}
    )

    # Auto-pause proposal engine when tier hits :pause_engine or worse
    if new_tier in [:pause_engine, :downgrade_models, :agent_only, :hard_stop] do
      try do
        Ema.ProposalEngine.Scheduler.pause()
      rescue
        _ -> :ok
      end
    end
  end

  defp persist_async(domain, _provider, model, cost_usd, tokens) do
    # Record via TokenTracker for DB persistence
    Task.start(fn ->
      try do
        TokenTracker.record(%{
          model: model,
          input_tokens: div(tokens, 2),
          output_tokens: div(tokens, 2),
          cost_usd: cost_usd,
          source: domain_to_source(domain),
          session_id: "governor-#{System.unique_integer([:positive])}"
        })
      rescue
        _ -> :ok
      end
    end)
  end

  defp domain_to_source(:agent_chat), do: "agent_session"
  defp domain_to_source(:agent_dispatch), do: "agent_session"
  defp domain_to_source(:superman), do: "superman"
  defp domain_to_source(:proposal_engine), do: "claude_bridge"
  defp domain_to_source(_), do: "manual"

  defp hydrate_from_db do
    today_cost = TokenTracker.today_cost()

    if today_cost > 0 do
      today = Date.utc_today()
      :ets.insert(@table, {{:total, today}, today_cost, 0})
      Logger.info("[CostGovernor] Hydrated from DB: $#{Float.round(today_cost, 4)} today")
    end
  rescue
    _ -> :ok
  end

  defp schedule_tier_check do
    Process.send_after(self(), :tier_check, @tier_check_interval)
  end

  defp tier_label(:normal), do: "Normal — all systems operational"
  defp tier_label(:pause_engine), do: "Proposal engine paused"
  defp tier_label(:downgrade_models), do: "Downgraded to haiku"
  defp tier_label(:agent_only), do: "Only agent chat allowed"
  defp tier_label(:hard_stop), do: "All AI calls blocked"
end
