defmodule Ema.CLI.Commands.Evolution do
  @moduledoc "CLI commands for evolution rules and signals."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Status", :status},
    {"Source", :source},
    {"Updated", :updated_at}
  ]

  def handle([:rules], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter =
          Helpers.compact_keyword([
            {:status, parsed.options[:status]},
            {:source, parsed.options[:source]}
          ])

        case transport.call(Ema.Evolution, :list_rules, [filter]) do
          {:ok, rules} -> Output.render(rules, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params =
          Helpers.compact_keyword([
            {:status, parsed.options[:status]},
            {:source, parsed.options[:source]}
          ])

        case transport.get("/evolution/rules", params: params) do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "rules"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Evolution, :get_rule, [id]) do
          {:ok, nil} -> Output.error("Rule #{id} not found")
          {:ok, rule} -> Output.detail(rule, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/evolution/rules/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "rule"), json: opts[:json])
          {:error, :not_found} -> Output.error("Rule #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:activate], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Evolution, :activate_rule, [id]) do
          {:ok, _} -> Output.success("Activated rule #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/evolution/rules/#{id}/activate") do
          {:ok, _} -> Output.success("Activated rule #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:rollback], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Evolution, :rollback_rule, [id]) do
          {:ok, _} -> Output.success("Rolled back rule #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/evolution/rules/#{id}/rollback") do
          {:ok, _} -> Output.success("Rolled back rule #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:signals], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Evolution, :recent_signals, [20]) do
          {:ok, signals} -> Output.render(signals, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/evolution/signals") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "signals"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:stats], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Evolution, :stats, []) do
          {:ok, stats} ->
            if opts[:json], do: Output.json(stats), else: Output.detail(stats)

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/evolution/stats") do
          {:ok, body} ->
            stats = Helpers.extract_record(body, "stats")
            if opts[:json], do: Output.json(stats), else: Output.detail(stats)

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:scan], _parsed, transport, _opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        transport.call(Ema.Evolution.SignalScanner, :scan_now, [])
        Output.success("Scan triggered")

      Ema.CLI.Transport.Http ->
        case transport.post("/evolution/scan") do
          {:ok, _} -> Output.success("Scan triggered")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:propose], parsed, transport, _opts) do
    description = parsed.args.description

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Evolution.Proposer, :propose_manual, [%{description: description}]) do
          {:ok, _} -> Output.success("Proposal queued")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/evolution/propose", %{"description" => description}) do
          {:ok, _} -> Output.success("Proposal queued")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown evolution subcommand: #{inspect(sub)}")
  end
end
