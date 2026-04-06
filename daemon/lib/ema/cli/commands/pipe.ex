defmodule Ema.CLI.Commands.Pipe do
  @moduledoc "CLI commands for pipe automation."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Trigger", :trigger_pattern},
    {"Active", :active},
    {"System", :system},
    {"Updated", :updated_at}
  ]

  @run_columns [
    {"ID", :id},
    {"Pipe", :pipe_id},
    {"Status", :status},
    {"Trigger", :trigger_event},
    {"Created", :inserted_at}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter = Helpers.compact_keyword([{:project_id, parsed.options[:project]}])

        case transport.call(Ema.Pipes, :list_pipes, [filter]) do
          {:ok, pipes} -> Output.render(pipes, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = Helpers.compact_keyword([{:project_id, parsed.options[:project]}])

        case transport.get("/pipes", params: params) do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "pipes"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Pipes, :get_pipe, [id]) do
          {:ok, nil} -> Output.error("Pipe #{id} not found")
          {:ok, pipe} -> Output.detail(pipe, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/pipes/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "pipe"), json: opts[:json])
          {:error, :not_found} -> Output.error("Pipe #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    name = parsed.args.name

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = Helpers.compact_map([
          {:name, name},
          {:trigger_pattern, parsed.options[:trigger]},
          {:description, parsed.options[:description]}
        ])

        case transport.call(Ema.Pipes, :create_pipe, [attrs]) do
          {:ok, pipe} ->
            Output.success("Created pipe: #{pipe.name}")
            if opts[:json], do: Output.json(pipe)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"pipe" => Helpers.compact_map([
          {"name", name},
          {"trigger_pattern", parsed.options[:trigger]},
          {"description", parsed.options[:description]}
        ])}

        case transport.post("/pipes", body) do
          {:ok, resp} ->
            pipe = Helpers.extract_record(resp, "pipe")
            Output.success("Created pipe: #{pipe["name"]}")
            if opts[:json], do: Output.json(pipe)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:toggle], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Pipes, :toggle_pipe, [id]) do
          {:ok, pipe} ->
            status = if pipe.active, do: "active", else: "paused"
            Output.success("Pipe #{pipe.id} → #{status}")
            if opts[:json], do: Output.json(pipe)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/pipes/#{id}/toggle") do
          {:ok, _} -> Output.success("Toggled pipe #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:fork], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Pipes, :fork_pipe, [id]) do
          {:ok, pipe} ->
            Output.success("Forked pipe → #{pipe.id}")
            if opts[:json], do: Output.json(pipe)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/pipes/#{id}/fork") do
          {:ok, resp} ->
            pipe = Helpers.extract_record(resp, "pipe")
            Output.success("Forked pipe → #{pipe["id"]}")
            if opts[:json], do: Output.json(pipe)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:catalog], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Pipes, :list_system_pipes, []) do
          {:ok, pipes} -> Output.render(pipes, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/pipes/catalog") do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "catalog"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:history], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        limit = parsed.options[:limit] || 20

        case transport.call(Ema.Pipes, :recent_runs, [limit]) do
          {:ok, runs} -> Output.render(runs, @run_columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = Helpers.compact_keyword([{:limit, parsed.options[:limit]}])

        case transport.get("/pipes/history", params: params) do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "runs"), @run_columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown pipe subcommand: #{inspect(sub)}")
  end
end
