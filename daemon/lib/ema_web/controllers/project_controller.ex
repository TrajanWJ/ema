defmodule EmaWeb.ProjectController do
  use EmaWeb, :controller

  alias Ema.Projects

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    projects =
      case params["status"] do
        nil -> Projects.list_projects()
        status -> Projects.list_by_status(status)
      end
      |> Enum.map(&serialize_project/1)

    json(conn, %{projects: projects})
  end

  def create(conn, params) do
    attrs = %{
      slug: params["slug"],
      name: params["name"],
      description: params["description"],
      status: params["status"],
      icon: params["icon"],
      color: params["color"],
      linked_path: params["linked_path"],
      settings: params["settings"],
      parent_id: params["parent_id"]
    }

    with {:ok, project} <- Projects.create_project(attrs) do
      EmaWeb.Endpoint.broadcast("projects:lobby", "project_created", serialize_project(project))

      conn
      |> put_status(:created)
      |> json(serialize_project(project))
    end
  end

  def show(conn, %{"id" => id}) do
    case Projects.get_project(id) do
      nil -> {:error, :not_found}
      project -> json(conn, serialize_project(project))
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Projects.get_project(id) do
      nil ->
        {:error, :not_found}

      project ->
        attrs = %{
          name: params["name"],
          description: params["description"],
          icon: params["icon"],
          color: params["color"],
          linked_path: params["linked_path"],
          settings: params["settings"]
        }

        with {:ok, updated} <- Projects.update_project(project, attrs) do
          EmaWeb.Endpoint.broadcast(
            "projects:#{id}",
            "project_updated",
            serialize_project(updated)
          )

          json(conn, serialize_project(updated))
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case Projects.get_project(id) do
      nil ->
        {:error, :not_found}

      project ->
        with {:ok, _} <- Projects.delete_project(project) do
          EmaWeb.Endpoint.broadcast("projects:lobby", "project_deleted", %{id: id})
          json(conn, %{ok: true})
        end
    end
  end

  def context(conn, %{"slug" => slug}) do
    case Projects.get_project_by_slug(slug) do
      nil ->
        {:error, :not_found}

      project ->
        # Assemble full context: project + executions + proposals + tasks + intent
        executions =
          Ema.Executions.list_executions(project_slug: project.slug)
          |> Enum.take(10)
          |> Enum.map(fn e ->
            %{id: e.id, title: e.title, mode: e.mode, status: e.status,
              completed_at: e.completed_at, inserted_at: e.inserted_at}
          end)

        proposals =
          Ema.Proposals.list_proposals(project_id: project.id)
          |> Enum.take(10)
          |> Enum.map(fn p ->
            %{id: p.id, title: p.title, status: p.status,
              confidence: p.confidence, inserted_at: p.inserted_at}
          end)

        tasks =
          Ema.Tasks.list_tasks()
          |> Enum.filter(fn t -> t.project_id == project.id end)
          |> Enum.take(20)
          |> Enum.map(fn t ->
            %{id: t.id, title: t.title, status: t.status,
              priority: t.priority, inserted_at: t.inserted_at}
          end)

        intent_nodes =
          Ema.Intelligence.IntentMap.list_nodes(project_id: project.id)
          |> Enum.map(fn n ->
            %{id: n.id, title: n.title, status: n.status, level: n.level}
          end)

        # Context document (if exists)
        context_path =
          Path.join([
            System.get_env("HOME", "~"),
            ".local/share/ema/projects",
            project.slug,
            "context.md"
          ])

        context_content =
          case File.read(context_path) do
            {:ok, content} -> content
            {:error, _} -> nil
          end

        json(conn, %{
          project: serialize_project(project),
          context: context_content,
          executions: executions,
          proposals: proposals,
          tasks: tasks,
          intent_threads: intent_nodes,
          stats: %{
            total_executions: length(executions),
            completed_executions: Enum.count(executions, &(&1.status == "completed")),
            open_proposals: Enum.count(proposals, &(&1.status in ["queued", "reviewing"])),
            active_tasks: Enum.count(tasks, &(&1.status in ["todo", "in_progress"])),
            intent_nodes: length(intent_nodes)
          }
        })
    end
  end

  defp serialize_project(project) do
    %{
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
      status: project.status,
      icon: project.icon,
      color: project.color,
      linked_path: project.linked_path,
      context_hash: project.context_hash,
      settings: project.settings,
      parent_id: project.parent_id,
      source_proposal_id: project.source_proposal_id,
      created_at: project.inserted_at,
      updated_at: project.updated_at
    }
  end
end
