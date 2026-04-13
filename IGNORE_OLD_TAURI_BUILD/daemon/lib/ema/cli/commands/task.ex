defmodule Ema.CLI.Commands.Task do
  @moduledoc "CLI commands for task management."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Title", :title},
    {"Status", :status},
    {"Priority", :priority},
    {"Actor", :actor_id},
    {"Space", :space_id},
    {"Project", :project_id},
    {"Updated", :updated_at}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter_opts = build_filter_opts(parsed.options)

        case transport.call(Ema.Tasks, :list_tasks, [filter_opts]) do
          {:ok, tasks} -> Output.render(tasks, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = build_http_params(parsed.options)

        case transport.get("/tasks", params: params) do
          {:ok, body} -> Output.render(extract_list(body, "tasks"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Tasks, :get_with_subtasks, [id]) do
          {:ok, nil} ->
            Output.error("Task #{id} not found")

          {:ok, task} ->
            details = %{
              task: task,
              tags: Ema.Tags.list_for("task", to_string(id)),
              actor_data:
                Ema.EntityData.list_for("task", to_string(id), parsed.options[:actor] || "human")
            }

            Output.detail(details, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/tasks/#{id}") do
          {:ok, body} -> Output.detail(extract_record(body, "task"), json: opts[:json])
          {:error, :not_found} -> Output.error("Task #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    title = parsed.args.title
    depends_on = parse_depends_on(parsed.options[:depends_on])

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = %{title: title}
        attrs = maybe_put(attrs, :project_id, parsed.options[:project])
        attrs = maybe_put(attrs, :space_id, parsed.options[:space])
        attrs = maybe_put(attrs, :actor_id, parsed.options[:actor])
        attrs = maybe_put(attrs, :priority, parsed.options[:priority])
        attrs = maybe_put(attrs, :description, parsed.options[:description])

        case transport.call(Ema.Tasks, :create_task, [attrs]) do
          {:ok, task} ->
            if depends_on != [] do
              transport.call(Ema.Tasks, :set_dependencies, [task.id, depends_on])
            end

            Output.success("Created task ##{task.id}: #{task.title}")

            if depends_on != [] do
              Output.info("  Dependencies: #{Enum.join(depends_on, ", ")}")
            end

            if opts[:json], do: Output.json(task)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"title" => title}
        body = maybe_put(body, "project_id", parsed.options[:project])
        body = maybe_put(body, "space_id", parsed.options[:space])
        body = maybe_put(body, "actor_id", parsed.options[:actor])
        body = maybe_put(body, "priority", parsed.options[:priority])
        body = maybe_put(body, "description", parsed.options[:description])
        body = if depends_on != [], do: Map.put(body, "dependencies", depends_on), else: body

        case transport.post("/tasks", body) do
          {:ok, resp} ->
            task = extract_record(resp, "task")
            Output.success("Created task ##{task["id"]}: #{task["title"]}")
            if opts[:json], do: Output.json(task)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:ready], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter_opts = build_filter_opts(parsed.options)

        case transport.call(Ema.Tasks, :list_ready_tasks, [filter_opts]) do
          {:ok, tasks} ->
            tasks = sort_by_priority(tasks)

            if opts[:json] do
              Output.json(tasks)
            else
              print_ready_tasks(tasks, parsed.options[:assign], transport)
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = build_http_params(parsed.options) ++ [ready: true]

        case transport.get("/tasks", params: params) do
          {:ok, body} ->
            tasks = extract_list(body, "tasks")

            if opts[:json] do
              Output.json(tasks)
            else
              Output.render(tasks, @columns)
            end

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:update], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Tasks, :get_task, [id]) do
          {:ok, nil} ->
            Output.error("Task #{id} not found")

          {:ok, task} ->
            attrs = %{}
            attrs = maybe_put(attrs, :title, parsed.options[:title])
            attrs = maybe_put(attrs, :status, parsed.options[:status])
            attrs = maybe_put(attrs, :priority, parsed.options[:priority])
            attrs = maybe_put(attrs, :project_id, parsed.options[:project])
            attrs = maybe_put(attrs, :description, parsed.options[:description])

            case transport.call(Ema.Tasks, :update_task, [task, attrs]) do
              {:ok, updated} ->
                Output.success("Updated task ##{updated.id}")
                if opts[:json], do: Output.json(updated)

              {:error, reason} ->
                Output.error(inspect(reason))
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        body = %{}
        body = maybe_put(body, "title", parsed.options[:title])
        body = maybe_put(body, "status", parsed.options[:status])
        body = maybe_put(body, "priority", parsed.options[:priority])
        body = maybe_put(body, "project_id", parsed.options[:project])
        body = maybe_put(body, "description", parsed.options[:description])

        case transport.put("/tasks/#{id}", body) do
          {:ok, _} -> Output.success("Updated task ##{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:transition], parsed, transport, opts) do
    id = parsed.args.id
    status = parsed.args.status

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Tasks, :transition_status, [id, status]) do
          {:ok, task} ->
            Output.success("Task ##{task.id} → #{task.status}")
            if opts[:json], do: Output.json(task)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/tasks/#{id}/transition", %{"status" => status}) do
          {:ok, _} -> Output.success("Task ##{id} → #{status}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:comment], parsed, transport, opts) do
    id = parsed.args.id
    body = parsed.args.body

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = %{body: body, source: "cli"}

        case transport.call(Ema.Tasks, :add_comment, [id, attrs]) do
          {:ok, comment} ->
            Output.success("Comment added to task ##{id}")
            if opts[:json], do: Output.json(comment)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/tasks/#{id}/comments", %{"body" => body, "source" => "cli"}) do
          {:ok, _} -> Output.success("Comment added to task ##{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Tasks, :get_task, [id]) do
          {:ok, nil} ->
            Output.error("Task #{id} not found")

          {:ok, task} ->
            case transport.call(Ema.Tasks, :delete_task, [task]) do
              {:ok, _} -> Output.success("Deleted task ##{id}")
              {:error, reason} -> Output.error(inspect(reason))
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/tasks/#{id}") do
          {:ok, _} -> Output.success("Deleted task ##{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown task subcommand: #{inspect(sub)}")
  end

  # -- Helpers --

  defp build_filter_opts(options) do
    []
    |> maybe_append(:status, options[:status])
    |> maybe_append(:project_id, options[:project])
    |> maybe_append(:space_id, options[:space])
    |> maybe_append(:actor_id, options[:actor])
  end

  defp build_http_params(options) do
    []
    |> maybe_append(:status, options[:status])
    |> maybe_append(:project_id, options[:project])
    |> maybe_append(:space_id, options[:space])
    |> maybe_append(:actor_id, options[:actor])
    |> maybe_append(:limit, options[:limit])
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp maybe_append(list, _key, nil), do: list
  defp maybe_append(list, key, value), do: [{key, value} | list]

  defp parse_depends_on(nil), do: []

  defp parse_depends_on(str) when is_binary(str) do
    str
    |> String.split(",", trim: true)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp sort_by_priority(tasks) do
    Enum.sort_by(tasks, fn task ->
      priority = Map.get(task, :priority) || Map.get(task, "priority") || 5
      {priority, Map.get(task, :inserted_at)}
    end)
  end

  defp print_ready_tasks([], _assign, _transport) do
    IO.puts(IO.ANSI.faint() <> "No ready tasks." <> IO.ANSI.reset())
  end

  defp print_ready_tasks(tasks, assign_to, transport) do
    IO.puts("")
    IO.puts(IO.ANSI.bright() <> "  Ready Tasks" <> IO.ANSI.reset())
    IO.puts("  " <> String.duplicate("─", 50))

    Enum.each(tasks, fn task ->
      id = Map.get(task, :id) || Map.get(task, "id")
      title = Map.get(task, :title) || Map.get(task, "title") || "Untitled"
      priority = Map.get(task, :priority) || Map.get(task, "priority")
      project = Map.get(task, :project_id) || Map.get(task, "project_id")

      priority_badge = priority_label(priority)
      project_str = if project, do: " #{IO.ANSI.faint()}[#{project}]#{IO.ANSI.reset()}", else: ""

      IO.puts("    #{priority_badge} #{title}#{project_str}")
      IO.puts("      #{IO.ANSI.faint()}#{id}#{IO.ANSI.reset()}")
    end)

    IO.puts("")
    IO.puts("  #{IO.ANSI.faint()}#{length(tasks)} task(s) ready#{IO.ANSI.reset()}")

    if assign_to do
      assign_ready_tasks(tasks, assign_to, transport)
    end

    IO.puts("")
  end

  defp priority_label(nil), do: IO.ANSI.faint() <> "P-" <> IO.ANSI.reset()
  defp priority_label(1), do: IO.ANSI.red() <> "P1" <> IO.ANSI.reset()
  defp priority_label(2), do: IO.ANSI.yellow() <> "P2" <> IO.ANSI.reset()
  defp priority_label(3), do: IO.ANSI.cyan() <> "P3" <> IO.ANSI.reset()
  defp priority_label(n), do: IO.ANSI.faint() <> "P#{n}" <> IO.ANSI.reset()

  defp assign_ready_tasks(tasks, agent_slug, transport) do
    IO.puts("")
    IO.puts("  Assigning #{length(tasks)} task(s) to #{agent_slug}...")

    Enum.each(tasks, fn task ->
      id = Map.get(task, :id) || Map.get(task, "id")

      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.Tasks, :get_task, [id]) do
            {:ok, t} when not is_nil(t) ->
              transport.call(Ema.Tasks, :update_task, [t, %{actor_id: agent_slug}])
              Output.success("  Assigned #{id} → #{agent_slug}")

            _ ->
              Output.warn("  Could not find task #{id}")
          end

        Ema.CLI.Transport.Http ->
          case transport.put("/tasks/#{id}", %{"actor_id" => agent_slug}) do
            {:ok, _} -> Output.success("  Assigned #{id} → #{agent_slug}")
            {:error, reason} -> Output.error("  Failed #{id}: #{inspect(reason)}")
          end
      end
    end)
  end

  defp extract_list(body, key), do: Helpers.extract_list(body, key)
  defp extract_record(body, key), do: Helpers.extract_record(body, key)
end
