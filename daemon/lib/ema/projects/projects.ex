defmodule Ema.Projects do
  @moduledoc """
  Projects -- workspace with memory. Each project accumulates context,
  links tasks/proposals/sessions, and has a lifecycle from incubating to archived.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Projects.Project

  def list_projects do
    Project |> order_by(asc: :name) |> Repo.all()
  end

  def list_by_status(status) do
    Project
    |> where([p], p.status == ^status)
    |> order_by(asc: :name)
    |> Repo.all()
  end

  def get_project(id), do: Repo.get(Project, id)

  def get_project!(id), do: Repo.get!(Project, id)

  def get_project_by_slug(slug) do
    Repo.get_by(Project, slug: slug)
  end

  def create_project(attrs) do
    id = generate_id()

    %Project{}
    |> Project.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_project(%Project{} = project, attrs) do
    project
    |> Project.changeset(attrs)
    |> Repo.update()
  end

  def transition_status(%Project{} = project, new_status) do
    if Project.valid_transition?(project.status, new_status) do
      project
      |> Project.changeset(%{status: new_status})
      |> Repo.update()
    else
      {:error, :invalid_transition}
    end
  end

  def delete_project(%Project{} = project) do
    Repo.delete(project)
  end

  defp generate_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "proj_#{timestamp}_#{random}"
  end
end
