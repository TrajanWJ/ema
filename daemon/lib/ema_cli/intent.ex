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

  def run("context", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema intent context <id>")

    case api_get("/intents/#{id}") do
      {:ok, %{"intent" => intent}} -> print_intent_context(intent, opts)
      {:ok, intent} when is_map(intent) -> print_intent_context(intent, opts)
      {:error, msg} -> warn("Intent not found: #{msg}")
    end
  end

  def run("status", opts) do
    project = if Map.get(opts, :project), do: "?project_id=#{opts.project}", else: ""

    case api_get("/intents/status#{project}") do
      {:ok, summary} when is_map(summary) -> print_status_summary(summary)
      {:error, msg} -> warn("Intent status unavailable: #{msg}")
    end
  end

  def run("link", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema intent link <id> --depends-on=<target_id>")
    target = Map.get(opts, :"depends-on") || Map.get(opts, :depends_on)

    unless target, do: error("Missing --depends-on=<target_id>")

    body = %{
      intent_id: id,
      linkable_type: "intent",
      linkable_id: target,
      role: Map.get(opts, :role, "related")
    }

    case api_post("/intents/#{id}/links", body) do
      {:ok, link} -> format_output([link], opts)
      {:error, msg} -> warn("Failed to create link: #{msg}")
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
    do: error("Unknown intent subcommand: #{unknown}. Try: search, list, graph, trace, create, context, status, link")

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

  defp print_intent_context(intent, opts) do
    if Map.get(opts, :format) == "json" do
      IO.puts(Jason.encode!(intent, pretty: true))
    else
      print_intent_details(intent)
      print_intent_links(intent)
      print_intent_lineage(intent)
    end
  end

  defp print_intent_details(intent) do
    title = intent["title"] || "(untitled)"
    status = intent["status"] || "unknown"
    level = intent["level_name"] || "?"
    kind = intent["kind"] || "?"
    desc = intent["description"]

    IO.puts("\e[1m#{title}\e[0m")
    IO.puts("  Status: #{status}  Level: #{level}  Kind: #{kind}")
    if desc, do: IO.puts("  #{desc}")
    IO.puts("")
  end

  defp print_intent_links(intent) do
    links = intent["links"] || []
    IO.puts("Links: (#{length(links)})")

    if links == [] do
      IO.puts("  (none)")
    else
      Enum.each(links, fn link ->
        type = link["linkable_type"] || "?"
        role = link["role"] || "related"
        lid = link["linkable_id"] || "?"
        IO.puts("  #{role} -> #{type}:#{lid}")
      end)
    end

    IO.puts("")
  end

  defp print_intent_lineage(intent) do
    events = intent["lineage"] || []
    IO.puts("Lineage: (#{length(events)})")

    if events == [] do
      IO.puts("  (none)")
    else
      Enum.take(events, -10)
      |> Enum.each(fn event ->
        type = event["event_type"] || "?"
        actor = event["actor"] || "system"
        ts = event["inserted_at"] || ""
        IO.puts("  [#{ts}] #{type} (#{actor})")
      end)
    end
  end

  defp print_status_summary(summary) when is_map(summary) do
    total = summary["total"] || Map.get(summary, :total, 0)

    parts =
      summary
      |> Enum.reject(fn {k, _v} -> to_string(k) == "total" end)
      |> Enum.map(fn {status, count} -> "#{count} #{status}" end)
      |> Enum.sort()
      |> Enum.join(", ")

    IO.puts("#{total} intents: #{parts}")
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
