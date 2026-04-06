defmodule Ema.CLI.Commands.Metrics do
  @moduledoc "CLI commands for metrics."

  alias Ema.CLI.Output

  def handle([:summary], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/metrics/summary") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:by_domain], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/metrics/by_domain") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown metrics subcommand: #{inspect(sub)}")
  end
end
