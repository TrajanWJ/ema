defmodule Ema.CLI.Commands.Routing do
  @moduledoc "CLI commands for intent routing."

  alias Ema.CLI.{Helpers, Output}

  def handle([:classify], parsed, _transport, opts) do
    body = Helpers.compact_map([{"text", parsed.args.text}, {"project_slug", parsed.options[:project]}])

    case Ema.CLI.Transport.Http.post("/routing/classify", body) do
      {:ok, resp} -> if opts[:json], do: Output.json(resp), else: Output.detail(resp)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:stats], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/routing/stats") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown routing subcommand: #{inspect(sub)}")
  end
end
