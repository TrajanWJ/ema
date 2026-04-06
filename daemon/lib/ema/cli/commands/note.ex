defmodule Ema.CLI.Commands.Note do
  @moduledoc "CLI commands for simple notes."

  alias Ema.CLI.{Helpers, Output}

  @columns [{"ID", :id}, {"Title", :title}, {"Updated", :updated_at}]

  def handle([:list], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/notes") do
      {:ok, body} -> Output.render(Helpers.extract_list(body, "notes"), @columns, json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:show], parsed, _transport, opts) do
    id = parsed.args.id

    case Ema.CLI.Transport.Http.get("/notes/#{id}") do
      {:ok, body} -> Output.detail(Helpers.extract_record(body, "note"), json: opts[:json])
      {:error, :not_found} -> Output.error("Note #{id} not found")
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:create], parsed, _transport, opts) do
    body = %{"note" => Helpers.compact_map([
      {"title", parsed.args.title},
      {"content", parsed.options[:content]}
    ])}

    case Ema.CLI.Transport.Http.post("/notes", body) do
      {:ok, resp} ->
        n = Helpers.extract_record(resp, "note")
        Output.success("Created note: #{n["title"]}")
        if opts[:json], do: Output.json(n)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:delete], parsed, _transport, _opts) do
    case Ema.CLI.Transport.Http.delete("/notes/#{parsed.args.id}") do
      {:ok, _} -> Output.success("Deleted note #{parsed.args.id}")
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown note subcommand: #{inspect(sub)}")
  end
end
