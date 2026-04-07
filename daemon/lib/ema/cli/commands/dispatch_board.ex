defmodule Ema.CLI.Commands.DispatchBoard do
  @moduledoc "CLI commands for dispatch board."

  alias Ema.CLI.{Helpers, Output}

  def handle([:index], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/dispatch-board") do
      {:ok, body} ->
        items = Helpers.extract_list(body, "items")

        cols = [
          {"ID", :id},
          {"Title", :title},
          {"Status", :status},
          {"Agent", :agent},
          {"Updated", :updated_at}
        ]

        Output.render(items, cols, json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:stats], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/dispatch-board/stats") do
      {:ok, body} ->
        if opts[:json], do: Output.json(body), else: Output.detail(body)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown dispatch-board subcommand: #{inspect(sub)}")
  end
end
