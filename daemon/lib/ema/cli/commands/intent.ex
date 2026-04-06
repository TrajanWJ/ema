defmodule Ema.CLI.Commands.Intent do
  @moduledoc "CLI commands for intent engine management."

  alias Ema.CLI.Output

  @columns [
    {"ID", :id},
    {"Title", :title},
    {"Level", :level_name},
    {"Kind", :kind},
    {"Status", :status},
    {"Project", :project_id}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter_opts =
          []
          |> maybe_add(:project_id, parsed.options[:project])
          |> maybe_add(:level, parsed.options[:level])
          |> maybe_add(:status, parsed.options[:status])
          |> maybe_add(:kind, parsed.options[:kind])
          |> maybe_add(:limit, parsed.options[:limit])

        case transport.call(Ema.Intents, :list_intents, [filter_opts]) do
          {:ok, intents} ->
            Output.render(Enum.map(intents, &Ema.Intents.serialize/1), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params =
          []
          |> maybe_param("project_id", parsed.options[:project])
          |> maybe_param("level", parsed.options[:level])
          |> maybe_param("status", parsed.options[:status])
          |> maybe_param("kind", parsed.options[:kind])
          |> maybe_param("limit", parsed.options[:limit])

        case transport.get("/intents", params: params) do
          {:ok, body} -> Output.render(body["intents"] || [], @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :get_intent, [id]) do
          {:ok, nil} -> Output.error("Intent #{id} not found")
          {:ok, intent} -> Output.detail(Ema.Intents.serialize(intent), json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intents/#{id}") do
          {:ok, body} -> Output.detail(body["intent"] || body, json: opts[:json])
          {:error, :not_found} -> Output.error("Intent #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:tree], parsed, transport, opts) do
    project = parsed.args[:project] || parsed.options[:project]

    case transport do
      Ema.CLI.Transport.Direct ->
        tree_opts = if project, do: [project_id: project], else: []

        case transport.call(Ema.Intents, :tree, [tree_opts]) do
          {:ok, tree} ->
            if opts[:json], do: Output.json(tree), else: Output.info(inspect(tree, pretty: true))

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        path =
          if project,
            do: "/intents/tree?project_id=#{project}",
            else: "/intents/tree"

        case transport.get(path) do
          {:ok, body} ->
            if opts[:json], do: Output.json(body), else: Output.info(inspect(body, pretty: true))

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:export], parsed, transport, opts) do
    project = parsed.args[:project] || parsed.options[:project]

    case transport do
      Ema.CLI.Transport.Direct ->
        export_opts = if project, do: [project_id: project], else: []

        case transport.call(Ema.Intents, :export_markdown, [export_opts]) do
          {:ok, md} -> if opts[:json], do: Output.json(%{markdown: md}), else: IO.puts(md)
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        # Export uses tree endpoint data; not a dedicated route yet
        path =
          if project,
            do: "/intents/tree?project_id=#{project}",
            else: "/intents/tree"

        case transport.get(path) do
          {:ok, body} ->
            if opts[:json], do: Output.json(body), else: IO.puts(inspect(body, pretty: true))

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown intent subcommand: #{inspect(sub)}")
  end

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)

  defp maybe_param(params, _key, nil), do: params
  defp maybe_param(params, key, val), do: [{key, val} | params]
end
