defmodule Ema.CLI.Commands.Actor do
  @moduledoc "CLI commands for actor management."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Type", :actor_type},
    {"Slug", :slug},
    {"Phase", :phase},
    {"Status", :status}
  ]

  @command_columns [
    {"Command", :command_name},
    {"Handler", :handler},
    {"Description", :description}
  ]

  @phase_columns [
    {"At", :transitioned_at},
    {"From", :from_phase},
    {"To", :to_phase},
    {"Week", :week_number},
    {"Reason", :reason}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter =
          Helpers.compact_keyword(
            space_id: parsed.options[:space],
            type: parsed.options[:type],
            status: parsed.options[:status]
          )

        case transport.call(Ema.Actors, :list_actors, [filter]) do
          {:ok, actors} -> Output.render(actors, @columns, json: opts[:json])
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        params =
          Helpers.compact_keyword(
            space_id: parsed.options[:space],
            type: parsed.options[:type],
            status: parsed.options[:status]
          )

        case transport.get("/actors", params: params) do
          {:ok, body} -> Output.render(body["actors"] || [], @columns, json: opts[:json])
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    with {:ok, actor} <- resolve_actor(parsed.args.id, transport) do
      Output.detail(actor, json: opts[:json])
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:create], parsed, transport, opts) do
    name = parsed.args.name

    slug =
      name
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9]+/, "-")
      |> String.trim("-")

    capabilities =
      parsed.options[:capabilities]
      |> case do
        nil -> %{}
        raw -> Helpers.parse_cli_value(raw)
      end

    attrs =
      Helpers.compact_map([
        {:name, name},
        {:slug, slug},
        {:actor_type, parsed.options[:type] || "human"},
        {:space_id, parsed.options[:space]},
        {:capabilities, capabilities}
      ])

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Actors, :create_actor, [attrs]) do
          {:ok, actor} ->
            Output.success("Created actor #{actor.slug} (#{actor.actor_type})")
            if opts[:json], do: Output.json(actor)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body =
          attrs
          |> Enum.into(%{}, fn {k, v} -> {to_string(k), v} end)

        case transport.post("/actors", body) do
          {:ok, resp} ->
            actor = resp["actor"] || resp
            Output.success("Created actor #{actor["slug"]} (#{actor["actor_type"]})")
            if opts[:json], do: Output.json(actor)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:transition], parsed, transport, opts) do
    with {:ok, actor} <- resolve_actor(parsed.args.id, transport) do
      actor_id = Map.get(actor, :id) || actor["id"]

      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.Actors, :transition_phase, [actor, parsed.args.phase, parsed.options[:reason]]) do
            {:ok, updated} ->
              Output.success("#{updated.slug}: #{updated.phase}")
              if opts[:json], do: Output.json(updated)

            {:error, reason} ->
              Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          body = Helpers.compact_map([{"phase", parsed.args.phase}, {"reason", parsed.options[:reason]}])

          case transport.post("/actors/#{actor_id}/transition", body) do
            {:ok, resp} ->
              actor = resp["actor"] || resp
              Output.success("#{actor["slug"]}: #{actor["phase"]}")
              if opts[:json], do: Output.json(actor)

            {:error, reason} ->
              Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:commands], parsed, transport, opts) do
    with {:ok, actor} <- resolve_actor(parsed.args.id, transport) do
      actor_id = Map.get(actor, :id) || actor["id"]

      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.Actors, :list_commands, [actor_id]) do
            {:ok, cmds} -> Output.render(cmds, @command_columns, json: opts[:json])
            {:error, reason} -> Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          case transport.get("/actors/#{actor_id}/commands") do
            {:ok, body} -> Output.render(body["commands"] || [], @command_columns, json: opts[:json])
            {:error, reason} -> Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:phases], parsed, transport, opts) do
    with {:ok, actor} <- resolve_actor(parsed.args.id, transport) do
      actor_id = Map.get(actor, :id) || actor["id"]

      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.PhaseTransitions, :list_for, [actor_id]) do
            {:ok, rows} -> Output.render(rows, @phase_columns, json: opts[:json])
            {:error, reason} -> Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          case transport.get("/actors/#{actor_id}/phases") do
            {:ok, body} -> Output.render(body["transitions"] || body["phase_transitions"] || [], @phase_columns, json: opts[:json])
            {:error, reason} -> Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:register], parsed, transport, opts) do
    handler = normalize_handler(parsed.args.handler)

    attrs =
      Helpers.compact_map([
        {:actor_id, parsed.args.id},
        {:command_name, parsed.args.command},
        {:handler, handler},
        {:description, parsed.options[:description]},
        {:args_spec, parse_args_spec(parsed.options[:args_spec])}
      ])

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Actors, :register_command, [attrs]) do
          {:ok, command} ->
            Output.success("Registered #{command.command_name} on #{command.actor_id}")
            if opts[:json], do: Output.json(command)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = attrs |> Enum.into(%{}, fn {k, v} -> {to_string(k), v} end) |> Map.delete("actor_id")

        case transport.post("/actors/#{parsed.args.id}/commands", body) do
          {:ok, resp} ->
            command = resp["command"] || resp
            Output.success("Registered #{command["command_name"]} on #{command["actor_id"]}")
            if opts[:json], do: Output.json(command)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown actor subcommand: #{inspect(sub)}")
  end

  defp resolve_actor(ref, transport) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Actors, :get_actor, [ref]) do
          {:ok, nil} ->
            case transport.call(Ema.Actors, :get_actor_by_slug, [ref]) do
              {:ok, nil} -> {:error, "Actor #{ref} not found"}
              {:ok, actor} -> {:ok, actor}
              {:error, reason} -> {:error, inspect(reason)}
            end

          {:ok, actor} ->
            {:ok, actor}

          {:error, reason} ->
            {:error, inspect(reason)}
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/actors/#{ref}") do
          {:ok, body} -> {:ok, body["actor"] || body}
          {:error, :not_found} -> {:error, "Actor #{ref} not found"}
          {:error, reason} -> {:error, inspect(reason)}
        end
    end
  end

  defp normalize_handler(handler), do: String.replace(handler, ":", ".")

  defp parse_args_spec(nil), do: nil
  defp parse_args_spec(raw), do: Helpers.parse_cli_value(raw)
end
