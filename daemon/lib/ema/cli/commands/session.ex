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

  # -- Orchestrator commands --

  def handle([:spawn], parsed, transport, opts) do
    prompt = parsed.args.prompt

    case transport do
      Ema.CLI.Transport.Direct ->
        spawn_opts = [
          project_slug: parsed.options[:project],
          task_id: parsed.options[:task],
          model: parsed.options[:model] || "sonnet",
          inject_context: true
        ]

        case transport.call(Ema.Sessions.Orchestrator, :spawn, [prompt, spawn_opts]) do
          {:ok, result} ->
            Output.success("Spawned session #{result.session_id} in #{result.project_path}")
            if opts[:json], do: Output.json(result)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = Helpers.compact_map([
          {"prompt", prompt},
          {"project_slug", parsed.options[:project]},
          {"task_id", parsed.options[:task]},
          {"model", parsed.options[:model]}
        ])

        case transport.post("/orchestrator/sessions/spawn", body) do
          {:ok, resp} ->
            session = Helpers.extract_record(resp, "session")
            Output.success("Spawned session #{session["session_id"]}")
            if opts[:json], do: Output.json(session)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:follow], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Sessions.Orchestrator, :check_session, [id]) do
          {:error, reason} ->
            Output.error(reason)

          status ->
            if opts[:json] do
              Output.json(status)
            else
              IO.puts("Session: #{status.id}")
              IO.puts("Status:  #{status.status}")
              IO.puts("Running: #{status.running}")

              if status.exit_code do
                IO.puts("Exit:    #{status.exit_code}")
              end

              if status.output_summary do
                IO.puts("\n--- Output (last 500 chars) ---")
                IO.puts(String.slice(status.output_summary, -500, 500))
              end
            end
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/orchestrator/sessions/#{id}/check") do
          {:ok, body} ->
            session = Helpers.extract_record(body, "session")

            if opts[:json] do
              Output.json(session)
            else
              IO.puts("Session: #{session["id"]}")
              IO.puts("Status:  #{session["status"]}")
              IO.puts("Running: #{session["running"]}")

              if session["exit_code"] do
                IO.puts("Exit:    #{session["exit_code"]}")
              end

              if session["output_summary"] do
                IO.puts("\n--- Output ---")
                IO.puts(String.slice(session["output_summary"], -500, 500))
              end
            end

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:context], parsed, _transport, opts) do
    params = Helpers.compact_keyword([{:project_slug, parsed.options[:project]}])

    case Ema.CLI.Transport.Http.get("/orchestrator/context", params: params) do
      {:ok, body} ->
        ctx = Helpers.extract_record(body, "context")
        if opts[:json], do: Output.json(ctx), else: Output.detail(ctx)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:all], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/orchestrator/sessions") do
      {:ok, body} ->
        sessions = Helpers.extract_list(body, "sessions")
        all_cols = [
          {"ID", "id"},
          {"Type", "type"},
          {"Status", "status"},
          {"Project", "project_path"},
          {"Live", "live"}
        ]
        Output.render(sessions, all_cols, json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown session subcommand: #{inspect(sub)}")
  end
end
