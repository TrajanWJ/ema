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

  def handle([:"context-inspect"], parsed, _transport, opts) do
    case Ema.Intelligence.ContextTrace.fetch(parsed.args.id) do
      {:ok, trace} ->
        if opts[:json] do
          Output.detail(trace, json: true)
        else
          render_trace(trace)
        end

      {:error, reason} ->
        Output.error("trace not found: #{inspect(reason)}")
    end
  end

  def handle([:"context-list"], parsed, _transport, opts) do
    limit = parsed.options[:limit] || 20
    traces = Ema.Intelligence.ContextTrace.list_recent(limit)

    rows =
      Enum.map(traces, fn t ->
        %{
          id: t.id,
          source: t.source,
          budget: t.budget,
          tokens_used: t.tokens_used,
          recorded_at: t.recorded_at
        }
      end)

    Output.render(
      rows,
      [
        {"ID", :id},
        {"Source", :source},
        {"Budget", :budget},
        {"Used", :tokens_used},
        {"Recorded", :recorded_at}
      ],
      json: opts[:json]
    )
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown intelligence subcommand: #{inspect(sub)}")
  end

  defp render_trace(trace) do
    IO.puts("Trace: #{trace.id}")
    IO.puts("Source: #{trace.source}")
    IO.puts("Budget: #{trace.budget} tokens (used #{trace.tokens_used})")
    IO.puts("Recorded: #{trace.recorded_at}")

    focus = trace.focus || %{}
    IO.puts("\nFocus terms: #{inspect(Map.get(focus, :terms, []))}")

    IO.puts("\nAllocations:")

    Enum.each(trace.allocations || %{}, fn {section, tokens} ->
      IO.puts("  #{section}: #{tokens} tokens")
    end)

    IO.puts("\nSelected items:")

    Enum.each(trace.sections || %{}, fn {section, items} ->
      IO.puts("\n  ## #{section} (#{length(items)} items)")

      Enum.each(items, fn item ->
        rel = format_float(item[:relevance] || item["relevance"])
        title = item[:title] || item["title"] || item[:id] || item["id"] || "<unknown>"
        tokens = item[:tokens] || item["tokens"] || 0
        pinned = if item[:pinned] || item["pinned"], do: " [pinned]", else: ""
        truncated = if item[:truncated] || item["truncated"], do: " [truncated]", else: ""

        IO.puts("    - (#{rel}) #{title} — #{tokens}t#{pinned}#{truncated}")

        components = item[:components] || item["components"] || %{}

        if components != %{} do
          summary =
            components
            |> Enum.map(fn {k, v} -> "#{k}=#{format_float(v)}" end)
            |> Enum.join(" ")

          IO.puts("        #{summary}")
        end
      end)
    end)
  end

  defp format_float(nil), do: "—"
  defp format_float(n) when is_float(n), do: :erlang.float_to_binary(n, decimals: 2)
  defp format_float(n), do: to_string(n)
end
