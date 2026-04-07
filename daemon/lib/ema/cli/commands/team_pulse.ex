defmodule Ema.CLI.Commands.TeamPulse do
  @moduledoc "CLI commands for team pulse."

  alias Ema.CLI.Output

  def handle([:overview], _parsed, transport, opts) do
    case transport.get("/team-pulse") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:agents], _parsed, transport, opts) do
    case transport.get("/team-pulse/agents") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:velocity], _parsed, transport, opts) do
    case transport.get("/team-pulse/velocity") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown team-pulse subcommand: #{inspect(sub)}")
  end
end
