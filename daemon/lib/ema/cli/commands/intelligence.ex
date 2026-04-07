defmodule Ema.CLI.Commands.Intelligence do
  @moduledoc "CLI commands for intelligence layer — outcomes, MCP calls, git events, suggestions."

  alias Ema.CLI.{Helpers, Output}

  @event_columns [
    {"ID", :id},
    {"Type", :type},
    {"Repo", :repo},
    {"Branch", :branch},
    {"Created", :inserted_at}
  ]

  def handle([:"log-outcome"], parsed, transport, _opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:outcome, parsed.args.outcome},
            {:context, parsed.options[:context]},
            {:score, parsed.options[:score]}
          ])

        case transport.call(Ema.Intelligence, :log_outcome, [attrs]) do
          {:ok, _} -> Output.success("Outcome logged")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        body =
          Helpers.compact_map([
            {"outcome", parsed.args.outcome},
            {"context", parsed.options[:context]},
            {"score", parsed.options[:score]}
          ])

        case transport.post("/intelligence/outcomes", body) do
          {:ok, _} -> Output.success("Outcome logged")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:"log-mcp"], parsed, transport, _opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:tool, parsed.args.tool},
            {:input, parsed.options[:input]},
            {:output, parsed.options[:output]}
          ])

        case transport.call(Ema.Intelligence, :log_mcp_call, [attrs]) do
          {:ok, _} -> Output.success("MCP call logged")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        body =
          Helpers.compact_map([
            {"tool", parsed.args.tool},
            {"input", parsed.options[:input]},
            {"output", parsed.options[:output]}
          ])

        case transport.post("/intelligence/mcp-calls", body) do
          {:ok, _} -> Output.success("MCP call logged")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:"git-events"], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.GitSync, :list_events, []) do
          {:ok, events} -> Output.render(events, @event_columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intelligence/git-events") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "events"), @event_columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:suggestions], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.GitSync, :suggestions, [id]) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intelligence/git-events/#{id}/suggestions") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:apply], parsed, transport, _opts) do
    id = parsed.args.id
    action_id = parsed.args.action_id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.GitSync, :apply_suggestion, [id, action_id]) do
          {:ok, _} -> Output.success("Suggestion applied")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/intelligence/git-events/#{id}/apply/#{action_id}", %{}) do
          {:ok, _} -> Output.success("Suggestion applied")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:"sync-status"], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.GitSync, :sync_status, []) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intelligence/sync-status") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:scan], _parsed, transport, _opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.GitSync, :scan, []) do
          {:ok, _} -> Output.success("Git scan initiated")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/intelligence/git-events/scan", %{}) do
          {:ok, _} -> Output.success("Git scan initiated")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown intelligence subcommand: #{inspect(sub)}")
  end
end
