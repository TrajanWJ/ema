defmodule EmaCli.Intent do
  @moduledoc "CLI commands for the Intent Engine"

  import EmaCli.CLI, only: [api_get: 1, api_post: 2, format_output: 2, error: 1, warn: 1]

  def run("search", opts) do
    query = Map.get(opts, :_arg) || error("Usage: ema intent search <query>")
    project = if Map.get(opts, :project), do: "&project_id=#{opts.project}", else: ""

    case api_get("/intents?search=#{URI.encode(query)}#{project}") do
      {:ok, %{"intents" => intents}} -> format_output(intents, opts)
      {:ok, intents} when is_list(intents) -> format_output(intents, opts)
      {:error, msg} -> warn("Intent search unavailable: #{msg}")
    end
  end

  def run("list", opts) do
    params = build_params(opts, [:project_id, :level, :status, :kind, :limit])

    case api_get("/intents#{params}") do
      {:ok, %{"intents" => intents}} ->
        format_output(intents, opts)

      {:ok, intents} when is_list(intents) ->
        format_output(intents, opts)

      {:error, _} ->
        warn("Intent list not available")
    end
  end

  def run("graph", opts) do
    project_id = Map.get(opts, :project) || Map.get(opts, :project_id)

    path =
      if project_id,
        do: "/intents/tree?project_id=#{project_id}",
        else: "/intents/tree"

    case api_get(path) do
      {:ok, %{"tree" => tree}} -> print_ascii_tree(tree, 0)
      {:ok, tree} when is_list(tree) -> print_ascii_tree(tree, 0)
      {:error, _} -> warn("Intent tree not available")
    end
  end

  def run("trace", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema intent trace <node-id>")

    case api_get("/intents/#{id}") do
      {:ok, %{"intent" => intent}} -> format_output([intent], opts)
      {:ok, node} when is_map(node) -> format_output([node], opts)
      {:error, msg} -> warn("Intent not found: #{msg}")
    end
  end

  def run("create", opts) do
    title = Map.get(opts, :_arg) || error("Usage: ema intent create <title>")

    body = %{
      title: title,
      project_id: Map.get(opts, :project) || Map.get(opts, :project_id),
      level: Map.get(opts, :level, 4),
      kind: Map.get(opts, :kind, "task"),
      description: Map.get(opts, :description),
      parent_id: Map.get(opts, :parent_id)
    }

    case api_post("/intents", body) do
      {:ok, intent} -> format_output([intent], opts)
      {:error, msg} -> warn("Failed to create intent: #{msg}")
    end
  end

  def run(unknown, _),
    do: error("Unknown intent subcommand: #{unknown}. Try: search, list, graph, trace, create")

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
