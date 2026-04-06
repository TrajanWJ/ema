defmodule Ema.CLI.Commands.Responsibility do
  @moduledoc "CLI commands for responsibility tracking."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Title", :title},
    {"Role", :role},
    {"Cadence", :cadence},
    {"Health", :health_score},
    {"Active", :active}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter = Helpers.compact_keyword([
          {:project_id, parsed.options[:project]},
          {:role, parsed.options[:role]},
          {:active, true}
        ])

        case transport.call(Ema.Responsibilities, :list_responsibilities, [filter]) do
          {:ok, resps} -> Output.render(resps, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = Helpers.compact_keyword([
          {:project_id, parsed.options[:project]},
          {:role, parsed.options[:role]}
        ])

        case transport.get("/responsibilities", params: params) do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "responsibilities"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Responsibilities, :get_responsibility, [id]) do
          {:ok, nil} -> Output.error("Responsibility #{id} not found")
          {:ok, resp} -> Output.detail(resp, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/responsibilities/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "responsibility"), json: opts[:json])
          {:error, :not_found} -> Output.error("Responsibility #{id} not found")
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
          {:role, parsed.options[:role]},
          {:cadence, parsed.options[:cadence]},
          {:description, parsed.options[:description]},
          {:project_id, parsed.options[:project]}
        ])

        case transport.call(Ema.Responsibilities, :create_responsibility, [attrs]) do
          {:ok, resp} ->
            Output.success("Created responsibility: #{resp.title}")
            if opts[:json], do: Output.json(resp)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"responsibility" => Helpers.compact_map([
          {"title", title},
          {"role", parsed.options[:role]},
          {"cadence", parsed.options[:cadence]},
          {"description", parsed.options[:description]},
          {"project_id", parsed.options[:project]}
        ])}

        case transport.post("/responsibilities", body) do
          {:ok, resp} ->
            r = Helpers.extract_record(resp, "responsibility")
            Output.success("Created responsibility: #{r["title"]}")
            if opts[:json], do: Output.json(r)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:check_in], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = Helpers.compact_map([
          {:notes, parsed.options[:notes]},
          {:status, parsed.options[:status] || "ok"}
        ])

        case transport.call(Ema.Responsibilities, :get_responsibility!, [id]) do
          {:ok, resp} ->
            case transport.call(Ema.Responsibilities, :check_in, [resp, attrs]) do
              {:ok, check_in} ->
                Output.success("Checked in on #{resp.title}")
                if opts[:json], do: Output.json(check_in)

              {:error, reason} ->
                Output.error(inspect(reason))
            end

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = Helpers.compact_map([
          {"notes", parsed.options[:notes]},
          {"status", parsed.options[:status] || "ok"}
        ])

        case transport.post("/responsibilities/#{id}/check-in", body) do
          {:ok, _} -> Output.success("Checked in on responsibility #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:at_risk], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Responsibilities, :list_at_risk, []) do
          {:ok, resps} -> Output.render(resps, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/responsibilities/at-risk") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "responsibilities"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown responsibility subcommand: #{inspect(sub)}")
  end
end
