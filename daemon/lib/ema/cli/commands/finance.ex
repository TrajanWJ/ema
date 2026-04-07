defmodule Ema.CLI.Commands.Finance do
  @moduledoc "CLI commands for finance tracking."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Type", :type},
    {"Amount", :amount},
    {"Category", :category},
    {"Date", :date},
    {"Updated", :updated_at}
  ]

  def handle([:summary], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Finance, :summary, []) do
          {:ok, summary} -> Output.detail(summary, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/finance/summary") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Finance, :list_entries, []) do
          {:ok, entries} -> Output.render(entries, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/finance") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "entries"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Finance, :get_entry, [id]) do
          {:ok, nil} -> Output.error("Finance entry #{id} not found")
          {:ok, entry} -> Output.detail(entry, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/finance/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "entry"), json: opts[:json])
          {:error, :not_found} -> Output.error("Finance entry #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:type, parsed.options[:type]},
            {:amount, parsed.args.amount},
            {:category, parsed.options[:category]},
            {:description, parsed.options[:description]},
            {:date, parsed.options[:date]}
          ])

        case transport.call(Ema.Finance, :create_entry, [attrs]) do
          {:ok, entry} ->
            Output.success("Created finance entry: #{entry.id}")
            if opts[:json], do: Output.json(entry)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "entry" =>
            Helpers.compact_map([
              {"type", parsed.options[:type]},
              {"amount", parsed.args.amount},
              {"category", parsed.options[:category]},
              {"description", parsed.options[:description]},
              {"date", parsed.options[:date]}
            ])
        }

        case transport.post("/finance", body) do
          {:ok, resp} ->
            e = Helpers.extract_record(resp, "entry")
            Output.success("Created finance entry: #{e["id"]}")
            if opts[:json], do: Output.json(e)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:update], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:type, parsed.options[:type]},
            {:amount, parsed.options[:amount]},
            {:category, parsed.options[:category]},
            {:description, parsed.options[:description]},
            {:date, parsed.options[:date]}
          ])

        case transport.call(Ema.Finance, :update_entry, [id, attrs]) do
          {:ok, entry} ->
            Output.success("Updated finance entry: #{entry.id}")
            if opts[:json], do: Output.json(entry)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "entry" =>
            Helpers.compact_map([
              {"type", parsed.options[:type]},
              {"amount", parsed.options[:amount]},
              {"category", parsed.options[:category]},
              {"description", parsed.options[:description]},
              {"date", parsed.options[:date]}
            ])
        }

        case transport.put("/finance/#{id}", body) do
          {:ok, resp} ->
            e = Helpers.extract_record(resp, "entry")
            Output.success("Updated finance entry: #{e["id"]}")
            if opts[:json], do: Output.json(e)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Finance, :delete_entry, [id]) do
          {:ok, _} -> Output.success("Deleted finance entry #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/finance/#{id}") do
          {:ok, _} -> Output.success("Deleted finance entry #{id}")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown finance subcommand: #{inspect(sub)}")
  end
end
