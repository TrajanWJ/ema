defmodule Ema.CLI.Commands.Space do
  @moduledoc "CLI commands for space management."

  alias Ema.CLI.Output

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Type", :space_type},
    {"Privacy", :ai_privacy},
    {"Updated", :updated_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Spaces, :list_spaces, []) do
          {:ok, spaces} -> Output.render(spaces, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/spaces") do
          {:ok, body} -> Output.render(body["spaces"] || [], @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Spaces, :get_space, [id]) do
          {:ok, nil} -> Output.error("Space #{id} not found")
          {:ok, space} -> Output.detail(space, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/spaces/#{id}") do
          {:ok, body} -> Output.detail(body["space"] || body, json: opts[:json])
          {:error, :not_found} -> Output.error("Space #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    name = parsed.args.name

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = %{name: name}
        attrs = if parsed.options[:org], do: Map.put(attrs, :org_id, parsed.options[:org]), else: attrs
        attrs = if parsed.options[:type], do: Map.put(attrs, :space_type, parsed.options[:type]), else: attrs

        case transport.call(Ema.Spaces, :create_space, [attrs]) do
          {:ok, space} ->
            Output.success("Created space: #{space.name}")
            if opts[:json], do: Output.json(space)
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"name" => name}
        body = if parsed.options[:org], do: Map.put(body, "org_id", parsed.options[:org]), else: body
        body = if parsed.options[:type], do: Map.put(body, "space_type", parsed.options[:type]), else: body

        case transport.post("/spaces", body) do
          {:ok, resp} ->
            space = resp["space"] || resp
            Output.success("Created space: #{space["name"]}")
            if opts[:json], do: Output.json(space)
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown space subcommand: #{inspect(sub)}")
  end
end
