defmodule Ema.CLI.Commands.Proposal do
  @moduledoc "CLI commands for proposal lifecycle."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Title", :title},
    {"Status", :status},
    {"Actor", :actor_id},
    {"Space", :space_id},
    {"Confidence", :confidence},
    {"Project", :project_id},
    {"Updated", :updated_at}
  ]

  def handle([:create], parsed, transport, opts) do
    title = parsed.args.title

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          %{title: title, status: "queued"}
          |> maybe_put(:body, parsed.options[:body])
          |> maybe_put(:summary, parsed.options[:summary])
          |> maybe_put(:project_id, parsed.options[:project])
          |> maybe_put(:space_id, parsed.options[:space])
          |> maybe_put(:actor_id, parsed.options[:actor])

        case transport.call(Ema.Proposals, :create_proposal, [attrs]) do
          {:ok, proposal} ->
            Output.success("Created proposal #{proposal.id}: #{proposal.title}")
            if opts[:json], do: Output.json(proposal)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body =
          %{"title" => title, "status" => "queued"}
          |> maybe_put("body", parsed.options[:body])
          |> maybe_put("summary", parsed.options[:summary])
          |> maybe_put("project_id", parsed.options[:project])
          |> maybe_put("space_id", parsed.options[:space])
          |> maybe_put("actor_id", parsed.options[:actor])

        case transport.post("/proposals", body) do
          {:ok, resp} ->
            proposal = Helpers.extract_record(resp, "proposal")
            Output.success("Created proposal #{proposal["id"]}: #{proposal["title"]}")
            if opts[:json], do: Output.json(proposal)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter_opts = build_filter_opts(parsed.options)

        case transport.call(Ema.Proposals, :list_proposals, [filter_opts]) do
          {:ok, proposals} -> Output.render(proposals, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = build_http_params(parsed.options)

        case transport.get("/proposals", params: params) do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "proposals"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Proposals, :get_proposal, [id]) do
          {:ok, nil} -> Output.error("Proposal #{id} not found")
          {:ok, proposal} -> Output.detail(proposal, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/proposals/#{id}") do
          {:ok, body} ->
            Output.detail(Helpers.extract_record(body, "proposal"), json: opts[:json])

          {:error, :not_found} ->
            Output.error("Proposal #{id} not found")

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:approve], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Proposals, :approve_proposal, [id]) do
          {:ok, proposal} ->
            Output.success("Approved proposal ##{proposal.id}: #{proposal.title}")
            if opts[:json], do: Output.json(proposal)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/proposals/#{id}/approve") do
          {:ok, _} -> Output.success("Approved proposal ##{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:kill], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Proposals, :kill_proposal, [id]) do
          {:ok, proposal} ->
            Output.success("Killed proposal ##{proposal.id}")
            if opts[:json], do: Output.json(proposal)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/proposals/#{id}/kill") do
          {:ok, _} -> Output.success("Killed proposal ##{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:redirect], parsed, transport, opts) do
    id = parsed.args.id
    note = parsed.options[:note] || ""

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Proposals, :redirect_proposal, [id, note]) do
          {:ok, proposal, seeds} ->
            Output.success(
              "Redirected proposal ##{proposal.id} — #{length(seeds)} new seeds created"
            )

            if opts[:json] do
              Output.json(%{proposal: proposal, seeds: seeds})
            else
              Output.detail(%{proposal: proposal, seeds: seeds})
            end

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/proposals/#{id}/redirect", %{"note" => note}) do
          {:ok, _} -> Output.success("Redirected proposal ##{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:lineage], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Proposals, :get_lineage, [id]) do
          {:ok, nil} -> Output.error("Proposal #{id} not found")
          {:ok, lineage} -> Output.detail(lineage, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/proposals/#{id}/lineage") do
          {:ok, lineage} -> Output.detail(lineage, json: opts[:json])
          {:error, :not_found} -> Output.error("Proposal #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:cancel], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Proposals, :cancel_proposal, [id]) do
          {:ok, proposal} ->
            Output.success("Cancelled proposal ##{proposal.id}")
            if opts[:json], do: Output.json(proposal)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/proposals/#{id}/cancel") do
          {:ok, _} -> Output.success("Cancelled proposal ##{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:generate], parsed, transport, opts) do
    body =
      %{}
      |> maybe_put(:seed_id, parsed.options[:seed])

    http_body =
      %{}
      |> maybe_put("seed_id", parsed.options[:seed])

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.ProposalEngine, :generate, [body]) do
          {:ok, proposal} ->
            Output.success("Generated proposal ##{proposal.id}: #{proposal.title}")
            if opts[:json], do: Output.json(proposal)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/proposals/generate", http_body) do
          {:ok, resp} ->
            proposal = Helpers.extract_record(resp, "proposal")
            Output.success("Generated proposal ##{proposal["id"]}: #{proposal["title"]}")
            if opts[:json], do: Output.json(proposal)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:surfaced], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Proposals, :list_surfaced, []) do
          {:ok, proposals} -> Output.render(proposals, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/proposals/surfaced") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "proposals"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:budget], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.ProposalEngine, :get_budget, []) do
          {:ok, budget} -> Output.detail(budget, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/proposals/budget") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Proposals, :delete_proposal, [id]) do
          {:ok, _} -> Output.success("Deleted proposal #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/proposals/#{id}") do
          {:ok, _} -> Output.success("Deleted proposal #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:purge], parsed, _transport, _opts) do
    target = parsed.args[:target] || "killed"

    endpoint =
      case target do
        "killed" -> "/proposals/purge-killed"
        "untitled" -> "/proposals/purge-untitled"
        _other -> nil
      end

    if endpoint do
      case Ema.CLI.Transport.Http.post(endpoint) do
        {:ok, resp} ->
          count = resp["purged"] || 0
          Output.success("Purged #{count} #{target} proposals")

        {:error, reason} ->
          Output.error(inspect(reason))
      end
    else
      Output.error("Unknown purge target: #{target}. Use 'killed' or 'untitled'.")
    end
  end

  def handle([:triage], parsed, transport, opts) do
    auto_kill_below = parse_threshold(parsed.options[:auto_kill_below])
    interactive = is_nil(auto_kill_below)

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Proposals, :list_proposals, [[status: "queued"]]) do
          {:ok, proposals} ->
            if opts[:json] do
              Output.json(proposals)
            else
              triage_proposals(proposals, interactive, auto_kill_below, transport)
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/proposals", params: [status: "queued"]) do
          {:ok, body} ->
            proposals = Helpers.extract_list(body, "proposals")

            if opts[:json] do
              Output.json(proposals)
            else
              triage_proposals(proposals, interactive, auto_kill_below, transport)
            end

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown proposal subcommand: #{inspect(sub)}")
  end

  # -- Triage helpers --

  defp triage_proposals([], _interactive, _threshold, _transport) do
    IO.puts(IO.ANSI.faint() <> "No queued proposals to triage." <> IO.ANSI.reset())
  end

  defp triage_proposals(proposals, false, threshold, transport) do
    IO.puts("")

    IO.puts(
      IO.ANSI.bright() <>
        "  Auto-triage: killing proposals below #{threshold}" <> IO.ANSI.reset()
    )

    IO.puts("  " <> String.duplicate("─", 50))

    {to_kill, to_keep} =
      Enum.split_with(proposals, fn p ->
        conf = get_confidence(p)
        conf != nil and conf < threshold
      end)

    Enum.each(to_kill, fn p ->
      id = field(p, :id)
      title = field(p, :title) |> to_string() |> String.slice(0, 50)
      conf = get_confidence(p)

      case do_kill(id, transport) do
        :ok ->
          IO.puts(
            "    #{IO.ANSI.red()}killed#{IO.ANSI.reset()} #{title} " <>
              "#{IO.ANSI.faint()}(#{format_confidence(conf)})#{IO.ANSI.reset()}"
          )

        :error ->
          IO.puts("    #{IO.ANSI.red()}FAILED#{IO.ANSI.reset()} #{title}")
      end
    end)

    IO.puts("")

    IO.puts(
      "  #{IO.ANSI.green()}Killed #{length(to_kill)}#{IO.ANSI.reset()}, " <>
        "kept #{length(to_keep)}"
    )

    IO.puts("")
  end

  defp triage_proposals(proposals, true, _threshold, transport) do
    IO.puts("")
    IO.puts(IO.ANSI.bright() <> "  Proposal Triage" <> IO.ANSI.reset())
    IO.puts("  #{length(proposals)} queued proposal(s)")
    IO.puts("  " <> String.duplicate("─", 50))
    IO.puts("")

    triage_loop(proposals, transport, %{approved: 0, killed: 0, skipped: 0})
  end

  defp triage_loop([], _transport, counts) do
    IO.puts("")
    IO.puts("  #{IO.ANSI.bright()}Triage complete#{IO.ANSI.reset()}")

    IO.puts(
      "    #{IO.ANSI.green()}#{counts.approved} approved#{IO.ANSI.reset()}  " <>
        "#{IO.ANSI.red()}#{counts.killed} killed#{IO.ANSI.reset()}  " <>
        "#{IO.ANSI.faint()}#{counts.skipped} skipped#{IO.ANSI.reset()}"
    )

    IO.puts("")
  end

  defp triage_loop([proposal | rest], transport, counts) do
    id = field(proposal, :id)
    title = field(proposal, :title) || "Untitled"
    summary = field(proposal, :summary) || field(proposal, :body)
    confidence = get_confidence(proposal)
    project = field(proposal, :project_id)

    IO.puts("  #{IO.ANSI.bright()}#{title}#{IO.ANSI.reset()}")

    if confidence do
      IO.puts("    Confidence: #{confidence_bar(confidence)}")
    end

    if project, do: IO.puts("    Project: #{project}")

    if summary do
      trimmed = summary |> to_string() |> String.slice(0, 120)
      IO.puts("    #{IO.ANSI.faint()}#{trimmed}#{IO.ANSI.reset()}")
    end

    IO.puts("")

    response =
      IO.gets("    [a]pprove / [k]ill / [s]kip / [q]uit > ")
      |> to_string()
      |> String.trim()
      |> String.downcase()

    case response do
      a when a in ["a", "approve"] ->
        do_approve(id, transport)
        IO.puts("    #{IO.ANSI.green()}Approved#{IO.ANSI.reset()}")
        IO.puts("")
        triage_loop(rest, transport, %{counts | approved: counts.approved + 1})

      k when k in ["k", "kill"] ->
        do_kill(id, transport)
        IO.puts("    #{IO.ANSI.red()}Killed#{IO.ANSI.reset()}")
        IO.puts("")
        triage_loop(rest, transport, %{counts | killed: counts.killed + 1})

      s when s in ["s", "skip", ""] ->
        IO.puts("    #{IO.ANSI.faint()}Skipped#{IO.ANSI.reset()}")
        IO.puts("")
        triage_loop(rest, transport, %{counts | skipped: counts.skipped + 1})

      q when q in ["q", "quit"] ->
        remaining = length(rest) + 1
        IO.puts("    #{IO.ANSI.faint()}Quit (#{remaining} remaining)#{IO.ANSI.reset()}")
        triage_loop([], transport, counts)

      _ ->
        IO.puts("    #{IO.ANSI.yellow()}Unknown input, skipping#{IO.ANSI.reset()}")
        IO.puts("")
        triage_loop(rest, transport, %{counts | skipped: counts.skipped + 1})
    end
  end

  defp do_approve(id, transport) do
    case transport do
      Ema.CLI.Transport.Direct -> transport.call(Ema.Proposals, :approve_proposal, [id])
      Ema.CLI.Transport.Http -> transport.post("/proposals/#{id}/approve")
    end
  end

  defp do_kill(id, transport) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Proposals, :kill_proposal, [id]) do
          {:ok, _} -> :ok
          _ -> :error
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/proposals/#{id}/kill") do
          {:ok, _} -> :ok
          _ -> :error
        end
    end
  end

  defp field(record, key) when is_map(record) do
    Map.get(record, key) || Map.get(record, to_string(key))
  end

  defp get_confidence(proposal) do
    case field(proposal, :confidence) do
      nil -> nil
      n when is_number(n) -> n / 1
      s when is_binary(s) -> safe_parse_float(s)
      _ -> nil
    end
  end

  defp safe_parse_float(s) do
    case Float.parse(s) do
      {f, _} -> f
      :error -> nil
    end
  end

  defp parse_threshold(nil), do: nil

  defp parse_threshold(val) when is_number(val), do: val / 1

  defp parse_threshold(val) when is_binary(val) do
    case Float.parse(val) do
      {f, _} -> f
      :error -> nil
    end
  end

  defp format_confidence(nil), do: "no score"
  defp format_confidence(n), do: "#{Float.round(n * 1.0, 2)}"

  defp confidence_bar(nil), do: IO.ANSI.faint() <> "unknown" <> IO.ANSI.reset()

  defp confidence_bar(n) when is_number(n) do
    pct = round(n * 100)
    bar_len = 10
    filled = min(bar_len, round(n * bar_len))
    empty = bar_len - filled

    color =
      cond do
        n >= 0.7 -> IO.ANSI.green()
        n >= 0.4 -> IO.ANSI.yellow()
        true -> IO.ANSI.red()
      end

    "#{color}[#{String.duplicate("█", filled)}#{String.duplicate("░", empty)}]#{IO.ANSI.reset()} #{pct}%"
  end

  defp build_filter_opts(options) do
    []
    |> maybe_append(:status, options[:status])
    |> maybe_append(:project_id, options[:project])
    |> maybe_append(:space_id, options[:space])
    |> maybe_append(:actor_id, options[:actor])
    |> maybe_append(:limit, options[:limit])
  end

  defp build_http_params(options) do
    []
    |> maybe_append(:status, options[:status])
    |> maybe_append(:project_id, options[:project])
    |> maybe_append(:space_id, options[:space])
    |> maybe_append(:actor_id, options[:actor])
    |> maybe_append(:limit, options[:limit])
  end

  defp maybe_append(list, _key, nil), do: list
  defp maybe_append(list, key, value), do: [{key, value} | list]

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
