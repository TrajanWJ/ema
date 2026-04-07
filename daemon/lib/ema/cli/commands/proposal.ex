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
        other -> nil
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

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown proposal subcommand: #{inspect(sub)}")
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
