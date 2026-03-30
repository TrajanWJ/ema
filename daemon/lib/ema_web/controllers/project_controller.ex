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
          EmaWeb.Endpoint.broadcast("projects:#{id}", "project_updated", serialize_project(updated))
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
        # Context document path based on slug
        context_path = Path.join([
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
          context_hash: project.context_hash
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
