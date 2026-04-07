defmodule Ema.CLI.Commands.Metamind do
  @moduledoc "CLI commands for metamind prompt library."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Category", :category},
    {"Updated", :updated_at}
  ]

  def handle([:pipeline], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/metamind/pipeline") do
      {:ok, body} ->
        if opts[:json], do: Output.json(body), else: Output.detail(body)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:library], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/metamind/library") do
      {:ok, body} ->
        Output.render(Helpers.extract_list(body, "prompts"), @columns, json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:save], parsed, _transport, opts) do
    body =
      Helpers.compact_map([
        {"name", parsed.args.name},
        {"content", parsed.options[:content]},
        {"category", parsed.options[:category]}
      ])

    case Ema.CLI.Transport.Http.post("/metamind/library", body) do
      {:ok, resp} ->
        Output.success("Saved prompt: #{parsed.args.name}")
        if opts[:json], do: Output.json(resp)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:delete], parsed, _transport, _opts) do
    id = parsed.args.id

    case Ema.CLI.Transport.Http.delete("/metamind/library/#{id}") do
      {:ok, _} -> Output.success("Deleted prompt #{id}")
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown metamind subcommand: #{inspect(sub)}")
  end
end
