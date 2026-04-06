defmodule Ema.CLI.Commands.Intent do
  @moduledoc "CLI commands for intent map management."

  alias Ema.CLI.Output

  @columns [
    {"ID", :id},
    {"Title", :title},
    {"Type", :type},
    {"Status", :status},
    {"Project", :project_id}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter_opts = if parsed.options[:project], do: [project_id: parsed.options[:project]], else: []

        case transport.call(Ema.Intelligence.IntentMap, :list_nodes, [filter_opts]) do
          {:ok, nodes} -> Output.render(nodes, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = if parsed.options[:project], do: [project_id: parsed.options[:project]], else: []

        case transport.get("/intent/nodes", params: params) do
          {:ok, body} -> Output.render(body["nodes"] || [], @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intelligence.IntentMap, :get_node, [id]) do
          {:ok, nil} -> Output.error("Intent node #{id} not found")
          {:ok, node} -> Output.detail(node, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intent/nodes/#{id}") do
          {:ok, body} -> Output.detail(body["node"] || body, json: opts[:json])
          {:error, :not_found} -> Output.error("Intent node #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:tree], parsed, transport, opts) do
    project = parsed.args[:project] || parsed.options[:project]

    if project do
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.Intelligence.IntentMap, :tree, [project]) do
            {:ok, tree} ->
              if opts[:json], do: Output.json(tree), else: Output.info(inspect(tree, pretty: true))
            {:error, reason} -> Output.error(reason)
          end

        Ema.CLI.Transport.Http ->
          case transport.get("/intent/tree/#{project}") do
            {:ok, body} ->
              if opts[:json], do: Output.json(body), else: Output.info(inspect(body, pretty: true))
            {:error, reason} -> Output.error(reason)
          end
      end
    else
      Output.error("--project is required for tree view")
    end
  end

  def handle([:export], parsed, transport, opts) do
    project = parsed.args[:project] || parsed.options[:project]

    if project do
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.Intelligence.IntentMap, :export_markdown, [project]) do
            {:ok, md} -> if opts[:json], do: Output.json(%{markdown: md}), else: IO.puts(md)
            {:error, reason} -> Output.error(reason)
          end

        Ema.CLI.Transport.Http ->
          case transport.get("/intent/export/#{project}") do
            {:ok, body} -> if opts[:json], do: Output.json(body), else: IO.puts(body["markdown"] || inspect(body))
            {:error, reason} -> Output.error(reason)
          end
      end
    else
      Output.error("--project is required for export")
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown intent subcommand: #{inspect(sub)}")
  end
end
