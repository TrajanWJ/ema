defmodule Ema.CLI.Commands.Tokens do
  @moduledoc "CLI commands for token usage, budget, and cost governor."

  alias Ema.CLI.Output

  def handle([:summary], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/orchestration/stats") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:budget, :set], parsed, _transport, _opts) do
    amount_str = parsed.args[:amount] || ""

    case Float.parse(amount_str) do
      {amount, _} when amount > 0 ->
        :ok = Ema.Intelligence.CostGovernor.set_budget(amount)
        Output.success("Daily budget set to $#{format_usd(amount)}")

      _ ->
        Output.error("Invalid amount: #{amount_str}. Must be a positive number.")
    end
  end

  def handle([:budget], _parsed, _transport, opts) do
    status = Ema.Intelligence.CostGovernor.status()

    if opts[:json] do
      Output.json(status)
    else
      lines = [
        "",
        "  Cost Governor Status",
        "  ────────────────────────────────────",
        "  Daily Budget:    $#{format_usd(status.daily_budget)}",
        "  Daily Spend:     $#{format_usd(status.daily_spend)}",
        "  Remaining:       $#{format_usd(status.budget_remaining)}",
        "  Used:            #{status.percent_used}%",
        "  Current Tier:    #{status.current_tier} — #{status.tier_label}",
        "",
        "  Weekly Spend:    $#{format_usd(status.weekly_spend)}",
        "  Monthly Spend:   $#{format_usd(status.monthly_spend)}",
        ""
      ]

      lines =
        if map_size(status.by_domain) > 0 do
          domain_lines =
            status.by_domain
            |> Enum.sort_by(fn {_k, v} -> v end, :desc)
            |> Enum.map(fn {domain, cost} ->
              "    #{String.pad_trailing(to_string(domain), 20)} $#{format_usd(cost)}"
            end)

          lines ++ ["  By Domain:"] ++ domain_lines ++ [""]
        else
          lines
        end

      IO.puts(Enum.join(lines, "\n"))
    end
  rescue
    e -> Output.error("CostGovernor not available: #{inspect(e)}")
  end

  def handle([:history], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/orchestration/stats") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:fitness], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/orchestration/fitness") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown tokens subcommand: #{inspect(sub)}")
  end

  defp format_usd(amount) when is_float(amount) do
    :erlang.float_to_binary(amount, decimals: 2)
  end

  defp format_usd(amount) when is_integer(amount), do: "#{amount}.00"
  defp format_usd(_), do: "0.00"
end
