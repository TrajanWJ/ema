defmodule Ema.CLI.Commands.Canvas do
  @moduledoc "CLI commands for canvas management."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Template", :template},
    {"Updated", :updated_at}
  ]

  def handle([:list], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/canvases") do
      {:ok, body} ->
        Output.render(Helpers.extract_list(body, "canvases"), @columns, json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:show], parsed, _transport, opts) do
    id = parsed.args.id

    case Ema.CLI.Transport.Http.get("/canvases/#{id}") do
      {:ok, body} -> Output.detail(Helpers.extract_record(body, "canvas"), json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:templates], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/canvas/templates") do
      {:ok, body} ->
        Output.render(Helpers.extract_list(body, "templates"), @columns, json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:export], parsed, _transport, opts) do
    id = parsed.args.id

    case Ema.CLI.Transport.Http.get("/canvases/#{id}/export") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown canvas subcommand: #{inspect(sub)}")
  end
end
