defmodule Ema.CLI.Commands.Clipboard do
  @moduledoc "CLI commands for clipboard management — list, create, delete, pin."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Content", :content},
    {"Pinned", :pinned},
    {"Created", :inserted_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Clipboard, :list_items, []) do
          {:ok, items} -> Output.render(items, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/clipboard") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "items"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    content = parsed.args.content

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = Helpers.compact_map([{:content, content}])

        case transport.call(Ema.Clipboard, :create_item, [attrs]) do
          {:ok, item} ->
            Output.success("Clipboard item created: #{item.id}")
            if opts[:json], do: Output.json(item)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"item" => Helpers.compact_map([{"content", content}])}

        case transport.post("/clipboard", body) do
          {:ok, resp} ->
            i = Helpers.extract_record(resp, "item")
            Output.success("Clipboard item created: #{i["id"]}")
            if opts[:json], do: Output.json(i)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Clipboard, :delete_item, [id]) do
          {:ok, _} -> Output.success("Deleted clipboard item #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/clipboard/#{id}") do
          {:ok, _} -> Output.success("Deleted clipboard item #{id}")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:pin], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Clipboard, :pin_item, [id]) do
          {:ok, _} -> Output.success("Pinned clipboard item #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/clipboard/#{id}/pin", %{}) do
          {:ok, _} -> Output.success("Pinned clipboard item #{id}")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown clipboard subcommand: #{inspect(sub)}")
  end
end
