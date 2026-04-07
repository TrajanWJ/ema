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
            {:space_id, parsed.options[:space]}
          ])

        case transport.call(Ema.Projects, :create_project, [attrs]) do
          {:ok, project} ->
            Output.success("Created project: #{project.name} (#{project.slug})")
            if opts[:json], do: Output.json(project)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "project" =>
            Helpers.compact_map([
              {"name", name},
              {"slug", parsed.options[:slug]},
              {"linked_path", parsed.options[:path]},
              {"github_repo_url", parsed.options[:repo]},
              {"description", parsed.options[:description]},
              {"space_id", parsed.options[:space]}
            ])
        }

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

  def handle([:context], parsed, transport, opts) do
    slug = parsed.args.slug

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Projects, :get_project_by_slug, [slug]) do
          {:ok, nil} ->
            Output.error("Project '#{slug}' not found")

          {:ok, project} ->
            case transport.call(Ema.Projects, :get_context, [project]) do
              {:ok, ctx} ->
                if opts[:json], do: Output.json(ctx), else: Output.detail(ctx)

              {:error, reason} ->
                Output.error(reason)
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/projects/#{slug}/context") do
          {:ok, body} ->
            ctx = Helpers.extract_record(body, "context")
            if opts[:json], do: Output.json(ctx), else: Output.detail(ctx)

          {:error, :not_found} ->
            Output.error("Project '#{slug}' not found")

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

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
