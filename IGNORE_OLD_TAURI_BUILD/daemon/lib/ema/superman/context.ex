defmodule Ema.Superman.Context do
  @moduledoc """
  Assembles a rich context bundle for a project — used by the HQ dashboard
  and any agent that needs a full situational picture of a project.
  """

  import Ecto.Query
  alias Ema.Repo

  @active_proposal_statuses ~w(queued reviewing approved)

  @doc """
  Build a full context map for a project, resolved by id or slug.

  ## Options
    * `:task_limit` — max recent tasks (default 10)
    * `:proposal_limit` — max active proposals (default 10)
    * `:note_limit` — max recent vault notes (default 10)
    * `:execution_limit` — max recent executions (default 5)
    * `:cluster_limit` — max brain dump clusters (default 10)
  """
  @spec for_project(String.t(), keyword()) :: {:ok, map()} | {:error, :not_found}
  def for_project(project_ref, opts \\ []) do
    case resolve_project(project_ref) do
      nil -> {:error, :not_found}
      project -> {:ok, build(project, opts)}
    end
  end

  # --- Resolution ---

  defp resolve_project(ref) do
    Ema.Projects.get_project(ref) || Ema.Projects.get_project_by_slug(ref)
  end

  # --- Assembly ---

  defp build(project, opts) do
    task_limit = Keyword.get(opts, :task_limit, 10)
    proposal_limit = Keyword.get(opts, :proposal_limit, 10)
    note_limit = Keyword.get(opts, :note_limit, 10)
    execution_limit = Keyword.get(opts, :execution_limit, 5)
    cluster_limit = Keyword.get(opts, :cluster_limit, 10)

    %{
      project: serialize_project(project),
      tasks: %{recent: recent_tasks(project.id, task_limit)},
      proposals: %{active: active_proposals(project.id, proposal_limit)},
      vault: %{recent_notes: recent_vault_notes(project.id, note_limit)},
      executions: %{recent: recent_executions(project.slug, execution_limit)},
      brain_dump: %{clusters: brain_dump_clusters(project.id, cluster_limit)},
      generated_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  # --- Project ---

  defp serialize_project(p) do
    %{
      id: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
      description: p.description,
      icon: p.icon,
      color: p.color,
      linked_path: p.linked_path,
      inserted_at: p.inserted_at,
      updated_at: p.updated_at
    }
  end

  # --- Tasks ---

  defp recent_tasks(project_id, limit) do
    Ema.Tasks.list_recent_by_project(project_id, limit)
    |> Enum.map(fn t ->
      %{
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        effort: t.effort,
        due_date: t.due_date,
        agent: t.agent,
        inserted_at: t.inserted_at,
        updated_at: t.updated_at
      }
    end)
  end

  # --- Proposals ---

  defp active_proposals(project_id, limit) do
    Ema.Proposals.Proposal
    |> where([p], p.project_id == ^project_id)
    |> where([p], p.status in @active_proposal_statuses)
    |> order_by([p], desc: p.inserted_at)
    |> limit(^limit)
    |> Repo.all()
    |> Enum.map(fn p ->
      %{
        id: p.id,
        title: p.title,
        summary: p.summary,
        status: p.status,
        confidence: p.confidence,
        pipeline_stage: p.pipeline_stage,
        quality_score: p.quality_score,
        inserted_at: p.inserted_at,
        updated_at: p.updated_at
      }
    end)
  end

  # --- Vault Notes ---

  defp recent_vault_notes(project_id, limit) do
    Ema.SecondBrain.Note
    |> where([n], n.project_id == ^project_id)
    |> order_by([n], desc: n.inserted_at)
    |> limit(^limit)
    |> Repo.all()
    |> Enum.map(fn n ->
      %{
        id: n.id,
        title: n.title,
        file_path: n.file_path,
        source_type: n.source_type,
        tags: n.tags,
        inserted_at: n.inserted_at,
        updated_at: n.updated_at
      }
    end)
  end

  # --- Executions ---

  defp recent_executions(project_slug, limit) do
    Ema.Executions.list_executions(project_slug: project_slug)
    |> Enum.take(limit)
    |> Enum.map(fn e ->
      %{
        id: e.id,
        title: e.title,
        status: e.status,
        mode: e.mode,
        started_at: e.inserted_at,
        completed_at: e.completed_at
      }
    end)
  end

  # --- Brain Dump Clusters ---

  defp brain_dump_clusters(project_id, limit) do
    Ema.Intelligence.IntentCluster
    |> where([c], c.project_id == ^project_id)
    |> order_by([c], desc: c.readiness_score)
    |> limit(^limit)
    |> Repo.all()
    |> Enum.map(fn c ->
      %{
        id: c.id,
        label: c.label,
        description: c.description,
        readiness_score: c.readiness_score,
        item_count: c.item_count,
        status: c.status,
        promoted: c.promoted,
        inserted_at: c.inserted_at
      }
    end)
  end
end
