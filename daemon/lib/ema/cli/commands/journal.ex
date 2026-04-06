defmodule Ema.CLI.Commands.Journal do
  @moduledoc "CLI commands for daily journal."

  alias Ema.CLI.{Helpers, Output}

  def handle([:read], parsed, transport, opts) do
    date = parsed.options[:date] || Date.to_string(Date.utc_today())

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Journal, :get_entry, [date]) do
          {:ok, nil} ->
            Output.info("No entry for #{date}")

          {:ok, entry} ->
            if opts[:json] do
              Output.json(entry)
            else
              IO.puts("# #{date}")
              if entry.mood, do: IO.puts("Mood: #{entry.mood}")
              if entry.energy, do: IO.puts("Energy: #{entry.energy}")
              if entry.one_thing, do: IO.puts("One Thing: #{entry.one_thing}")
              IO.puts("")
              IO.puts(entry.content || "(empty)")
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/journal/#{date}") do
          {:ok, body} ->
            entry = Helpers.extract_record(body, "entry")

            if opts[:json] do
              Output.json(entry)
            else
              IO.puts("# #{date}")
              if entry["mood"], do: IO.puts("Mood: #{entry["mood"]}")
              if entry["energy"], do: IO.puts("Energy: #{entry["energy"]}")
              if entry["one_thing"], do: IO.puts("One Thing: #{entry["one_thing"]}")
              IO.puts("")
              IO.puts(entry["content"] || "(empty)")
            end

          {:error, :not_found} ->
            Output.info("No entry for #{date}")

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:write], parsed, transport, opts) do
    date = parsed.options[:date] || Date.to_string(Date.utc_today())
    content = parsed.args.content

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = Helpers.compact_map([
          {:content, content},
          {:mood, parsed.options[:mood]},
          {:energy, parsed.options[:energy]},
          {:one_thing, parsed.options[:one_thing]}
        ])

        case transport.call(Ema.Journal, :update_entry, [date, attrs]) do
          {:ok, entry} ->
            Output.success("Journal entry for #{date} saved")
            if opts[:json], do: Output.json(entry)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"entry" => Helpers.compact_map([
          {"content", content},
          {"mood", parsed.options[:mood]},
          {"energy", parsed.options[:energy]},
          {"one_thing", parsed.options[:one_thing]}
        ])}

        case transport.put("/journal/#{date}", body) do
          {:ok, _} -> Output.success("Journal entry for #{date} saved")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:search], parsed, transport, opts) do
    query = parsed.args.query

    search_cols = [
      {"Date", :date},
      {"Mood", :mood},
      {"One Thing", :one_thing},
      {"Content", :content}
    ]

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Journal, :search, [query]) do
          {:ok, entries} -> Output.render(entries, search_cols, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/journal/search", params: [q: query]) do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "entries"), search_cols, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:list], _parsed, transport, opts) do
    list_cols = [
      {"Date", :date},
      {"Mood", :mood},
      {"Energy", :energy},
      {"One Thing", :one_thing}
    ]

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Journal, :list_entries, [30]) do
          {:ok, entries} -> Output.render(entries, list_cols, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        # No list endpoint in router, use search with empty query
        case transport.get("/journal/search", params: [q: ""]) do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "entries"), list_cols, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown journal subcommand: #{inspect(sub)}")
  end
end
