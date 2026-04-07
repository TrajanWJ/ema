defmodule Ema.CLI.Commands.Orchestrator do
  @moduledoc "CLI commands for session orchestrator — spawn, resume, kill, check, context."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Status", :status},
    {"Agent", :agent},
    {"Created", :inserted_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SessionOrchestrator, :list_sessions, []) do
          {:ok, sessions} -> Output.render(sessions, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/orchestrator/sessions") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "sessions"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SessionOrchestrator, :get_session, [id]) do
          {:ok, nil} -> Output.error("Session #{id} not found")
          {:ok, session} -> Output.detail(session, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/orchestrator/sessions/#{id}") do
          {:ok, body} ->
            Output.detail(Helpers.extract_record(body, "session"), json: opts[:json])

          {:error, :not_found} ->
            Output.error("Session #{id} not found")

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:spawn], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:objective, parsed.args.objective},
            {:agent, parsed.options[:agent]},
            {:project, parsed.options[:project]}
          ])

        case transport.call(Ema.SessionOrchestrator, :spawn_session, [attrs]) do
          {:ok, session} ->
            Output.success("Spawned session: #{session.id}")
            if opts[:json], do: Output.json(session)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body =
          Helpers.compact_map([
            {"objective", parsed.args.objective},
            {"agent", parsed.options[:agent]},
            {"project", parsed.options[:project]}
          ])

        case transport.post("/orchestrator/sessions/spawn", body) do
          {:ok, resp} ->
            s = Helpers.extract_record(resp, "session")
            Output.success("Spawned session: #{s["id"]}")
            if opts[:json], do: Output.json(s)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:resume], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SessionOrchestrator, :resume_session, [id]) do
          {:ok, _} -> Output.success("Resumed session #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/orchestrator/sessions/#{id}/resume", %{}) do
          {:ok, _} -> Output.success("Resumed session #{id}")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:kill], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SessionOrchestrator, :kill_session, [id]) do
          {:ok, _} -> Output.success("Killed session #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/orchestrator/sessions/#{id}/kill", %{}) do
          {:ok, _} -> Output.success("Killed session #{id}")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:check], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SessionOrchestrator, :check_session, [id]) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/orchestrator/sessions/#{id}/check") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:context], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SessionOrchestrator, :context, []) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/orchestrator/context") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown orchestrator subcommand: #{inspect(sub)}")
  end
end
