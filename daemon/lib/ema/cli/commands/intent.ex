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
            Output.render(Enum.map(intents, &Ema.Intents.serialize/1), @columns,
              json: opts[:json]
            )

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
        case transport.call(Ema.Intents, :get_intent_detail, [id]) do
          {:ok, nil} -> Output.error("Intent #{id} not found")
          {:ok, intent} -> Output.detail(intent, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intents/#{id}") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
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
            tree = Enum.map(tree, &Ema.Intents.serialize_tree/1)
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

  def handle([:create], parsed, transport, opts) do
    attrs = %{
      title: parsed.args.title,
      level: parsed.options[:level] || 4,
      kind: parsed.options[:kind] || "task",
      project_id: parsed.options[:project],
      description: parsed.options[:description]
    }

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :create_intent, [attrs]) do
          {:ok, intent} -> Output.detail(Ema.Intents.serialize(intent), json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/intents", attrs) do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:status], parsed, transport, opts) do
    project = parsed.options[:project]

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :status_summary, [[project_id: project]]) do
          {:ok, summary} -> Output.detail(summary, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = if project, do: [project_id: project], else: []

        case transport.get("/intents/status", params: params) do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:context], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        detail = transport.call(Ema.Intents, :get_intent_detail, [id])
        print_context_result(detail, id, opts)

      Ema.CLI.Transport.Http ->
        case transport.get("/intents/#{id}") do
          {:ok, body} -> print_context(body["intent"] || body, opts)
          {:error, :not_found} -> Output.error("Intent #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:link], parsed, transport, opts) do
    id = parsed.args.id
    target = parsed.options[:depends_on]
    role = parsed.options[:role] || "related"

    unless target, do: Output.error("Missing --depends-on option")

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :link_intent, [id, "intent", target, [role: role]]) do
          {:ok, link} ->
            Output.detail(Ema.Intents.serialize_link(link), json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        body = %{linkable_type: "intent", linkable_id: target, role: role}

        case transport.post("/intents/#{id}/links", body) do
          {:ok, resp} -> Output.detail(resp, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:"attach-actor"], parsed, transport, opts) do
    id = parsed.args.id
    actor_id = parsed.options[:actor]

    unless actor_id, do: Output.error("Missing --actor option")

    body = %{
      actor_id: actor_id,
      role: parsed.options[:role] || "assignee",
      provenance: parsed.options[:provenance] || "manual"
    }

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :attach_actor, [
               id,
               actor_id,
               role: body.role,
               provenance: body.provenance
             ]) do
          {:ok, link} -> Output.detail(Ema.Intents.serialize_link(link), json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/intents/#{id}/actors", body) do
          {:ok, resp} -> Output.detail(resp, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:"attach-execution"], parsed, transport, opts) do
    id = parsed.args.id
    execution_id = parsed.options[:execution]

    unless execution_id, do: Output.error("Missing --execution option")

    body = %{
      execution_id: execution_id,
      role: parsed.options[:role] || "runtime",
      provenance: parsed.options[:provenance] || "execution"
    }

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :attach_execution, [
               id,
               execution_id,
               role: body.role,
               provenance: body.provenance
             ]) do
          {:ok, link} -> Output.detail(Ema.Intents.serialize_link(link), json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/intents/#{id}/executions", body) do
          {:ok, resp} -> Output.detail(resp, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:"attach-session"], parsed, transport, opts) do
    id = parsed.args.id
    session_id = parsed.options[:session]

    unless session_id, do: Output.error("Missing --session option")

    body = %{
      session_id: session_id,
      session_type: parsed.options[:session_type] || "claude_session",
      role: parsed.options[:role] || "runtime",
      provenance: parsed.options[:provenance]
    }

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :attach_session, [
               id,
               body.session_type,
               session_id,
               role: body.role,
               provenance: body.provenance
             ]) do
          {:ok, link} -> Output.detail(Ema.Intents.serialize_link(link), json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/intents/#{id}/sessions", body) do
          {:ok, resp} -> Output.detail(resp, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:runtime], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :get_runtime_bundle, [id]) do
          {:ok, nil} -> Output.error("Intent #{id} not found")
          {:ok, bundle} -> Output.detail(bundle, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intents/#{id}/runtime") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, :not_found} -> Output.error("Intent #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown intent subcommand: #{inspect(sub)}")
  end

  defp print_context_result({:ok, nil}, id, _opts), do: Output.error("Intent #{id} not found")
  defp print_context_result({:ok, detail}, _id, opts), do: print_context(detail, opts)
  defp print_context_result({:error, reason}, _id, _opts), do: Output.error(reason)
  defp print_context_result(nil, id, _opts), do: Output.error("Intent #{id} not found")

  defp print_context_result(detail, _id, opts) when is_map(detail),
    do: print_context(detail, opts)

  defp print_context(detail, opts) do
    if opts[:json] do
      Output.json(detail)
    else
      print_context_sections(detail)
    end
  end

  defp print_context_sections(detail) do
    title = detail[:title] || detail["title"] || "(untitled)"
    status = detail[:status] || detail["status"] || "unknown"
    level = detail[:level_name] || detail["level_name"] || "?"
    kind = detail[:kind] || detail["kind"] || "?"

    Output.info("\e[1m#{title}\e[0m")
    Output.info("  Status: #{status}  Level: #{level}  Kind: #{kind}")

    desc = detail[:description] || detail["description"]
    if desc, do: Output.info("  #{desc}")

    print_links_section(detail[:links] || detail["links"] || [])
    print_lineage_section(detail[:lineage] || detail["lineage"] || [])
  end

  defp print_links_section(links) do
    Output.info("\nLinks: (#{length(links)})")

    Enum.each(links, fn link ->
      type = link[:linkable_type] || link["linkable_type"] || "?"
      role = link[:role] || link["role"] || "related"
      lid = link[:linkable_id] || link["linkable_id"] || "?"
      Output.info("  #{role} -> #{type}:#{lid}")
    end)
  end

  defp print_lineage_section(events) do
    Output.info("\nLineage: (#{length(events)})")

    Enum.take(events, -10)
    |> Enum.each(fn event ->
      type = event[:event_type] || event["event_type"] || "?"
      actor = event[:actor] || event["actor"] || "system"
      ts = event[:inserted_at] || event["inserted_at"] || ""
      Output.info("  [#{ts}] #{type} (#{actor})")
    end)
  end

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)

  defp maybe_param(params, _key, nil), do: params
  defp maybe_param(params, key, val), do: [{key, val} | params]
end
