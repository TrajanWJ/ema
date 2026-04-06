defmodule Ema.CLI.Commands.Tokens do
  @moduledoc "CLI commands for token usage and budget."

  alias Ema.CLI.Output

  def handle([:summary], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/orchestration/stats") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:budget], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/quality/budget") do
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
end
