defmodule Ema.CLI.Commands.Actor do
  @moduledoc "CLI commands for actor management."

  alias Ema.CLI.Output

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Type", :type},
    {"Slug", :slug},
    {"Phase", :phase},
    {"Status", :status}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Actors, :list_actors, []) do
          {:ok, actors} -> Output.render(actors, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/actors") do
          {:ok, body} -> Output.render(body["actors"] || [], @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Actors, :get_actor, [id]) do
          {:ok, nil} ->
            case transport.call(Ema.Actors, :get_actor_by_slug, [id]) do
              {:ok, nil} -> Output.error("Actor #{id} not found")
              {:ok, actor} -> Output.detail(actor, json: opts[:json])
              {:error, reason} -> Output.error(reason)
            end

          {:ok, actor} ->
            Output.detail(actor, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/actors/#{id}") do
          {:ok, body} -> Output.detail(body["actor"] || body, json: opts[:json])
          {:error, :not_found} -> Output.error("Actor #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    name = parsed.args.name

    slug =
      name
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9]+/, "-")
      |> String.trim("-")

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = %{name: name, slug: slug, type: parsed.options[:type] || "human"}
        attrs = if parsed.options[:space], do: Map.put(attrs, :space_id, parsed.options[:space]), else: attrs

        case transport.call(Ema.Actors, :create_actor, [attrs]) do
          {:ok, actor} ->
            Output.success("Created actor #{actor.slug} (#{actor.type})")
            if opts[:json], do: Output.json(actor)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"name" => name, "slug" => slug, "type" => parsed.options[:type] || "human"}
        body = if parsed.options[:space], do: Map.put(body, "space_id", parsed.options[:space]), else: body

        case transport.post("/actors", body) do
          {:ok, resp} ->
            actor = resp["actor"] || resp
            Output.success("Created actor #{actor["slug"]} (#{actor["type"]})")
            if opts[:json], do: Output.json(actor)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:transition], parsed, transport, opts) do
    id = parsed.args.id
    phase = parsed.args.phase

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Actors, :get_actor, [id]) do
          {:ok, nil} -> Output.error("Actor #{id} not found")
          {:ok, actor} ->
            case transport.call(Ema.Actors, :transition_phase, [actor, phase, parsed.options[:reason]]) do
              {:ok, updated} ->
                Output.success("#{updated.slug}: #{updated.phase}")
                if opts[:json], do: Output.json(updated)
              {:error, reason} -> Output.error(inspect(reason))
            end
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        body = %{"phase" => phase}
        body = if parsed.options[:reason], do: Map.put(body, "reason", parsed.options[:reason]), else: body

        case transport.post("/actors/#{id}/transition", body) do
          {:ok, resp} ->
            actor = resp["actor"] || resp
            Output.success("#{actor["slug"]}: #{actor["phase"]}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:commands], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Actors, :list_commands, [id]) do
          {:ok, cmds} ->
            Output.render(cmds, [{"Name", :command_name}, {"Description", :description}, {"Module", :handler_module}], json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/actors/#{id}/commands") do
          {:ok, body} -> Output.render(body["commands"] || [], [{"Name", "command_name"}, {"Description", "description"}], json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown actor subcommand: #{inspect(sub)}")
  end
end
