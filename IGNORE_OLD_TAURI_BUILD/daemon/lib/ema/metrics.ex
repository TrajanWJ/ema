defmodule Ema.Metrics do
  @moduledoc """
  Aggregate queries over OutcomeTracker data.
  Provides summary statistics for the Outcome Dashboard.
  """

  alias Ema.Intelligence.OutcomeTracker

  def summary() do
    outcomes = OutcomeTracker.all()

    %{
      total_executions: length(outcomes),
      success_rate: calculate_success_rate(outcomes),
      avg_tokens: average(outcomes, "tokens_used"),
      avg_duration_minutes: average(outcomes, "time_minutes"),
      by_domain: group_by_domain(outcomes),
      by_agent: group_by_agent(outcomes),
      recent: Enum.take(outcomes, 10)
    }
  end

  def by_domain() do
    OutcomeTracker.all()
    |> Enum.group_by(& &1["domain"])
    |> Enum.map(fn {domain, entries} ->
      {domain,
       %{
         count: length(entries),
         success_rate: calculate_success_rate(entries),
         avg_tokens: average(entries, "tokens_used"),
         avg_minutes: average(entries, "time_minutes")
       }}
    end)
    |> Map.new()
  end

  defp calculate_success_rate([]), do: 0.0

  defp calculate_success_rate(entries) do
    success = Enum.count(entries, &(&1["status"] == "success"))
    Float.round(success / length(entries) * 100, 1)
  end

  defp average([], _field), do: 0

  defp average(entries, field) do
    values = entries |> Enum.map(& &1[field]) |> Enum.reject(&is_nil/1)
    if values == [], do: 0, else: Enum.sum(values) / length(values)
  end

  defp group_by_domain(entries) do
    entries
    |> Enum.group_by(& &1["domain"])
    |> Map.new(fn {k, v} -> {k, length(v)} end)
  end

  defp group_by_agent(entries) do
    entries
    |> Enum.group_by(& &1["agent"])
    |> Map.new(fn {k, v} -> {k, length(v)} end)
  end
end
