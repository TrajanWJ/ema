defmodule Ema.Harvesters.UsageHarvester do
  @moduledoc """
  UsageHarvester — aggregates agent execution outcomes to surface patterns,
  success rates, and low-performing agent/mode combinations worth reviewing.

  Reads from the OutcomeTracker JSON file and creates proposal seeds when
  any agent/mode combination falls below a 70% success rate.
  """

  use Ema.Harvesters.Base, name: "usage", interval: :timer.hours(6)

  alias Ema.Proposals

  require Logger

  @tracker_path Path.expand("~/.local/share/ema/outcome-tracker.json")
  @low_success_threshold 0.7
  @min_executions_for_alert 5

  @impl Ema.Harvesters.Base
  def harvester_name, do: "usage"

  @impl Ema.Harvesters.Base
  def default_interval, do: :timer.hours(6)

  @impl Ema.Harvesters.Base
  def harvest(_context) do
    outcomes = read_outcomes()

    if outcomes == [] do
      Logger.debug("[UsageHarvester] No outcome data found at #{@tracker_path}")
      {:ok, %{items_found: 0, seeds_created: 0, metadata: %{note: "no outcome data"}}}
    else
      stats = aggregate_stats(outcomes)
      seeds_created = create_low_success_proposals(stats.by_agent_mode)

      {:ok,
       %{
         items_found: length(outcomes),
         seeds_created: seeds_created,
         metadata: %{
           total_executions: stats.total_executions,
           overall_success_rate: stats.overall_success_rate,
           avg_duration_minutes: stats.avg_duration_minutes,
           most_active_project: stats.most_active_project,
           most_used_mode: stats.most_used_mode,
           most_common_failure_reason: stats.most_common_failure_reason,
           agent_mode_combos_analyzed: map_size(stats.by_agent_mode),
           low_success_combos: stats.low_success_combos
         }
       }}
    end
  rescue
    e ->
      Logger.warning("[UsageHarvester] Error during harvest: #{inspect(e)}")
      {:error, Exception.message(e)}
  end

  # ── Aggregation ──────────────────────────────────────────────────────────────

  defp aggregate_stats(outcomes) do
    total = length(outcomes)

    successes = Enum.count(outcomes, &success?/1)
    overall_rate = if total > 0, do: Float.round(successes / total, 3), else: 0.0

    durations =
      outcomes
      |> Enum.map(&Map.get(&1, "time_minutes"))
      |> Enum.reject(&is_nil/1)
      |> Enum.reject(&(not is_number(&1)))

    avg_duration =
      case durations do
        [] -> nil
        ds -> Float.round(Enum.sum(ds) / length(ds), 2)
      end

    most_active_project = top_by_frequency(outcomes, "project")
    most_used_mode = top_by_frequency(outcomes, "mode")
    most_common_failure_reason = top_failure_reason(outcomes)

    by_agent_mode = group_by_agent_mode(outcomes)

    low_success_combos =
      by_agent_mode
      |> Enum.filter(fn {_key, data} ->
        data.count >= @min_executions_for_alert and
          data.success_rate < @low_success_threshold
      end)
      |> Enum.map(fn {{agent, mode}, data} ->
        %{agent: agent, mode: mode, success_rate: data.success_rate, count: data.count}
      end)

    %{
      total_executions: total,
      overall_success_rate: overall_rate,
      avg_duration_minutes: avg_duration,
      most_active_project: most_active_project,
      most_used_mode: most_used_mode,
      most_common_failure_reason: most_common_failure_reason,
      by_agent_mode: by_agent_mode,
      low_success_combos: length(low_success_combos)
    }
  end

  defp group_by_agent_mode(outcomes) do
    outcomes
    |> Enum.group_by(fn entry ->
      agent = Map.get(entry, "agent") || "unknown"
      mode = Map.get(entry, "mode") || Map.get(entry, "domain") || "unknown"
      {agent, mode}
    end)
    |> Enum.map(fn {{agent, mode} = key, entries} ->
      count = length(entries)
      success_count = Enum.count(entries, &success?/1)
      rate = if count > 0, do: Float.round(success_count / count, 3), else: 0.0

      durations =
        entries
        |> Enum.map(&Map.get(&1, "time_minutes"))
        |> Enum.reject(&is_nil/1)
        |> Enum.reject(&(not is_number(&1)))

      avg_dur =
        case durations do
          [] -> nil
          ds -> Float.round(Enum.sum(ds) / length(ds), 2)
        end

      {key,
       %{
         count: count,
         success_count: success_count,
         success_rate: rate,
         avg_duration_minutes: avg_dur,
         agent: agent,
         mode: mode
       }}
    end)
    |> Map.new()
  end

  defp success?(%{"status" => status}) when is_binary(status) do
    String.downcase(status) in ["completed", "success", "done", "ok"]
  end

  defp success?(_), do: false

  defp top_by_frequency(outcomes, field) do
    outcomes
    |> Enum.map(&Map.get(&1, field))
    |> Enum.reject(&is_nil/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.frequencies()
    |> Enum.max_by(fn {_k, v} -> v end, fn -> {nil, 0} end)
    |> elem(0)
  end

  defp top_failure_reason(outcomes) do
    outcomes
    |> Enum.reject(&success?/1)
    |> Enum.map(fn entry ->
      Map.get(entry, "failure_reason") ||
        Map.get(entry, "error") ||
        Map.get(entry, "status")
    end)
    |> Enum.reject(&is_nil/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.frequencies()
    |> Enum.max_by(fn {_k, v} -> v end, fn -> {nil, 0} end)
    |> elem(0)
  end

  # ── Proposal Seeds ───────────────────────────────────────────────────────────

  defp create_low_success_proposals(by_agent_mode) do
    by_agent_mode
    |> Enum.filter(fn {_key, data} ->
      data.count >= @min_executions_for_alert and
        data.success_rate < @low_success_threshold
    end)
    |> Enum.reduce(0, fn {{agent, mode}, data}, acc ->
      case create_low_success_seed(agent, mode, data) do
        {:ok, _} ->
          acc + 1

        {:error, reason} ->
          Logger.warning(
            "[UsageHarvester] Failed to create seed for #{agent}/#{mode}: #{inspect(reason)}"
          )

          acc
      end
    end)
  end

  defp create_low_success_seed(agent, mode, data) do
    pct = Float.round(data.success_rate * 100, 1)

    Proposals.create_seed(%{
      name: "Low success rate for #{agent}/#{mode} — review prompts",
      seed_type: "usage",
      prompt_template: """
      Agent "#{agent}" operating in mode "#{mode}" has a low success rate of #{pct}% across #{data.count} executions.

      This is below the #{round(@low_success_threshold * 100)}% threshold warranting review.

      Propose specific improvements to the prompts, context, or workflow for this agent/mode combination.
      Consider: common failure patterns, missing context, prompt clarity, and tooling gaps.
      """,
      schedule: "every_8h",
      active: true,
      metadata: %{
        source: "usage_harvester",
        agent: agent,
        mode: mode,
        success_rate: data.success_rate,
        execution_count: data.count,
        avg_duration_minutes: data.avg_duration_minutes
      }
    })
  end

  # ── I/O ──────────────────────────────────────────────────────────────────────

  defp read_outcomes do
    path =
      Application.get_env(
        :ema,
        :ema_tracker_path,
        @tracker_path
      )

    case File.read(path) do
      {:ok, content} ->
        case Jason.decode(content) do
          {:ok, list} when is_list(list) ->
            Logger.debug("[UsageHarvester] Loaded #{length(list)} outcomes from #{path}")
            list

          {:ok, _} ->
            Logger.warning("[UsageHarvester] Unexpected non-list JSON at #{path}")
            []

          {:error, reason} ->
            Logger.warning("[UsageHarvester] Failed to parse #{path}: #{inspect(reason)}")
            []
        end

      {:error, :enoent} ->
        Logger.debug("[UsageHarvester] Tracker file not found: #{path}")
        []

      {:error, reason} ->
        Logger.warning("[UsageHarvester] Failed to read #{path}: #{inspect(reason)}")
        []
    end
  end
end
