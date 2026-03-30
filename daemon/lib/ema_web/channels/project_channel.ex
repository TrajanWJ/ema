defmodule EmaWeb.ProjectChannel do
  use Phoenix.Channel

  alias Ema.Projects

  @impl true
  def join("projects:lobby", _payload, socket) do
    projects =
      Projects.list_projects()
      |> Enum.map(&serialize_project/1)

    {:ok, %{projects: projects}, socket}
  end

  @impl true
  def join("projects:" <> id, _payload, socket) do
    case Projects.get_project(id) do
      nil ->
        {:error, %{reason: "not_found"}}

      project ->
        {:ok, %{project: serialize_project(project)}, socket}
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
