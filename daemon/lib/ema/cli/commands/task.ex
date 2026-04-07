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
            Output.success("Created task ##{task.id}: #{task.title}")
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
        body = maybe_put(body, "description", parsed.options[:description])

        case transport.put("/tasks/#{id}", %{"task" => body}) do
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

  defp extract_list(body, key), do: Helpers.extract_list(body, key)
  defp extract_record(body, key), do: Helpers.extract_record(body, key)
end
