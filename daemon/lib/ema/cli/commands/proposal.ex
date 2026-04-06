defmodule Ema.CLI.Commands.Proposal do
  @moduledoc "CLI commands for proposal lifecycle."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Title", :title},
    {"Status", :status},
    {"Confidence", :confidence_score},
    {"Project", :project_id},
    {"Updated", :updated_at}
  ]

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
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "proposal"), json: opts[:json])
          {:error, :not_found} -> Output.error("Proposal #{id} not found")
          {:error, reason} -> Output.error(reason)
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
          {:ok, proposal} ->
            Output.success("Redirected proposal ##{proposal.id} — 3 new seeds created")
            if opts[:json], do: Output.json(proposal)

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

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown proposal subcommand: #{inspect(sub)}")
  end

  defp build_filter_opts(options) do
    []
    |> maybe_append(:status, options[:status])
    |> maybe_append(:project_id, options[:project])
    |> maybe_append(:limit, options[:limit])
  end

  defp build_http_params(options) do
    []
    |> maybe_append(:status, options[:status])
    |> maybe_append(:project_id, options[:project])
    |> maybe_append(:limit, options[:limit])
  end

  defp maybe_append(list, _key, nil), do: list
  defp maybe_append(list, key, value), do: [{key, value} | list]
end
