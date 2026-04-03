defmodule EmaCli.Intent do
  @moduledoc "CLI commands for the Intent Graph"

  import EmaCli.CLI, only: [api_get: 1, format_output: 2, error: 1, warn: 1]

  def run("search", opts) do
    query = Map.get(opts, :_arg) || error("Usage: ema intent search <query>")
    project = if Map.get(opts, :project), do: "&project_id=#{opts.project}", else: ""

    case api_get("/intelligence/intent_nodes?search=#{URI.encode(query)}#{project}") do
      {:ok, %{"nodes" => nodes}} -> format_output(nodes, opts)
      {:ok, nodes} when is_list(nodes) -> format_output(nodes, opts)
      {:error, msg} -> warn("Intent search unavailable: #{msg}")
    end
  end

  def run("list", opts) do
    params = build_params(opts, [:project, :level, :parent_id, :limit])

    case api_get("/intelligence/intent_nodes#{params}") do
      {:ok, %{"nodes" => nodes}} -> format_output(nodes, opts)
      {:ok, nodes} when is_list(nodes) -> format_output(nodes, opts)
      {:error, _} -> warn("Intent nodes not available -- may need to add /api/intelligence/intent_nodes route")
    end
  end

  def run("graph", opts) do
    project_id = Map.get(opts, :project) || error("Usage: ema intent graph --project=<id>")

    case api_get("/intelligence/intent_nodes/tree?project_id=#{project_id}") do
      {:ok, tree} when is_list(tree) -> print_ascii_tree(tree, 0)
      {:ok, %{"tree" => tree}} -> print_ascii_tree(tree, 0)
      {:error, _} -> warn("Intent tree not available")
    end
  end

  def run("trace", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema intent trace <node-id>")

    case api_get("/intelligence/intent_nodes/#{id}") do
      {:ok, node} when is_map(node) -> format_output([node], opts)
      {:error, msg} -> warn("Node not found: #{msg}")
    end
  end

  def run(unknown, _),
    do: error("Unknown intent subcommand: #{unknown}. Try: search, list, graph, trace")

  defp print_ascii_tree([], _depth), do: :ok

  defp print_ascii_tree(nodes, depth) when is_list(nodes) do
    Enum.each(nodes, fn node -> print_ascii_tree(node, depth) end)
  end

  defp print_ascii_tree(node, depth) when is_map(node) do
    indent = String.duplicate("  ", depth)
    title = node["title"] || node[:title] || "(untitled)"
    status = node["status"] || node[:status] || "open"
    level = node["level_name"] || node[:level_name] || "?"

    icon =
      case status do
        "complete" -> "\e[32m+\e[0m"
        "partial" -> "\e[33m~\e[0m"
        _ -> "o"
      end

    IO.puts("#{indent}#{icon} \e[2m[#{level}]\e[0m #{title}")
    children = node["children"] || node[:children] || []
    Enum.each(children, fn c -> print_ascii_tree(c, depth + 1) end)
  end

  defp build_params(opts, keys) do
    params =
      Enum.flat_map(keys, fn k ->
        case Map.get(opts, k) do
          nil -> []
          val -> ["#{k}=#{val}"]
        end
      end)

    if params == [], do: "", else: "?" <> Enum.join(params, "&")
  end
end
