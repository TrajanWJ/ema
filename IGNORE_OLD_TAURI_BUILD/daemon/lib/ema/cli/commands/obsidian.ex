defmodule Ema.CLI.Commands.Obsidian do
  @moduledoc "CLI commands for Obsidian vault integration — list, search, read, create notes."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"Path", :path},
    {"Title", :title},
    {"Tags", :tags},
    {"Updated", :updated_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Obsidian, :list_notes, []) do
          {:ok, notes} -> Output.render(notes, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/obsidian/notes") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "notes"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:search], parsed, transport, opts) do
    query = parsed.args.query

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Obsidian, :search, [query]) do
          {:ok, notes} -> Output.render(notes, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/obsidian/search", params: [q: query]) do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "notes"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:read], parsed, transport, opts) do
    path = parsed.args.path

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Obsidian, :read_note, [path]) do
          {:ok, note} ->
            if opts[:json] do
              Output.json(note)
            else
              IO.puts(Map.get(note, :content, "") || "")
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/obsidian/notes/#{path}") do
          {:ok, body} ->
            if opts[:json] do
              Output.json(body)
            else
              n = Helpers.extract_record(body, "note")
              IO.puts(n["content"] || "")
            end

          {:error, :not_found} ->
            Output.error("Note not found: #{path}")

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    path = parsed.args.path

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:path, path},
            {:content, parsed.options[:content]}
          ])

        case transport.call(Ema.Obsidian, :create_note, [attrs]) do
          {:ok, note} ->
            Output.success("Created note: #{note.path}")
            if opts[:json], do: Output.json(note)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "note" =>
            Helpers.compact_map([
              {"path", path},
              {"content", parsed.options[:content]}
            ])
        }

        case transport.post("/obsidian/notes", body) do
          {:ok, resp} ->
            n = Helpers.extract_record(resp, "note")
            Output.success("Created note: #{n["path"]}")
            if opts[:json], do: Output.json(n)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown obsidian subcommand: #{inspect(sub)}")
  end
end
