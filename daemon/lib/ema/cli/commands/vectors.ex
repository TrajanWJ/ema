defmodule Ema.CLI.Commands.Vectors do
  @moduledoc "CLI commands for vector index."

  alias Ema.CLI.Output

  def handle([:status], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/vectors/status") do
      {:ok, body} ->
        if opts[:json], do: Output.json(body), else: Output.detail(body)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:reindex], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.post("/vectors/reindex") do
      {:ok, resp} ->
        Output.success("Reindex started")
        if opts[:json], do: Output.json(resp)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:query], parsed, _transport, opts) do
    params = [q: parsed.args.query, limit: parsed.options[:limit] || 10]

    case Ema.CLI.Transport.Http.get("/vectors/query", params: params) do
      {:ok, body} ->
        if opts[:json], do: Output.json(body), else: Output.detail(body)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown vectors subcommand: #{inspect(sub)}")
  end
end
