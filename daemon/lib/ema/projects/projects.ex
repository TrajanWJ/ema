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

  def get_context(project_id) do
    case get_project(project_id) do
      nil -> nil
      project -> build_context(project)
    end
  end

  defp build_context(project) do
    all_tasks = Ema.Tasks.list_by_project(project.id)
    task_by_status = Enum.group_by(all_tasks, & &1.status)

    recent_tasks =
      all_tasks
      |> Enum.sort_by(& &1.updated_at, {:desc, DateTime})
      |> Enum.take(5)

    all_proposals = Ema.Proposals.get_proposals_for_project(project.id)
    proposal_by_status = Enum.group_by(all_proposals, & &1.status)

    recent_proposals =
      all_proposals
      |> Enum.sort_by(& &1.updated_at, {:desc, DateTime})
      |> Enum.take(3)

    all_execs = Ema.Executions.list_executions(project_slug: project.slug)
    recent_execs = Enum.take(all_execs, 5)
    success_count = Enum.count(all_execs, &(&1.status == "completed"))

    success_rate =
      if length(all_execs) > 0, do: success_count / length(all_execs), else: 0.0

    vault_notes =
      Repo.all(
        from(n in Ema.SecondBrain.Note,
          where: n.project_id == ^project.id,
          order_by: [desc: n.inserted_at],
          limit: 3
        )
      )

    note_count =
      Repo.aggregate(
        from(n in Ema.SecondBrain.Note, where: n.project_id == ^project.id),
        :count
      )

    all_times =
      Enum.map(recent_tasks, & &1.updated_at) ++
        Enum.map(recent_proposals, & &1.updated_at) ++
        Enum.map(recent_execs, & &1.inserted_at)

    last_activity =
      if Enum.empty?(all_times), do: nil, else: Enum.max(all_times, DateTime)

    %{
      project: %{
        id: project.id,
        name: project.name,
        status: project.status,
        description: project.description
      },
      tasks: %{
        total: length(all_tasks),
        by_status: Map.new(task_by_status, fn {k, v} -> {k, length(v)} end),
        recent:
          Enum.map(recent_tasks, fn t ->
            %{id: t.id, title: t.title, status: t.status, updated_at: t.updated_at}
          end)
      },
      proposals: %{
        total: length(all_proposals),
        by_status: Map.new(proposal_by_status, fn {k, v} -> {k, length(v)} end),
        recent:
          Enum.map(recent_proposals, fn p ->
            body_preview = if p.body, do: String.slice(p.body, 0, 200), else: nil
            %{id: p.id, body_preview: body_preview, status: p.status, updated_at: p.updated_at}
          end)
      },
      campaigns: nil,
      executions: %{
        recent:
          Enum.map(recent_execs, fn e ->
            %{id: e.id, status: e.status, started_at: e.inserted_at, completed_at: e.completed_at}
          end),
        success_rate: Float.round(success_rate, 2)
      },
      vault: %{
        note_count: note_count,
        recent_notes:
          Enum.map(vault_notes, fn n ->
            %{id: n.id, title: n.title, file_path: n.file_path}
          end)
      },
      last_activity: last_activity
    }
  end

  defp generate_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "proj_#{timestamp}_#{random}"
  end
end
