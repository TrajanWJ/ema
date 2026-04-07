defmodule Ema.CLI.Commands.Project do
  @moduledoc "CLI commands for project management."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Slug", :slug},
    {"Name", :name},
    {"Space", :space_id},
    {"Status", :status},
    {"Updated", :updated_at}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter =
          Helpers.compact_keyword(
            status: parsed.options[:status],
            space_id: parsed.options[:space]
          )

        case transport.call(Ema.Projects, :list_projects, [filter]) do
          {:ok, projects} -> Output.render(projects, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params =
          Helpers.compact_keyword(
            status: parsed.options[:status],
            space_id: parsed.options[:space]
          )

        case transport.get("/projects", params: params) do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "projects"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    slug = parsed.args.slug

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Projects, :get_project_by_slug, [slug]) do
          {:ok, nil} -> Output.error("Project '#{slug}' not found")
          {:ok, project} -> Output.detail(project, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/projects/#{slug}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "project"), json: opts[:json])
          {:error, :not_found} -> Output.error("Project '#{slug}' not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    name = parsed.args.name

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:name, name},
            {:slug, parsed.options[:slug]},
            {:linked_path, parsed.options[:path]},
            {:github_repo_url, parsed.options[:repo]},
            {:description, parsed.options[:description]},
            {:space_id, parsed.options[:space]},
            {:parent_id, parsed.options[:parent]}
          ])

        case transport.call(Ema.Projects, :create_project, [attrs]) do
          {:ok, project} ->
            Output.success("Created project: #{project.name} (#{project.slug})")
            if opts[:json], do: Output.json(project)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body =
          Helpers.compact_map([
            {"name", name},
            {"slug", parsed.options[:slug]},
            {"linked_path", parsed.options[:path]},
            {"github_repo_url", parsed.options[:repo]},
            {"description", parsed.options[:description]},
            {"space_id", parsed.options[:space]},
            {"parent_id", parsed.options[:parent]}
          ])

        case transport.post("/projects", body) do
          {:ok, resp} ->
            p = Helpers.extract_record(resp, "project")
            Output.success("Created project: #{p["name"]}")
            if opts[:json], do: Output.json(p)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:update], parsed, transport, opts) do
    slug = parsed.args.slug

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Projects, :get_project_by_slug, [slug]) do
          {:ok, nil} ->
            Output.error("Project '#{slug}' not found")

          {:ok, project} ->
            attrs =
              Helpers.compact_map([
                {:name, parsed.options[:name]},
                {:description, parsed.options[:description]},
                {:linked_path, parsed.options[:path]},
                {:status, parsed.options[:status]}
              ])

            case transport.call(Ema.Projects, :update_project, [project, attrs]) do
              {:ok, updated} ->
                Output.success("Updated project: #{updated.name}")
                if opts[:json], do: Output.json(updated)

              {:error, reason} ->
                Output.error(inspect(reason))
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        body =
          Helpers.compact_map([
            {"name", parsed.options[:name]},
            {"description", parsed.options[:description]},
            {"linked_path", parsed.options[:path]},
            {"status", parsed.options[:status]}
          ])

        case transport.put("/projects/#{slug}", body) do
          {:ok, resp} ->
            p = Helpers.extract_record(resp, "project")
            Output.success("Updated project: #{p["name"] || slug}")
            if opts[:json], do: Output.json(p)

          {:error, :not_found} ->
            Output.error("Project '#{slug}' not found")

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:context], parsed, transport, opts) do
    slug = parsed.args.slug

    fetch_context = fn ->
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.Projects, :get_project_by_slug, [slug]) do
            {:ok, nil} -> {:error, :not_found}
            {:ok, project} -> transport.call(Ema.Projects, :get_context, [project])
            {:error, reason} -> {:error, reason}
          end

        Ema.CLI.Transport.Http ->
          case transport.get("/projects/#{slug}/context") do
            {:ok, body} -> {:ok, Helpers.extract_record(body, "context")}
            {:error, reason} -> {:error, reason}
          end
      end
    end

    case fetch_context.() do
      {:ok, ctx} ->
        if opts[:json] do
          Output.json(ctx)
        else
          render_context(ctx)
        end

      {:error, :not_found} ->
        Output.error("Project '#{slug}' not found")

      {:error, reason} ->
        Output.error(reason)
    end
  end

  defp render_context(ctx) do
    # Project header
    proj = ctx["project"] || ctx[:project] || %{}
    name = proj["name"] || proj[:name] || "?"
    status = proj["status"] || proj[:status] || "-"
    desc = proj["description"] || proj[:description] || ""
    path = proj["linked_path"] || proj[:linked_path] || "-"

    IO.puts("")
    IO.puts(IO.ANSI.bright() <> "  #{name}" <> IO.ANSI.reset() <> "  (#{status})")
    IO.puts("  #{String.slice(desc, 0, 80)}")
    IO.puts("  path: #{path}")
    IO.puts("")

    # Tasks summary
    tasks = ctx["tasks"] || ctx[:tasks] || []
    tasks = if is_list(tasks), do: tasks, else: [tasks]

    if length(tasks) > 0 do
      IO.puts(IO.ANSI.cyan() <> "  Tasks (#{length(tasks)})" <> IO.ANSI.reset())

      Enum.each(tasks, fn t ->
        title = t["title"] || t[:title] || "?"
        status = t["status"] || t[:status] || "-"
        prio = t["priority"] || t[:priority] || "-"
        marker = status_marker(status)
        IO.puts("    #{marker} [P#{prio}] #{String.slice(title, 0, 60)}")
      end)

      IO.puts("")
    end

    # Intents summary
    intents = ctx["intents"] || ctx[:intents] || []
    intents = if is_list(intents), do: intents, else: [intents]

    if length(intents) > 0 do
      by_level =
        intents
        |> Enum.group_by(fn i -> i["level_name"] || i[:level_name] || "?" end)

      IO.puts(IO.ANSI.cyan() <> "  Intents (#{length(intents)})" <> IO.ANSI.reset())

      Enum.each(["vision", "goal", "project", "feature", "task"], fn level ->
        items = Map.get(by_level, level, [])

        if length(items) > 0 do
          IO.puts("    #{level} (#{length(items)}):")

          Enum.each(items, fn i ->
            title = i["title"] || i[:title] || "?"
            status = i["status"] || i[:status] || "-"
            IO.puts("      #{status_marker(status)} #{String.slice(title, 0, 55)}")
          end)
        end
      end)

      IO.puts("")
    end

    # Proposals summary
    proposals = ctx["proposals"] || ctx[:proposals] || []
    proposals = if is_list(proposals), do: proposals, else: [proposals]

    if length(proposals) > 0 do
      IO.puts(IO.ANSI.cyan() <> "  Proposals (#{length(proposals)})" <> IO.ANSI.reset())

      Enum.each(proposals, fn p ->
        title = p["title"] || p[:title] || "?"
        status = p["status"] || p[:status] || "-"
        IO.puts("    #{status_marker(status)} #{String.slice(title, 0, 60)}")
      end)

      IO.puts("")
    end

    # Activity summary
    activity = ctx["recent_activity"] || ctx[:recent_activity] || %{}

    if map_size(activity) > 0 do
      window = activity["window_days"] || activity[:window_days] || 7
      sessions = activity["sessions"] || activity[:sessions] || 0
      proposals_n = activity["proposals"] || activity[:proposals] || 0
      execs = activity["executions"] || activity[:executions] || 0

      IO.puts(
        IO.ANSI.cyan() <> "  Activity (#{window}d)" <> IO.ANSI.reset() <>
          "  sessions=#{sessions}  proposals=#{proposals_n}  executions=#{execs}"
      )

      IO.puts("")
    end

    # Vault / wiki
    vault = ctx["vault_notes"] || ctx[:vault_notes] || []
    vault = if is_list(vault), do: vault, else: [vault]
    wiki = ctx["wiki_pages"] || ctx[:wiki_pages] || []
    wiki = if is_list(wiki), do: wiki, else: [wiki]

    if length(vault) > 0 or length(wiki) > 0 do
      IO.puts(
        IO.ANSI.cyan() <>
          "  Knowledge" <>
          IO.ANSI.reset() <> "  vault_notes=#{length(vault)}  wiki_pages=#{length(wiki)}"
      )

      IO.puts("")
    end
  end

  defp status_marker("done"), do: IO.ANSI.green() <> "✓" <> IO.ANSI.reset()
  defp status_marker("complete"), do: IO.ANSI.green() <> "✓" <> IO.ANSI.reset()
  defp status_marker("active"), do: IO.ANSI.cyan() <> "●" <> IO.ANSI.reset()
  defp status_marker("implementing"), do: IO.ANSI.yellow() <> "▶" <> IO.ANSI.reset()
  defp status_marker("todo"), do: "○"
  defp status_marker("queued"), do: "◌"
  defp status_marker("killed"), do: IO.ANSI.red() <> "✗" <> IO.ANSI.reset()
  defp status_marker(_), do: "·"

  def handle([:dependencies], parsed, transport, opts) do
    slug = parsed.args.slug

    case transport do
      Ema.CLI.Transport.Http ->
        case transport.get("/projects/#{slug}/tasks") do
          {:ok, body} ->
            task_cols = [
              {"ID", :id},
              {"Title", :title},
              {"Status", :status},
              {"Priority", :priority}
            ]

            Output.render(Helpers.extract_list(body, "tasks"), task_cols, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Projects, :get_project_by_slug, [slug]) do
          {:ok, nil} ->
            Output.error("Project '#{slug}' not found")

          {:ok, project} ->
            case transport.call(Ema.Tasks, :list_by_project, [project.id]) do
              {:ok, tasks} ->
                task_cols = [
                  {"ID", :id},
                  {"Title", :title},
                  {"Status", :status},
                  {"Priority", :priority}
                ]

                Output.render(tasks, task_cols, json: opts[:json])

              {:error, reason} ->
                Output.error(reason)
            end

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown project subcommand: #{inspect(sub)}")
  end
end
