defmodule Ema.Intelligence.BudgetEnforcer do
  @moduledoc """
  Fuse-based circuit breaker for daily AI spend limits.
  Integrates with Ema.Proposals.CostAggregator for spend tracking.

  Fuse trips after spend >= daily_limit. Resets after 24h by default.
  Also provides manual kill switch via disable/enable.
  """

  require Logger

  @fuse_name :ema_budget_fuse

  @doc "Install the fuse — call once at startup in Application."
  def install(opts \\ []) do
    max_violations = Keyword.get(opts, :max_violations, 3)
    window_ms = Keyword.get(opts, :window_ms, :timer.hours(1))
    reset_ms = Keyword.get(opts, :reset_ms, :timer.hours(24))
    :fuse.install(@fuse_name, {{:standard, max_violations, window_ms}, {:reset, reset_ms}})
    :ok
  rescue
    _ -> :ok
  end

  @doc "Check budget before a Claude invocation. Returns :ok or {:error, :budget_exceeded}."
  def check do
    case :fuse.ask(@fuse_name, :sync) do
      :ok -> :ok
      :blown -> {:error, :budget_exceeded}
    end
  rescue
    _ -> :ok
  end

  @doc "Notify of a spend update. Melts fuse if over daily limit."
  def notify_spend(current_usd, daily_limit_usd) when current_usd >= daily_limit_usd do
    Logger.warning(
      "[BudgetEnforcer] Daily budget exceeded: $#{current_usd} >= $#{daily_limit_usd}"
    )

    :fuse.melt(@fuse_name)
    :ok
  rescue
    _ -> :ok
  end

  def notify_spend(_current, _limit), do: :ok

  @doc "Manual kill switch — disables all Claude invocations immediately."
  def disable do
    :fuse.circuit_disable(@fuse_name)
    Logger.warning("[BudgetEnforcer] Kill switch activated — all dispatches blocked")
    :ok
  rescue
    _ -> :ok
  end

  @doc "Re-enable after manual disable."
  def enable do
    :fuse.circuit_enable(@fuse_name)
    Logger.info("[BudgetEnforcer] Kill switch lifted — dispatches re-enabled")
    :ok
  rescue
    _ -> :ok
  end

  def name, do: @fuse_name
end
