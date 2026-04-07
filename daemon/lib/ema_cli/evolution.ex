defmodule EmaCli.Evolution do
  @moduledoc "CLI commands for self-modifying evolution rules"

  import EmaCli.CLI,
    only: [api_get: 1, api_post: 2, format_output: 2, error: 1, warn: 1, success: 1]

  def run("rules", opts) do
    status = Map.get(opts, :status)
    params = if status, do: "?status=#{status}", else: ""

    case api_get("/evolution/rules#{params}") do
      {:ok, %{"rules" => rules}} -> format_output(rules, opts)
      {:ok, rules} when is_list(rules) -> format_output(rules, opts)
      {:error, msg} -> error(msg)
    end
  end

  def run("signals", opts) do
    case api_get("/evolution/signals") do
      {:ok, %{"signals" => signals}} -> format_output(signals, opts)
      {:ok, signals} when is_list(signals) -> format_output(signals, opts)
      {:error, _} -> warn("Evolution signals not available")
    end
  end

  def run("stats", _opts) do
    case api_get("/evolution/stats") do
      {:ok, stats} when is_map(stats) ->
        IO.puts("\n\e[1mEvolution Stats\e[0m")
        IO.puts("  Rules:    #{stats["total_rules"] || stats["rule_count"] || 0}")
        IO.puts("  Active:   #{stats["active_rules"] || stats["active_count"] || 0}")
        IO.puts("  Signals:  #{stats["total_signals"] || stats["signal_count"] || 0}")
        IO.puts("  Version:  #{stats["current_version"] || "n/a"}")

      {:error, _} ->
        warn("Evolution stats not available")
    end
  end

  def run("scan", _opts) do
    IO.puts("Scanning for evolution signals...")

    case api_post("/evolution/scan", %{}) do
      {:ok, result} ->
        count = result["signals_found"] || result["count"] || 0
        success("Scan complete: #{count} signal(s) found")

      {:error, msg} ->
        error(msg)
    end
  end

  def run("propose", _opts) do
    IO.puts("Proposing evolution rules...")

    case api_post("/evolution/propose", %{}) do
      {:ok, result} ->
        count = result["proposals_created"] || result["count"] || 0
        success("Proposed #{count} new rule(s)")

      {:error, msg} ->
        error(msg)
    end
  end

  def run("activate", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema evolution activate <id>")

    case api_post("/evolution/rules/#{id}/activate", %{}) do
      {:ok, _} -> success("Rule #{id} activated")
      {:error, msg} -> error(msg)
    end
  end

  def run("rollback", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema evolution rollback <id>")

    case api_post("/evolution/rules/#{id}/rollback", %{}) do
      {:ok, _} -> success("Rule #{id} rolled back")
      {:error, msg} -> error(msg)
    end
  end

  def run(unknown, _),
    do:
      error(
        "Unknown evolution subcommand: #{unknown}. Try: rules, signals, stats, scan, propose, activate, rollback"
      )
end
