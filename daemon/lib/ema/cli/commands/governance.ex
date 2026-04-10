defmodule Ema.CLI.Commands.Governance do
  @moduledoc "CLI commands for governance metrics — sycophancy harness."

  alias Ema.CLI.{Helpers, Output}

  def handle([:sycophancy], parsed, transport, opts) do
    lookback = parsed.options[:lookback] || 30

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Governance.Sycophancy, :compute_pi, [lookback]) do
          {:ok, result} -> render(result, opts)
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/governance/sycophancy", params: [lookback_days: lookback]) do
          {:ok, body} ->
            render(Helpers.extract_record(body, "sycophancy"), opts)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:audit], parsed, transport, opts) do
    lookback = parsed.options[:lookback] || 30

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Governance.Sycophancy, :audit_and_alert, [lookback]) do
          {:ok, result} ->
            Output.success("Sycophancy audit complete (verdict: #{result.verdict})")
            render(result, opts)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/governance/sycophancy/audit", %{lookback_days: lookback}) do
          {:ok, body} ->
            Output.success("Sycophancy audit broadcast")
            render(body, opts)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown governance subcommand: #{inspect(sub)}")
  end

  defp render(result, opts) when is_map(result) do
    if opts[:json] do
      Output.json(result)
    else
      pi = format_pi(get(result, :pi))
      verdict = get(result, :verdict)
      total = get(result, :total)
      approved = get(result, :approved)
      modified = get(result, :modified)
      rejected = get(result, :rejected)
      lookback = get(result, :lookback_days)

      IO.puts("")
      IO.puts("  Sycophancy Index (#{lookback}-day window)")
      IO.puts("  ──────────────────────────────────────────")
      IO.puts("  pi:        #{pi}")
      IO.puts("  verdict:   #{verdict}  #{verdict_emoji(verdict)}")
      IO.puts("  approved:  #{approved}")
      IO.puts("  modified:  #{modified}")
      IO.puts("  rejected:  #{rejected}")
      IO.puts("  total:     #{total}")
      IO.puts("")

      if to_string(verdict) in ["alert", "watch"] do
        IO.puts("  ⚠  Decision rubber-stamping is high. Bring in dissent.")
      end
    end
  end

  defp get(map, key) when is_atom(key) do
    Map.get(map, key) || Map.get(map, Atom.to_string(key))
  end

  defp format_pi(nil), do: "—"
  defp format_pi(n) when is_number(n), do: :erlang.float_to_binary(n * 1.0, decimals: 3)
  defp format_pi(other), do: to_string(other)

  defp verdict_emoji("alert"), do: "[ALERT]"
  defp verdict_emoji(:alert), do: "[ALERT]"
  defp verdict_emoji("watch"), do: "[WATCH]"
  defp verdict_emoji(:watch), do: "[WATCH]"
  defp verdict_emoji("healthy"), do: "[OK]"
  defp verdict_emoji(:healthy), do: "[OK]"
  defp verdict_emoji(_), do: ""
end
