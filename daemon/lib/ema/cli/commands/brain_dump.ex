defmodule Ema.CLI.Commands.BrainDump do
  @moduledoc "CLI commands for brain dump inbox management."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Content", :content},
    {"Source", :source},
    {"Processed", :processed_at},
    {"Created", :inserted_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.BrainDump, :list_items, []) do
          {:ok, items} -> Output.render(items, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/brain-dump/items") do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "items"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:unprocessed], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.BrainDump, :list_unprocessed, []) do
          {:ok, items} -> Output.render(items, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/brain-dump/items", params: [unprocessed: true]) do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "items"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    content = parsed.args.content

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = %{content: content, source: "text"}

        case transport.call(Ema.BrainDump, :create_item, [attrs]) do
          {:ok, item} ->
            Output.success("Captured: #{String.slice(content, 0, 60)}")
            if opts[:json], do: Output.json(item)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/brain-dump/items", %{"content" => content, "source" => "text"}) do
          {:ok, resp} ->
            Output.success("Captured: #{String.slice(content, 0, 60)}")
            if opts[:json], do: Output.json(Helpers.extract_record(resp, "item"))

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:process], parsed, transport, opts) do
    id = parsed.args.id
    action = parsed.options[:action] || "archive"

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.BrainDump, :process_item, [id, action]) do
          {:ok, item} ->
            Output.success("Processed item #{item.id} → #{action}")
            if opts[:json], do: Output.json(item)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/brain-dump/items/#{id}/process", %{"action" => action}) do
          {:ok, _} -> Output.success("Processed item #{id} → #{action}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.BrainDump, :delete_item, [id]) do
          {:ok, _} -> Output.success("Deleted item #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/brain-dump/items/#{id}") do
          {:ok, _} -> Output.success("Deleted item #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown brain-dump subcommand: #{inspect(sub)}")
  end
end
