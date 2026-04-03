defmodule EmaCli.Routing do
  @moduledoc "CLI commands for Orchestration & Routing"

  import EmaCli.CLI, only: [api_get: 1, api_post: 2, error: 1, warn: 1]

  def run("status", _opts) do
    case api_get("/orchestration/stats") do
      {:ok, stats} ->
        IO.puts("\n\e[1mRouting Engine\e[0m")
        IO.puts("  Total routed: #{stats["total_routed"] || 0}")

        Enum.each(stats["strategy_counts"] || %{}, fn {s, c} ->
          IO.puts("  #{String.pad_trailing(to_string(s), 15)} #{c}")
        end)

        IO.puts("\n\e[1mRecent Decisions\e[0m")

        (stats["routing_history"] || [])
        |> Enum.take(5)
        |> Enum.each(fn d ->
          IO.puts("  -> \e[36m#{d["task_type"]}\e[0m -> #{d["selected_agent"]} (#{d["strategy"]})")
          IO.puts("     #{d["reason"]}")
        end)

      {:error, _} ->
        warn("Routing engine not available -- F5 may not be deployed")
    end
  end

  def run("fitness", _opts) do
    case api_get("/orchestration/fitness") do
      {:ok, scores} when is_list(scores) ->
        IO.puts("\n\e[1mAgent Fitness Scores\e[0m")

        scores
        |> Enum.sort_by(fn s -> -(get_in(s, ["fitness", "composite_score"]) || 0) end)
        |> Enum.each(fn %{"agent_id" => id, "fitness" => f} ->
          cs = Float.round((f["composite_score"] || 0.5) * 100, 1)
          sr = Float.round((f["success_rate"] || 0.5) * 100, 1)
          lat = round(f["avg_latency_ms"] || 5000)
          runs = f["total_runs"] || 0

          IO.puts(
            "  #{String.pad_trailing(to_string(id), 24)} score=\e[1m#{cs}%\e[0m  sr=#{sr}%  lat=#{lat}ms  runs=#{runs}"
          )
        end)

      {:error, _} ->
        warn("Fitness data not available")
    end
  end

  def run("dispatch", opts) do
    task_type = Map.get(opts, :_arg) || error("Usage: ema routing dispatch <task-type>")
    strategy = Map.get(opts, :strategy, "best_fit")

    case api_post("/orchestration/route", %{type: task_type, strategy: strategy}) do
      {:ok, result} ->
        IO.puts("\n\e[1mRouting Result\e[0m")
        IO.puts("  Agent:    #{result["agent_id"] || "none"}")
        IO.puts("  Strategy: #{strategy}")
        IO.puts("  Score:    #{result["score"] || 0}")
        IO.puts("  Reason:   #{result["reason"] || "n/a"}")

      {:error, _} ->
        warn("Routing not available")
    end
  end

  def run(unknown, _),
    do: error("Unknown routing subcommand: #{unknown}. Try: status, fitness, dispatch")
end
