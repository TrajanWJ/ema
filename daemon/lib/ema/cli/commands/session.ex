defmodule Ema.CLI.Commands.Session do
  @moduledoc "CLI commands for Claude session management."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Project", :project_id},
    {"Status", :status},
    {"Model", :model},
    {"Tokens", :token_count},
    {"Updated", :updated_at}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter = Helpers.compact_keyword([
          {:project_id, parsed.options[:project]},
          {:status, parsed.options[:status]},
          {:limit, parsed.options[:limit] || 20}
        ])

        case transport.call(Ema.ClaudeSessions, :list_sessions, [filter]) do
          {:ok, sessions} -> Output.render(sessions, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = Helpers.compact_keyword([
          {:project_id, parsed.options[:project]},
          {:status, parsed.options[:status]},
          {:limit, parsed.options[:limit]}
        ])

        case transport.get("/claude-sessions", params: params) do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "sessions"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:active], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.ClaudeSessions, :get_active_sessions, []) do
          {:ok, sessions} -> Output.render(sessions, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/sessions/active") do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "sessions"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.ClaudeSessions, :get_session, [id]) do
          {:ok, nil} -> Output.error("Session #{id} not found")
          {:ok, session} -> Output.detail(session, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/claude-sessions/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "session"), json: opts[:json])
          {:error, :not_found} -> Output.error("Session #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:resume], parsed, transport, opts) do
    id = parsed.args.id
    prompt = parsed.options[:prompt] || ""

    case transport do
      Ema.CLI.Transport.Http ->
        case transport.post("/claude-sessions/#{id}/continue", %{"prompt" => prompt}) do
          {:ok, body} ->
            Output.success("Resumed session #{id}")
            if opts[:json], do: Output.json(body)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Direct ->
        case Ema.CLI.Transport.Http.post("/claude-sessions/#{id}/continue", %{"prompt" => prompt}) do
          {:ok, body} ->
            Output.success("Resumed session #{id}")
            if opts[:json], do: Output.json(body)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:kill], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Http ->
        case transport.delete("/claude-sessions/#{id}") do
          {:ok, _} -> Output.success("Killed session #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Direct ->
        case Ema.CLI.Transport.Http.delete("/claude-sessions/#{id}") do
          {:ok, _} -> Output.success("Killed session #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown session subcommand: #{inspect(sub)}")
  end
end
