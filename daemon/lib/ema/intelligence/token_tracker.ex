defmodule Ema.Intelligence.TokenTracker do
  @moduledoc """
  GenServer that tracks token usage and costs across all Claude API calls.
  Provides cost calculation, aggregation, and budget monitoring.
  """

  use GenServer
  require Logger

  import Ecto.Query

  alias Ema.Repo
  alias Ema.Intelligence.{TokenEvent, TokenBudget}

  # Cost per 1M tokens (USD)
  @model_costs %{
    "claude-opus-4-6" => %{input: 15.0, output: 75.0},
    "claude-sonnet-4-6" => %{input: 3.0, output: 15.0},
    "claude-haiku-4-5" => %{input: 0.25, output: 1.25},
    # Aliases
    "opus" => %{input: 15.0, output: 75.0},
    "sonnet" => %{input: 3.0, output: 15.0},
    "haiku" => %{input: 0.25, output: 1.25}
  }

  @budget_check_interval :timer.minutes(15)

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Record a token usage event. Returns {:ok, event} or {:error, changeset}."
  def record(attrs) do
    GenServer.call(__MODULE__, {:record, attrs})
  end

  @doc "Calculate cost for given model and token counts."
  def calculate_cost(model, input_tokens, output_tokens) do
    costs = Map.get(@model_costs, model, %{input: 3.0, output: 15.0})
    input_cost = input_tokens / 1_000_000 * costs.input
    output_cost = output_tokens / 1_000_000 * costs.output
    Float.round(input_cost + output_cost, 6)
  end

  @doc "Get today's total cost."
  def today_cost do
    today = Date.utc_today()
    start_of_day = DateTime.new!(today, ~T[00:00:00], "Etc/UTC")

    TokenEvent
    |> where([e], e.inserted_at >= ^start_of_day)
    |> select([e], sum(e.cost_usd))
    |> Repo.one()
    |> Kernel.||(0.0)
  end

  @doc "Get cost summary: today, this week, this month."
  def summary do
    now = DateTime.utc_now()
    today = Date.utc_today()
    start_of_day = DateTime.new!(today, ~T[00:00:00], "Etc/UTC")

    start_of_week =
      DateTime.new!(Date.add(today, -Date.day_of_week(today) + 1), ~T[00:00:00], "Etc/UTC")

    start_of_month = DateTime.new!(Date.new!(today.year, today.month, 1), ~T[00:00:00], "Etc/UTC")

    today_cost = sum_cost_since(start_of_day)
    week_cost = sum_cost_since(start_of_week)
    month_cost = sum_cost_since(start_of_month)

    yesterday_start = DateTime.add(start_of_day, -86400)
    yesterday_cost = sum_cost_between(yesterday_start, start_of_day)
    today_delta = today_cost - yesterday_cost

    budget = get_or_create_budget()

    percent_used =
      if budget.monthly_budget_usd > 0,
        do: Float.round(month_cost / budget.monthly_budget_usd * 100, 1),
        else: 0.0

    days_in_month = Date.days_in_month(today)
    days_remaining = days_in_month - today.day + 1

    by_agent = breakdown_by(:agent_id, start_of_month)
    by_model = breakdown_by(:model, start_of_month)

    %{
      today_cost: Float.round(today_cost, 2),
      today_delta: Float.round(today_delta, 2),
      week_cost: Float.round(week_cost, 2),
      month_cost: Float.round(month_cost, 2),
      monthly_budget: budget.monthly_budget_usd,
      percent_used: percent_used,
      days_remaining: days_remaining,
      by_agent: by_agent,
      by_model: by_model,
      as_of: now
    }
  end

  @doc "Get daily cost history for the last N days."
  def history(days \\ 30) do
    since = DateTime.new!(Date.add(Date.utc_today(), -(days - 1)), ~T[00:00:00], "Etc/UTC")

    TokenEvent
    |> where([e], e.inserted_at >= ^since)
    |> group_by([e], fragment("date(inserted_at)"))
    |> select([e], %{
      date: fragment("date(inserted_at)"),
      total_cost: sum(e.cost_usd),
      total_input: sum(e.input_tokens),
      total_output: sum(e.output_tokens),
      event_count: count(e.id)
    })
    |> order_by([e], fragment("date(inserted_at)"))
    |> Repo.all()
  end

  @doc "Forecast monthly cost based on last 7 days."
  def forecast do
    last_7 = history(7)

    if Enum.empty?(last_7) do
      %{daily_avg: 0.0, projected_monthly: 0.0, trend: "stable"}
    else
      costs = Enum.map(last_7, & &1.total_cost)
      daily_avg = Enum.sum(costs) / length(costs)
      today = Date.utc_today()
      days_in_month = Date.days_in_month(today)
      projected = daily_avg * days_in_month

      trend =
        cond do
          length(costs) < 3 -> "insufficient_data"
          List.last(costs) > daily_avg * 1.5 -> "rising"
          List.last(costs) < daily_avg * 0.5 -> "falling"
          true -> "stable"
        end

      %{
        daily_avg: Float.round(daily_avg, 2),
        projected_monthly: Float.round(projected, 2),
        trend: trend
      }
    end
  end

  @doc "Get or create the budget record."
  def get_or_create_budget do
    case Repo.get(TokenBudget, "default") do
      nil ->
        {:ok, budget} =
          %TokenBudget{}
          |> TokenBudget.changeset(%{
            id: "default",
            monthly_budget_usd: 100.0,
            alert_threshold_pct: 80
          })
          |> Repo.insert()

        budget

      budget ->
        budget
    end
  end

  @doc "Update the monthly budget."
  def set_budget(amount_usd) when is_number(amount_usd) and amount_usd > 0 do
    budget = get_or_create_budget()

    budget
    |> TokenBudget.changeset(%{monthly_budget_usd: amount_usd})
    |> Repo.update()
  end

  # --- Callbacks ---

  @impl true
  def init(_opts) do
    schedule_budget_check()
    {:ok, %{}}
  end

  @impl true
  def handle_call({:record, attrs}, _from, state) do
    cost =
      calculate_cost(
        attrs[:model] || attrs["model"] || "sonnet",
        attrs[:input_tokens] || attrs["input_tokens"] || 0,
        attrs[:output_tokens] || attrs["output_tokens"] || 0
      )

    event_attrs =
      attrs
      |> Map.new(fn {k, v} -> {to_string(k), v} end)
      |> Map.merge(%{
        "id" => Ecto.UUID.generate(),
        "cost_usd" => cost
      })

    result =
      %TokenEvent{}
      |> TokenEvent.changeset(event_attrs)
      |> Repo.insert()

    case result do
      {:ok, event} ->
        broadcast(:token_recorded, event)
        {:reply, {:ok, event}, state}

      {:error, changeset} ->
        {:reply, {:error, changeset}, state}
    end
  end

  @impl true
  def handle_info(:check_budget, state) do
    check_budget_alerts()
    schedule_budget_check()
    {:noreply, state}
  end

  # --- Internal ---

  defp schedule_budget_check do
    Process.send_after(self(), :check_budget, @budget_check_interval)
  end

  defp check_budget_alerts do
    budget = get_or_create_budget()
    today = Date.utc_today()
    start_of_month = DateTime.new!(Date.new!(today.year, today.month, 1), ~T[00:00:00], "Etc/UTC")
    month_cost = sum_cost_since(start_of_month)

    percent =
      if budget.monthly_budget_usd > 0, do: month_cost / budget.monthly_budget_usd * 100, else: 0

    cond do
      percent >= 100 ->
        broadcast(:budget_exceeded, %{
          month_cost: month_cost,
          budget: budget.monthly_budget_usd,
          percent: percent
        })

      percent >= budget.alert_threshold_pct ->
        broadcast(:budget_warning, %{
          month_cost: month_cost,
          budget: budget.monthly_budget_usd,
          percent: percent
        })

      true ->
        :ok
    end
  end

  defp sum_cost_since(since) do
    TokenEvent
    |> where([e], e.inserted_at >= ^since)
    |> select([e], sum(e.cost_usd))
    |> Repo.one()
    |> Kernel.||(0.0)
  end

  defp sum_cost_between(from, to) do
    TokenEvent
    |> where([e], e.inserted_at >= ^from and e.inserted_at < ^to)
    |> select([e], sum(e.cost_usd))
    |> Repo.one()
    |> Kernel.||(0.0)
  end

  defp breakdown_by(field, since) do
    TokenEvent
    |> where([e], e.inserted_at >= ^since)
    |> where([e], not is_nil(field(e, ^field)))
    |> group_by([e], field(e, ^field))
    |> select([e], %{
      key: field(e, ^field),
      total_cost: sum(e.cost_usd),
      total_input: sum(e.input_tokens),
      total_output: sum(e.output_tokens),
      event_count: count(e.id)
    })
    |> order_by([e], desc: sum(e.cost_usd))
    |> Repo.all()
  end

  defp broadcast(event, payload) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "intelligence:tokens", {event, payload})
  end
end
