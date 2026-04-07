defmodule Ema.Pipeline do
  @moduledoc """
  Pipeline Commander — aggregate stats across the AI task pipeline.
  Reads from proposals, tasks, and claude_sessions to show funnel metrics.
  """

  import Ecto.Query
  alias Ema.Repo

  @doc """
  Returns counts at each pipeline stage: seeds, proposals by status,
  tasks by status, and active sessions.
  """
  def get_pipeline_stats do
    seed_counts = count_seeds()
    proposal_counts = count_proposals_by_status()
    task_counts = count_tasks_by_status()
    session_counts = count_sessions_by_status()

    %{
      seeds: %{
        active: seed_counts[:active] || 0,
        inactive: seed_counts[:inactive] || 0,
        total: Map.values(seed_counts) |> Enum.sum()
      },
      proposals: %{
        queued: proposal_counts["queued"] || 0,
        reviewing: proposal_counts["reviewing"] || 0,
        approved: proposal_counts["approved"] || 0,
        redirected: proposal_counts["redirected"] || 0,
        killed: proposal_counts["killed"] || 0,
        total: Map.values(proposal_counts) |> Enum.sum()
      },
      tasks: %{
        backlog: task_counts["backlog"] || 0,
        ready: task_counts["ready"] || 0,
        in_progress: task_counts["in_progress"] || 0,
        done: task_counts["done"] || 0,
        total: Map.values(task_counts) |> Enum.sum()
      },
      sessions: %{
        active: session_counts["active"] || 0,
        completed: session_counts["completed"] || 0,
        total: Map.values(session_counts) |> Enum.sum()
      }
    }
  end

  @doc """
  Identifies pipeline bottlenecks — stages where items have been stuck too long.
  Returns a list of %{stage, count, oldest_age_minutes}.
  """
  def get_bottlenecks do
    now = DateTime.utc_now()
    threshold = DateTime.add(now, -3600, :second)

    bottlenecks = []

    # Proposals stuck in queued for >1hr
    queued_stuck =
      from(p in "proposals",
        where: p.status == "queued" and p.updated_at < ^threshold,
        select: %{count: count(), oldest: min(p.updated_at)}
      )
      |> Repo.one()

    bottlenecks =
      if queued_stuck && queued_stuck.count > 0 do
        age = DateTime.diff(now, queued_stuck.oldest, :minute)

        [
          %{stage: "proposals_queued", count: queued_stuck.count, oldest_age_minutes: age}
          | bottlenecks
        ]
      else
        bottlenecks
      end

    # Tasks stuck in ready for >1hr
    tasks_stuck =
      from(t in "tasks",
        where: t.status == "ready" and t.updated_at < ^threshold,
        select: %{count: count(), oldest: min(t.updated_at)}
      )
      |> Repo.one()

    bottlenecks =
      if tasks_stuck && tasks_stuck.count > 0 do
        age = DateTime.diff(now, tasks_stuck.oldest, :minute)
        [%{stage: "tasks_ready", count: tasks_stuck.count, oldest_age_minutes: age} | bottlenecks]
      else
        bottlenecks
      end

    bottlenecks
  end

  @doc """
  Returns throughput stats: how many items moved through each stage
  in the given period (:hour, :day, :week).
  """
  def get_throughput(period \\ :day) do
    since = period_start(period)

    proposals_created =
      from(p in "proposals", where: p.inserted_at >= ^since, select: count())
      |> Repo.one() || 0

    proposals_approved =
      from(p in "proposals",
        where: p.status == "approved" and p.updated_at >= ^since,
        select: count()
      )
      |> Repo.one() || 0

    tasks_completed =
      from(t in "tasks",
        where: t.status == "done" and t.updated_at >= ^since,
        select: count()
      )
      |> Repo.one() || 0

    %{
      period: period,
      since: since,
      proposals_created: proposals_created,
      proposals_approved: proposals_approved,
      tasks_completed: tasks_completed
    }
  end

  # --- Private helpers ---

  defp count_seeds do
    from(s in "seeds",
      group_by: s.active,
      select: {s.active, count()}
    )
    |> Repo.all()
    |> Enum.into(%{}, fn {active, count} ->
      key = if active, do: :active, else: :inactive
      {key, count}
    end)
  end

  defp count_proposals_by_status do
    from(p in "proposals",
      group_by: p.status,
      select: {p.status, count()}
    )
    |> Repo.all()
    |> Enum.into(%{})
  end

  defp count_tasks_by_status do
    from(t in "tasks",
      group_by: t.status,
      select: {t.status, count()}
    )
    |> Repo.all()
    |> Enum.into(%{})
  end

  defp count_sessions_by_status do
    from(s in "claude_sessions",
      group_by: s.status,
      select: {s.status, count()}
    )
    |> Repo.all()
    |> Enum.into(%{})
  end

  defp period_start(:hour), do: DateTime.add(DateTime.utc_now(), -3600, :second)
  defp period_start(:day), do: DateTime.add(DateTime.utc_now(), -86400, :second)
  defp period_start(:week), do: DateTime.add(DateTime.utc_now(), -604_800, :second)
end
