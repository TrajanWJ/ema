defmodule Ema.Intelligence.CostForecaster do
  @moduledoc """
  GenServer that monitors cost trends, detects spikes, and sends
  budget alerts. Runs hourly checks and a weekly digest on Sundays.
  """

  use GenServer
  require Logger

  alias Ema.Intelligence.TokenTracker

  @check_interval :timer.hours(1)

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Check for cost spikes right now."
  def check_spikes do
    GenServer.cast(__MODULE__, :check_spikes)
  end

  @doc "Detect if today's cost is a spike (>2x daily average)."
  def detect_spike do
    forecast = TokenTracker.forecast()
    today_cost = TokenTracker.today_cost()

    if forecast.daily_avg > 0 and today_cost > forecast.daily_avg * 2 do
      multiplier = Float.round(today_cost / forecast.daily_avg, 1)
      {:spike, %{today_cost: today_cost, daily_avg: forecast.daily_avg, multiplier: multiplier}}
    else
      :normal
    end
  end

  @doc "Generate weekly digest data."
  def weekly_digest do
    summary = TokenTracker.summary()
    forecast = TokenTracker.forecast()
    history = TokenTracker.history(7)

    total_week = summary.week_cost
    daily_costs = Enum.map(history, & &1.total_cost)
    peak_day = if Enum.empty?(history), do: nil, else: Enum.max_by(history, & &1.total_cost)

    %{
      week_cost: total_week,
      daily_avg: forecast.daily_avg,
      projected_monthly: forecast.projected_monthly,
      trend: forecast.trend,
      peak_day: peak_day,
      budget: summary.monthly_budget,
      month_cost: summary.month_cost,
      percent_used: summary.percent_used,
      days_remaining: summary.days_remaining
    }
  end

  # --- Callbacks ---

  @impl true
  def init(_opts) do
    schedule_check()
    {:ok, %{last_spike_alert: nil, last_digest: nil}}
  end

  @impl true
  def handle_info(:check, state) do
    state = do_check(state)
    schedule_check()
    {:noreply, state}
  end

  @impl true
  def handle_cast(:check_spikes, state) do
    {:noreply, do_check(state)}
  end

  # --- Internal ---

  defp schedule_check do
    Process.send_after(self(), :check, @check_interval)
  end

  defp do_check(state) do
    state = check_cost_spike(state)
    state = maybe_send_weekly_digest(state)
    check_budget_exceeded(state)
  end

  defp check_cost_spike(state) do
    case detect_spike() do
      {:spike, data} ->
        today = Date.utc_today()

        if state.last_spike_alert != today do
          broadcast(:cost_spike, %{
            message: "Cost spike detected: $#{Float.round(data.today_cost, 2)} today (#{data.multiplier}x your average)",
            today_cost: data.today_cost,
            daily_avg: data.daily_avg,
            multiplier: data.multiplier
          })

          Logger.info("CostForecaster: spike detected — $#{Float.round(data.today_cost, 2)} (#{data.multiplier}x avg)")
          %{state | last_spike_alert: today}
        else
          state
        end

      :normal ->
        state
    end
  end

  defp maybe_send_weekly_digest(state) do
    today = Date.utc_today()
    is_sunday = Date.day_of_week(today) == 7
    already_sent = state.last_digest == today

    if is_sunday and not already_sent do
      digest = weekly_digest()

      broadcast(:weekly_digest, %{
        message: "Weekly cost digest: $#{Float.round(digest.week_cost, 2)} this week, projected $#{Float.round(digest.projected_monthly, 2)}/month",
        digest: digest
      })

      Logger.info("CostForecaster: weekly digest sent — $#{Float.round(digest.week_cost, 2)} this week")
      %{state | last_digest: today}
    else
      state
    end
  end

  defp check_budget_exceeded(state) do
    summary = TokenTracker.summary()

    if summary.percent_used >= 100 do
      broadcast(:budget_exceeded, %{
        message: "Monthly budget exceeded: $#{Float.round(summary.month_cost, 2)} of $#{summary.monthly_budget}",
        month_cost: summary.month_cost,
        budget: summary.monthly_budget,
        percent: summary.percent_used
      })
    end

    state
  end

  defp broadcast(event, payload) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "intelligence:tokens", {event, payload})
    # Also broadcast to notifications channel for the notification store
    Phoenix.PubSub.broadcast(Ema.PubSub, "notifications", {:notification, Map.put(payload, :type, event)})
  end
end
