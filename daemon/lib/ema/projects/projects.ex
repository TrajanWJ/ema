defmodule Ema.Projects do
  @moduledoc """
  Projects -- workspace with memory. Each project accumulates context,
  links tasks/proposals/sessions, and has a lifecycle from incubating to archived.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Intelligence.ContextStore
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
    build_context(project_id)
  end

  def build_context(project_id) when is_binary(project_id) do
    case get_project(project_id) do
      nil -> nil
      project -> build_project_context(project)
    end
  end

  def list_context_fragments(project_slug, opts \\ []) do
    ContextStore.list_fragments(project_slug, opts)
  end

  defp build_project_context(project) do
    # ── Tasks ──────────────────────────────────────────────────────────────────
    all_tasks = Ema.Tasks.list_by_project(project.id)
    task_by_status = Enum.group_by(all_tasks, & &1.status)

    recent_tasks =
      all_tasks
      |> Enum.sort_by(& &1.updated_at, {:desc, DateTime})
      |> Enum.take(10)

    # ── Proposals ──────────────────────────────────────────────────────────────
    all_proposals = Ema.Proposals.get_proposals_for_project(project.id)
    proposal_by_status = Enum.group_by(all_proposals, & &1.status)

    recent_proposals =
      all_proposals
      |> Enum.sort_by(& &1.updated_at, {:desc, DateTime})
      |> Enum.take(10)

    # ── Campaigns ──────────────────────────────────────────────────────────────
    campaigns = Ema.Campaigns.list_campaigns_for_project(project.id)
    active_campaign = Enum.find(campaigns, fn c -> c.status in ["forming", "ready", "running"] end)

    active_campaign_flow =
      if active_campaign,
        do: Ema.Campaigns.get_flow_by_campaign(active_campaign.id),
        else: nil

    # Enrich each campaign with its recent runs
    campaigns_with_runs =
      Enum.map(campaigns, fn c ->
        recent_runs = Ema.Campaigns.list_runs_for_campaign(c.id) |> Enum.take(3)
        %{
          id: c.id,
          name: c.name,
          description: c.description,
          status: c.status,
          run_count: c.run_count,
          step_count: length(c.steps || []),
          steps: Enum.map(c.steps || [], fn s ->
            %{id: s["id"], label: s["label"], type: s["type"]}
          end),
          inserted_at: c.inserted_at,
          recent_runs: Enum.map(recent_runs, fn r ->
            %{
              id: r.id,
              name: r.name,
              status: r.status,
              started_at: r.started_at,
              completed_at: r.completed_at
            }
          end)
        }
      end)

    # ── Executions ──────────────────────────────────────────────────────────────
    all_execs = Ema.Executions.list_executions(project_slug: project.slug)
    recent_execs = Enum.take(all_execs, 10)
    success_count = Enum.count(all_execs, &(&1.status == "completed"))
    failed_count  = Enum.count(all_execs, &(&1.status == "failed"))
    running_count = Enum.count(all_execs, &(&1.status in ["running", "approved", "delegated"]))

    success_rate =
      if length(all_execs) > 0, do: success_count / length(all_execs), else: 0.0

    # ── Reflexion / Learning ───────────────────────────────────────────────────
    reflexion_entries =
      try do
        Ema.Intelligence.ReflexionStore.list_recent(project_slug: project.slug, limit: 10)
      rescue
        _ -> []
      end

    reflexion_summary = %{
      total_lessons: length(reflexion_entries),
      recent: Enum.map(reflexion_entries, fn e ->
        %{
          agent: e.agent,
          domain: e.domain,
          lesson: String.slice(e.lesson, 0, 300),
          outcome_status: e.outcome_status,
          recorded_at: e.inserted_at
        }
      end)
    }

    # ── Open Gaps (blockers) ───────────────────────────────────────────────────
    open_gaps =
      try do
        Ema.Intelligence.GapInbox.list_gaps(project_id: project.id)
      rescue
        _ -> []
      end

    critical_gaps = Enum.filter(open_gaps, &(&1.severity in ["critical", "high"]))

    # ── Vault Notes ────────────────────────────────────────────────────────────
    vault_notes =
      Repo.all(
        from(n in Ema.SecondBrain.Note,
          where: n.project_id == ^project.id,
          order_by: [desc: n.inserted_at],
          limit: 5
        )
      )

    note_count =
      Repo.aggregate(
        from(n in Ema.SecondBrain.Note, where: n.project_id == ^project.id),
        :count
      )

    # ── Last Activity ──────────────────────────────────────────────────────────
    all_times =
      Enum.map(recent_tasks, & &1.updated_at) ++
        Enum.map(recent_proposals, & &1.updated_at) ++
        Enum.map(recent_execs, & &1.inserted_at)

    last_activity =
      if Enum.empty?(all_times), do: nil, else: Enum.max(all_times, DateTime)

    # ── System Health ──────────────────────────────────────────────────────────
    health_status =
      cond do
        length(critical_gaps) > 0 and running_count == 0 -> "blocked"
        running_count > 0 -> "active"
        active_campaign != nil -> "campaign_running"
        length(all_proposals) > 0 or length(all_tasks) > 0 -> "idle"
        true -> "empty"
      end

    %{
      project: %{
        id: project.id,
        slug: project.slug,
        name: project.name,
        status: project.status,
        description: project.description,
        icon: project.icon,
        color: project.color,
        linked_path: project.linked_path,
        created_at: project.inserted_at,
        updated_at: project.updated_at
      },
      tasks: %{
        total: length(all_tasks),
        by_status: Map.new(task_by_status, fn {k, v} -> {k, length(v)} end),
        recent:
          Enum.map(recent_tasks, fn t ->
            %{id: t.id, title: t.title, status: t.status, priority: t.priority, updated_at: t.updated_at}
          end)
      },
      proposals: %{
        total: length(all_proposals),
        by_status: Map.new(proposal_by_status, fn {k, v} -> {k, length(v)} end),
        recent:
          Enum.map(recent_proposals, fn p ->
            body_preview = if p.body, do: String.slice(p.body, 0, 200), else: nil
            %{
              id: p.id,
              title: p.title,
              summary: p.summary,
              body_preview: body_preview,
              status: p.status,
              confidence: p.confidence,
              pipeline_stage: p.pipeline_stage,
              quality_score: p.quality_score,
              updated_at: p.updated_at
            }
          end)
      },
      campaigns: campaigns_with_runs,
      active_campaign:
        if active_campaign do
          %{
            id: active_campaign.id,
            name: active_campaign.name,
            status: active_campaign.status,
            flow_state: if(active_campaign_flow, do: active_campaign_flow.state, else: nil),
            run_count: active_campaign.run_count,
            step_count: length(active_campaign.steps || [])
          }
        else
          nil
        end,
      intent_threads: [],
      executions: %{
        total: length(all_execs),
        running: running_count,
        succeeded: success_count,
        failed: failed_count,
        success_rate: Float.round(success_rate, 2),
        recent:
          Enum.map(recent_execs, fn e ->
            result_summary = get_in(e.metadata || %{}, ["result_summary"])
            %{
              id: e.id,
              title: e.title,
              mode: e.mode,
              status: e.status,
              intent_slug: e.intent_slug,
              project_slug: e.project_slug,
              requires_approval: e.requires_approval,
              result_summary: if(result_summary, do: String.slice(result_summary, 0, 300), else: nil),
              result_path: e.result_path,
              started_at: e.inserted_at,
              completed_at: e.completed_at
            }
          end)
      },
      reflexion: reflexion_summary,
      gaps: %{
        total_open: length(open_gaps),
        critical_count: length(critical_gaps),
        top_blockers:
          critical_gaps
          |> Enum.take(5)
          |> Enum.map(fn g ->
            %{id: g.id, title: g.title, severity: g.severity, gap_type: g.gap_type, source: g.source}
          end)
      },
      health: %{
        status: health_status,
        running_executions: running_count,
        active_campaign: active_campaign != nil,
        open_gaps: length(open_gaps),
        critical_gaps: length(critical_gaps)
      },
      stats: %{
        total_executions: length(all_execs),
        active_tasks: length(Map.get(task_by_status, "in_progress", [])),
        total_campaigns: length(campaigns),
        total_proposals: length(all_proposals)
      },
      vault: %{
        note_count: note_count,
        recent_notes:
          Enum.map(vault_notes, fn n ->
            %{id: n.id, title: n.title, file_path: n.file_path}
          end)
      },
      last_activity: last_activity,
      generated_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  defp generate_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "proj_#{timestamp}_#{random}"
  end
end
