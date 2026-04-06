defmodule Ema.CLI.Commands.Exec do
  @moduledoc "CLI commands for execution lifecycle."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Status", :status},
    {"Title", :title},
    {"Project", :project_slug},
    {"Actor", :actor_id},
    {"Space", :space_id},
    {"Mode", :mode},
    {"Updated", :updated_at}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter = Helpers.compact_keyword([
          {:status, parsed.options[:status]},
          {:project_slug, parsed.options[:project]},
          {:space_id, parsed.options[:space]},
          {:actor_id, parsed.options[:actor]},
          {:limit, parsed.options[:limit]}
        ])

        case transport.call(Ema.Executions, :list_executions, [filter]) do
          {:ok, execs} -> Output.render(execs, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = Helpers.compact_keyword([
          {:status, parsed.options[:status]},
          {:project_slug, parsed.options[:project]},
          {:limit, parsed.options[:limit]}
        ])

        case transport.get("/executions", params: params) do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "executions"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Executions, :get_execution, [id]) do
          {:ok, nil} -> Output.error("Execution #{id} not found")
          {:ok, exec} -> Output.detail(exec, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/executions/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "execution"), json: opts[:json])
          {:error, :not_found} -> Output.error("Execution #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    objective = parsed.args.objective

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = Helpers.compact_map([
          {:objective, objective},
          {:title, parsed.options[:title]},
          {:mode, parsed.options[:mode]},
          {:project_slug, parsed.options[:project]},
          {:space_id, parsed.options[:space]},
          {:actor_id, parsed.options[:actor]}
        ])

        case transport.call(Ema.Executions, :create, [attrs]) do
          {:ok, exec} ->
            Output.success("Created execution #{exec.id}")
            if opts[:json], do: Output.json(exec)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = Helpers.compact_map([
          {"objective", objective},
          {"title", parsed.options[:title]},
          {"mode", parsed.options[:mode]},
          {"project_slug", parsed.options[:project]},
          {"space_id", parsed.options[:space]},
          {"actor_id", parsed.options[:actor]}
        ])

        case transport.post("/executions", body) do
          {:ok, body} ->
            exec = Helpers.extract_record(body, "execution")
            Output.success("Created execution #{exec["id"]}")
            if opts[:json], do: Output.json(exec)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:approve], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Executions, :approve_execution, [id]) do
          {:ok, exec} ->
            Output.success("Approved execution #{exec.id}")
            if opts[:json], do: Output.json(exec)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/executions/#{id}/approve") do
          {:ok, _} -> Output.success("Approved execution #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:cancel], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Executions, :cancel_execution, [id]) do
          {:ok, exec} ->
            Output.success("Cancelled execution #{exec.id}")
            if opts[:json], do: Output.json(exec)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/executions/#{id}/cancel") do
          {:ok, _} -> Output.success("Cancelled execution #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:events], parsed, transport, opts) do
    id = parsed.args.id

    event_cols = [
      {"Type", :type},
      {"Payload", :payload},
      {"Created", :inserted_at}
    ]

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Executions, :list_events, [id]) do
          {:ok, events} -> Output.render(events, event_cols, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/executions/#{id}/events") do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "events"), event_cols, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown exec subcommand: #{inspect(sub)}")
  end
end
