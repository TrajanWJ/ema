defmodule Ema.Intelligence.ScopeAdvisor do
  @moduledoc """
  Advises when a task may be too broad based on recent outcomes for the same agent/domain.
  """

  alias Ema.Intelligence.OutcomeTracker

  @recent_limit 5
  @warn_threshold 2
  @bad_statuses MapSet.new(["failed", "timeout", :failed, :timeout])

  def check(agent, _domain, _title) when agent in [nil, ""], do: :ok
  def check(_agent, domain, _title) when domain in [nil, ""], do: :ok

  def check(agent, domain, _title) do
    outcomes = OutcomeTracker.recent_for_domain(agent, domain, @recent_limit)
    bad_count = Enum.count(outcomes, &bad_outcome?/1)

    if bad_count >= @warn_threshold do
      {:warn,
       "Recent #{agent}/#{domain} outcomes show repeated failures or timeouts. Consider narrowing scope."}
    else
      :ok
    end
  end

  def to_metadata(:ok), do: %{"warn" => false, "reason" => nil}
  def to_metadata({:warn, reason}), do: %{"warn" => true, "reason" => reason}

  defp bad_outcome?(%{"status" => status}), do: MapSet.member?(@bad_statuses, status)
  defp bad_outcome?(_), do: false
end
