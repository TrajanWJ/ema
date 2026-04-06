defmodule Ema.CLI.Commands.Seed do
  @moduledoc "CLI commands for proposal seeds."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Title", :title},
    {"Type", :seed_type},
    {"Active", :active},
    {"Runs", :run_count},
    {"Last Run", :last_run_at}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter = Helpers.compact_keyword([
          {:project_id, parsed.options[:project]},
          {:active, parsed.options[:active]},
          {:seed_type, parsed.options[:type]}
        ])

        case transport.call(Ema.Proposals, :list_seeds, [filter]) do
          {:ok, seeds} -> Output.render(seeds, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = Helpers.compact_keyword([
          {:project_id, parsed.options[:project]},
          {:active, parsed.options[:active]},
          {:seed_type, parsed.options[:type]}
        ])

        case transport.get("/seeds", params: params) do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "seeds"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Proposals, :get_seed, [id]) do
          {:ok, nil} -> Output.error("Seed #{id} not found")
          {:ok, seed} -> Output.detail(seed, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/seeds/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "seed"), json: opts[:json])
          {:error, :not_found} -> Output.error("Seed #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    title = parsed.args.title

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = Helpers.compact_map([
          {:title, title},
          {:prompt, parsed.options[:prompt]},
          {:seed_type, parsed.options[:type] || "manual"},
          {:project_id, parsed.options[:project]}
        ])

        case transport.call(Ema.Proposals, :create_seed, [attrs]) do
          {:ok, seed} ->
            Output.success("Created seed: #{seed.title}")
            if opts[:json], do: Output.json(seed)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"seed" => Helpers.compact_map([
          {"title", title},
          {"prompt", parsed.options[:prompt]},
          {"seed_type", parsed.options[:type] || "manual"},
          {"project_id", parsed.options[:project]}
        ])}

        case transport.post("/seeds", body) do
          {:ok, resp} ->
            seed = Helpers.extract_record(resp, "seed")
            Output.success("Created seed: #{seed["title"]}")
            if opts[:json], do: Output.json(seed)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:toggle], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Proposals, :toggle_seed, [id]) do
          {:ok, seed} ->
            status = if seed.active, do: "active", else: "paused"
            Output.success("Seed #{seed.id} → #{status}")
            if opts[:json], do: Output.json(seed)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/seeds/#{id}/toggle") do
          {:ok, _} -> Output.success("Toggled seed #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:run_now], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        # run-now triggers the scheduler to process this seed immediately
        case transport.call(Ema.Proposals, :get_seed, [id]) do
          {:ok, nil} ->
            Output.error("Seed #{id} not found")

          {:ok, seed} ->
            case transport.call(Ema.Proposals, :increment_seed_run_count, [seed]) do
              {:ok, _} -> Output.success("Triggered seed #{id}")
              {:error, reason} -> Output.error(inspect(reason))
            end

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/seeds/#{id}/run-now") do
          {:ok, _} -> Output.success("Triggered seed #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown seed subcommand: #{inspect(sub)}")
  end
end
