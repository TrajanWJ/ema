defmodule Ema.CLI.Commands.Ralph do
  @moduledoc "CLI commands for Ralph optimization loop."

  alias Ema.CLI.{Helpers, Output}

  def handle([:status], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/ralph/status") do
      {:ok, body} ->
        if opts[:json], do: Output.json(body), else: Output.detail(body)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:run], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.post("/ralph/run") do
      {:ok, resp} ->
        Output.success("Ralph cycle started")
        if opts[:json], do: Output.json(resp)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:configure], parsed, _transport, _opts) do
    body =
      Helpers.compact_map([
        {"interval", parsed.options[:interval]},
        {"enabled", parsed.options[:enabled]}
      ])

    case Ema.CLI.Transport.Http.post("/ralph/configure", body) do
      {:ok, _} -> Output.success("Ralph configured")
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:surface], parsed, _transport, opts) do
    id = parsed.args.id

    case Ema.CLI.Transport.Http.post("/ralph/surface/#{id}") do
      {:ok, resp} ->
        Output.success("Surfaced #{id}")
        if opts[:json], do: Output.json(resp)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown ralph subcommand: #{inspect(sub)}")
  end
end
