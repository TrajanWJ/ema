defmodule EmaCli.Quality do
  @moduledoc "CLI commands for Quality & Improvement Loop"

  import EmaCli.CLI,
    only: [api_get: 1, format_output: 2, error: 1, warn: 1]

  def run("report", opts) do
    days = Map.get(opts, :days, "7")
    IO.puts("\n\e[1mEMA Quality Report -- last #{days} days\e[0m")
    IO.puts(String.duplicate("=", 50))

    section("Friction", fn ->
      case api_get("/quality/friction") do
        {:ok, r} ->
          l = r["friction_level"] || "unknown"
          s = r["friction_score"] || 0
          IO.puts("  Level: #{badge(l)}  Score: #{Float.round(s * 1.0, 2)}")

          if sig = r["signals"] do
            IO.puts("  Blocked: #{get_in(sig, ["blocked_clusters", "count"]) || 0}")
            IO.puts("  Overdue: #{get_in(sig, ["overdue_accumulation", "overdue_count"]) || 0}")
            IO.puts("  Dump spike: #{get_in(sig, ["brain_dump_spike", "spiking"]) || false}")
          end

        {:error, _} ->
          IO.puts("  \e[2mnot available\e[0m")
      end
    end)

    section("Quality Gradient", fn ->
      case api_get("/quality/gradient?days=#{days}") do
        {:ok, g} ->
          IO.puts("  Trend: #{trend_badge(g["trend"])}")

          if cur = g["current"] do
            IO.puts("  Approval rate: #{pct(cur["approval_rate"])}")
            IO.puts("  Completion rate: #{pct(cur["completion_rate"])}")
          end

        {:error, _} ->
          IO.puts("  \e[2mnot available\e[0m")
      end
    end)

    section("Budget", fn ->
      case api_get("/quality/budget") do
        {:ok, b} ->
          tk = b["daily_tokens"] || 0
          tl = b["token_limit"] || 500_000
          cc = b["daily_cost_cents"] || 0
          cl = b["cost_limit_cents"] || 500
          IO.puts("  Tokens: #{tk}/#{tl} (#{pct(tk / max(tl, 1))})")
          IO.puts("  Cost:   $#{Float.round(cc / 100, 2)}/$#{Float.round(cl / 100, 2)}")

        {:error, _} ->
          IO.puts("  \e[2mnot available\e[0m")
      end
    end)

    section("Threats", fn ->
      case api_get("/quality/threats") do
        {:ok, r} ->
          IO.puts(
            "  Severity: #{sev_badge(r["severity"])}  Findings: #{r["total_findings"] || 0}"
          )

          Enum.each(r["findings"] || [], fn f ->
            IO.puts("  * [#{f["severity"]}] #{String.slice(f["message"] || "", 0, 60)}")
          end)

        {:error, _} ->
          IO.puts("  \e[2mnot available\e[0m")
      end
    end)
  end

  def run("friction", opts) do
    case api_get("/quality/friction") do
      {:ok, r} -> format_output([r], opts)
      {:error, _} -> warn("Friction not available")
    end
  end

  def run("gradient", opts) do
    days = Map.get(opts, :days, "7")

    case api_get("/quality/gradient?days=#{days}") do
      {:ok, g} -> format_output([g], opts)
      {:error, _} -> warn("Gradient not available")
    end
  end

  def run("budget", opts) do
    case api_get("/quality/budget") do
      {:ok, b} -> format_output([b], opts)
      {:error, _} -> warn("Budget not available")
    end
  end

  def run("threats", opts) do
    case api_get("/quality/threats") do
      {:ok, r} ->
        if Map.get(opts, :format) == "json" do
          IO.puts(Jason.encode!(r, pretty: true))
        else
          IO.puts("\n\e[1mThreat Report\e[0m -- #{r["checked_at"] || "unknown"}")

          IO.puts(
            "Severity: #{sev_badge(r["severity"])}  Findings: #{r["total_findings"] || 0}\n"
          )

          Enum.each(r["findings"] || [], fn f ->
            IO.puts("[#{String.upcase(f["severity"] || "low")}] #{f["type"]}")
            IO.puts("  #{f["message"]}")
            IO.puts("  -> #{f["action"]}\n")
          end)
        end

      {:error, _} ->
        warn("Threat data not available")
    end
  end

  def run(unknown, _),
    do:
      error(
        "Unknown quality subcommand: #{unknown}. Try: report, friction, gradient, budget, threats"
      )

  defp section(name, fun) do
    IO.puts("\n\e[1m#{name}\e[0m")
    fun.()
  end

  defp badge("high"), do: "\e[31mHIGH\e[0m"
  defp badge("medium"), do: "\e[33mMEDIUM\e[0m"
  defp badge("low"), do: "\e[32mLOW\e[0m"
  defp badge(l), do: l

  defp sev_badge("clean"), do: "\e[32mCLEAN\e[0m"
  defp sev_badge("high"), do: "\e[31mHIGH\e[0m"
  defp sev_badge("medium"), do: "\e[33mMEDIUM\e[0m"
  defp sev_badge(s), do: to_string(s)

  defp trend_badge("improving"), do: "\e[32m^ improving\e[0m"
  defp trend_badge("degrading"), do: "\e[31mv degrading\e[0m"
  defp trend_badge(_), do: "-> stable"

  defp pct(nil), do: "n/a"

  defp pct(v) when is_float(v) or is_integer(v),
    do: "#{Float.round(v * 1.0 * 100, 1)}%"
end
