defmodule Ema.CLI.Commands.Goal do
  @moduledoc "CLI commands for goal tracking."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Title", :title},
    {"Status", :status},
    {"Timeframe", :timeframe},
    {"Parent", :parent_id},
    {"Updated", :updated_at}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter = Helpers.compact_keyword([
          {:status, parsed.options[:status]},
          {:timeframe, parsed.options[:timeframe]},
          {:project_id, parsed.options[:project]}
        ])

        case transport.call(Ema.Goals, :list_goals, [filter]) do
          {:ok, goals} -> Output.render(goals, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = Helpers.compact_keyword([
          {:status, parsed.options[:status]},
          {:timeframe, parsed.options[:timeframe]},
          {:project_id, parsed.options[:project]}
        ])

        case transport.get("/goals", params: params) do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "goals"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Goals, :get_goal_with_children, [id]) do
          {:ok, nil} -> Output.error("Goal #{id} not found")
          {:ok, goal} -> Output.detail(goal, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/goals/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "goal"), json: opts[:json])
          {:error, :not_found} -> Output.error("Goal #{id} not found")
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
          {:description, parsed.options[:description]},
          {:status, parsed.options[:status] || "active"},
          {:timeframe, parsed.options[:timeframe]},
          {:parent_id, parsed.options[:parent]},
          {:project_id, parsed.options[:project]}
        ])

        case transport.call(Ema.Goals, :create_goal, [attrs]) do
          {:ok, goal} ->
            Output.success("Created goal ##{goal.id}: #{goal.title}")
            if opts[:json], do: Output.json(goal)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"goal" => Helpers.compact_map([
          {"title", title},
          {"description", parsed.options[:description]},
          {"status", parsed.options[:status] || "active"},
          {"timeframe", parsed.options[:timeframe]},
          {"parent_id", parsed.options[:parent]},
          {"project_id", parsed.options[:project]}
        ])}

        case transport.post("/goals", body) do
          {:ok, resp} ->
            goal = Helpers.extract_record(resp, "goal")
            Output.success("Created goal: #{goal["title"]}")
            if opts[:json], do: Output.json(goal)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:update], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = Helpers.compact_map([
          {:title, parsed.options[:title]},
          {:status, parsed.options[:status]},
          {:description, parsed.options[:description]},
          {:timeframe, parsed.options[:timeframe]}
        ])

        case transport.call(Ema.Goals, :update_goal, [id, attrs]) do
          {:ok, goal} ->
            Output.success("Updated goal ##{goal.id}")
            if opts[:json], do: Output.json(goal)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"goal" => Helpers.compact_map([
          {"title", parsed.options[:title]},
          {"status", parsed.options[:status]},
          {"description", parsed.options[:description]},
          {"timeframe", parsed.options[:timeframe]}
        ])}

        case transport.put("/goals/#{id}", body) do
          {:ok, _} -> Output.success("Updated goal ##{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Goals, :delete_goal, [id]) do
          {:ok, _} -> Output.success("Deleted goal ##{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/goals/#{id}") do
          {:ok, _} -> Output.success("Deleted goal ##{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown goal subcommand: #{inspect(sub)}")
  end
end
