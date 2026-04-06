defmodule Ema.CLI.Commands.Campaign do
  @moduledoc "CLI commands for campaign management."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Status", :status},
    {"Project", :project_id},
    {"Updated", :updated_at}
  ]

  @run_columns [
    {"ID", :id},
    {"Campaign", :campaign_id},
    {"Name", :name},
    {"Status", :status},
    {"Started", :inserted_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Campaigns, :list_campaigns, []) do
          {:ok, campaigns} -> Output.render(campaigns, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/campaigns") do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "campaigns"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Campaigns, :get_campaign, [id]) do
          {:ok, nil} -> Output.error("Campaign #{id} not found")
          {:ok, campaign} -> Output.detail(campaign, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/campaigns/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "campaign"), json: opts[:json])
          {:error, :not_found} -> Output.error("Campaign #{id} not found")
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
          {:description, parsed.options[:description]},
          {:project_id, parsed.options[:project]}
        ])

        case transport.call(Ema.Campaigns, :create_campaign, [attrs]) do
          {:ok, campaign} ->
            Output.success("Created campaign: #{campaign.name}")
            if opts[:json], do: Output.json(campaign)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"campaign" => Helpers.compact_map([
          {"name", name},
          {"description", parsed.options[:description]},
          {"project_id", parsed.options[:project]}
        ])}

        case transport.post("/campaigns", body) do
          {:ok, resp} ->
            c = Helpers.extract_record(resp, "campaign")
            Output.success("Created campaign: #{c["name"]}")
            if opts[:json], do: Output.json(c)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:run], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        name = parsed.options[:name]

        case transport.call(Ema.Campaigns, :start_run, [id, name]) do
          {:ok, run} ->
            Output.success("Started run #{run.id} for campaign #{id}")
            if opts[:json], do: Output.json(run)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = Helpers.compact_map([{"name", parsed.options[:name]}])

        case transport.post("/campaigns/#{id}/run", body) do
          {:ok, resp} ->
            run = Helpers.extract_record(resp, "run")
            Output.success("Started run for campaign #{id}")
            if opts[:json], do: Output.json(run)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:runs], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Campaigns, :list_runs_for_campaign, [id]) do
          {:ok, runs} -> Output.render(runs, @run_columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/campaigns/#{id}/runs") do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "runs"), @run_columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:advance], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Campaigns, :transition_campaign_by_id, [id, "active"]) do
          {:ok, campaign} ->
            Output.success("Advanced campaign #{campaign.id}")
            if opts[:json], do: Output.json(campaign)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/campaigns/#{id}/advance") do
          {:ok, _} -> Output.success("Advanced campaign #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown campaign subcommand: #{inspect(sub)}")
  end
end
