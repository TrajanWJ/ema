defmodule Ema.CLI.Commands.Routine do
  @moduledoc "CLI commands for routine management."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Cadence", :cadence},
    {"Active", :active},
    {"Last Run", :last_run_at},
    {"Updated", :updated_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Routines, :list_routines, []) do
          {:ok, routines} -> Output.render(routines, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/routines") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "routines"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Routines, :get_routine, [id]) do
          {:ok, nil} -> Output.error("Routine #{id} not found")
          {:ok, routine} -> Output.detail(routine, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/routines/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "routine"), json: opts[:json])
          {:error, :not_found} -> Output.error("Routine #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    name = parsed.args.name

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:name, name},
            {:cadence, parsed.options[:cadence]},
            {:description, parsed.options[:description]}
          ])

        case transport.call(Ema.Routines, :create_routine, [attrs]) do
          {:ok, routine} ->
            Output.success("Created routine: #{routine.name}")
            if opts[:json], do: Output.json(routine)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "routine" =>
            Helpers.compact_map([
              {"name", name},
              {"cadence", parsed.options[:cadence]},
              {"description", parsed.options[:description]}
            ])
        }

        case transport.post("/routines", body) do
          {:ok, resp} ->
            r = Helpers.extract_record(resp, "routine")
            Output.success("Created routine: #{r["name"]}")
            if opts[:json], do: Output.json(r)

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
            {:name, parsed.options[:name]},
            {:cadence, parsed.options[:cadence]},
            {:description, parsed.options[:description]}
          ])

        case transport.call(Ema.Routines, :update_routine, [id, attrs]) do
          {:ok, routine} ->
            Output.success("Updated routine: #{routine.name}")
            if opts[:json], do: Output.json(routine)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "routine" =>
            Helpers.compact_map([
              {"name", parsed.options[:name]},
              {"cadence", parsed.options[:cadence]},
              {"description", parsed.options[:description]}
            ])
        }

        case transport.put("/routines/#{id}", body) do
          {:ok, resp} ->
            r = Helpers.extract_record(resp, "routine")
            Output.success("Updated routine: #{r["name"]}")
            if opts[:json], do: Output.json(r)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Routines, :delete_routine, [id]) do
          {:ok, _} -> Output.success("Deleted routine #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/routines/#{id}") do
          {:ok, _} -> Output.success("Deleted routine #{id}")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:toggle], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Routines, :toggle_routine, [id]) do
          {:ok, routine} ->
            Output.success(
              "Routine #{id} is now #{if routine.active, do: "active", else: "paused"}"
            )

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/routines/#{id}/toggle", %{}) do
          {:ok, resp} ->
            r = Helpers.extract_record(resp, "routine")
            Output.success("Routine #{id} is now #{(r["active"] && "active") || "paused"}")

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:run], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Routines, :run_routine, [id]) do
          {:ok, _} -> Output.success("Routine #{id} executed")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/routines/#{id}/run", %{}) do
          {:ok, _} -> Output.success("Routine #{id} executed")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown routine subcommand: #{inspect(sub)}")
  end
end
