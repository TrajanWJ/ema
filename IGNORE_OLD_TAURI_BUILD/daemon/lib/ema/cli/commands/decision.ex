defmodule Ema.CLI.Commands.Decision do
  @moduledoc "CLI commands for decision tracking — CRUD."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Title", :title},
    {"Status", :status},
    {"Context", :context},
    {"Updated", :updated_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Decisions, :list_decisions, []) do
          {:ok, decisions} -> Output.render(decisions, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/decisions") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "decisions"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Decisions, :get_decision, [id]) do
          {:ok, nil} -> Output.error("Decision #{id} not found")
          {:ok, decision} -> Output.detail(decision, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/decisions/#{id}") do
          {:ok, body} ->
            Output.detail(Helpers.extract_record(body, "decision"), json: opts[:json])

          {:error, :not_found} ->
            Output.error("Decision #{id} not found")

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    title = parsed.args.title

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:title, title},
            {:context, parsed.options[:context]},
            {:outcome, parsed.options[:outcome]},
            {:description, parsed.options[:description]}
          ])

        case transport.call(Ema.Decisions, :create_decision, [attrs]) do
          {:ok, decision} ->
            Output.success("Created decision: #{decision.title}")
            if opts[:json], do: Output.json(decision)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "decision" =>
            Helpers.compact_map([
              {"title", title},
              {"context", parsed.options[:context]},
              {"outcome", parsed.options[:outcome]},
              {"description", parsed.options[:description]}
            ])
        }

        case transport.post("/decisions", body) do
          {:ok, resp} ->
            d = Helpers.extract_record(resp, "decision")
            Output.success("Created decision: #{d["title"]}")
            if opts[:json], do: Output.json(d)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:update], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:title, parsed.options[:title]},
            {:context, parsed.options[:context]},
            {:outcome, parsed.options[:outcome]},
            {:status, parsed.options[:status]},
            {:description, parsed.options[:description]}
          ])

        case transport.call(Ema.Decisions, :update_decision, [id, attrs]) do
          {:ok, decision} ->
            Output.success("Updated decision: #{decision.title}")
            if opts[:json], do: Output.json(decision)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "decision" =>
            Helpers.compact_map([
              {"title", parsed.options[:title]},
              {"context", parsed.options[:context]},
              {"outcome", parsed.options[:outcome]},
              {"status", parsed.options[:status]},
              {"description", parsed.options[:description]}
            ])
        }

        case transport.put("/decisions/#{id}", body) do
          {:ok, resp} ->
            d = Helpers.extract_record(resp, "decision")
            Output.success("Updated decision: #{d["title"]}")
            if opts[:json], do: Output.json(d)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Decisions, :delete_decision, [id]) do
          {:ok, _} -> Output.success("Deleted decision #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/decisions/#{id}") do
          {:ok, _} -> Output.success("Deleted decision #{id}")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown decision subcommand: #{inspect(sub)}")
  end
end
