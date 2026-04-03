defmodule Ema.Pipeline do
  @moduledoc """
  Pipeline analytics — aggregates metrics across Proposals and Tasks contexts.
  Provides stats, bottleneck detection, and throughput tracking.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Proposals.{Proposal, Seed}
  alias Ema.Tasks.Task

  @doc """
  Returns counts at each pipeline stage: seeds, proposals by status, tasks by status,
  and active Claude sessions.
  """
  def get_pipeline_stats do
    %{
      seeds: count_seeds(),
      proposals: count_proposals_by_status(),
      tasks: count_tasks_by_status(),
      active_sessions: count_active_sessions()
    }
  end

  @doc """
  Finds proposals stuck at a stage for more than 1 hour.
  Returns a list of maps with proposal info and how long they've been stuck.
  """
  def get_bottlenecks do
    one_hour_ago = DateTime.utc_now() |> DateTime.add(-3600, :second)

    Proposal
    |> where([p], p.status not in ["approved", "killed", "redirected"])
    |> where([p], p.updated_at < ^one_hour_ago)
    |> order_by([p], asc: :updated_at)
    |> Repo.all()
    |> Enum.map(fn proposal ->
      stuck_minutes =
        DateTime.diff(DateTime.utc_now(), proposal.updated_at, :second)
        |> div(60)

      %{
        id: proposal.id,
        title: proposal.title,
        status: proposal.status,
        stuck_minutes: stuck_minutes,
        updated_at: proposal.updated_at,
        project_id: proposal.project_id
      }
    end)
  end

  @doc """
  Counts items completed per period over the last 7 days.
  Period can be :hour, :day, or :week.

  Returns a list of maps with `period_start` and `count`.
  """
  def get_throughput(period) when period in [:hour, :day, :week] do
    seven_days_ago = DateTime.utc_now() |> DateTime.add(-7 * 86_400, :second)

    approved_proposals =
      Proposal
      |> where([p], p.status in ["approved", "redirected"])
      |> where([p], p.updated_at >= ^seven_days_ago)
      |> select([p], p.updated_at)
      |> Repo.all()

    completed_tasks =
      Task
      |> where([t], t.status == "done")
      |> where([t], t.updated_at >= ^seven_days_ago)
      |> select([t], t.updated_at)
      |> Repo.all()

    all_timestamps = approved_proposals ++ completed_tasks

    all_timestamps
    |> Enum.group_by(&truncate_to_period(&1, period))
    |> Enum.map(fn {period_start, items} ->
      %{period_start: period_start, count: length(items)}
    end)
    |> Enum.sort_by(& &1.period_start, DateTime)
  end

  # --- Private ---

  defp count_seeds do
    Seed
    |> select([s], count(s.id))
    |> Repo.one()
  end

  defp count_proposals_by_status do
    Proposal
    |> group_by([p], p.status)
    |> select([p], {p.status, count(p.id)})
    |> Repo.all()
    |> Map.new()
  end

  defp count_tasks_by_status do
    Task
    |> group_by([t], t.status)
    |> select([t], {t.status, count(t.id)})
    |> Repo.all()
    |> Map.new()
  end

  defp count_active_sessions do
    case Code.ensure_loaded(Ema.ClaudeSessions) do
      {:module, _} ->
        Ema.ClaudeSessions.get_active_sessions() |> length()

      {:error, _} ->
        0
    end
  end

  defp truncate_to_period(datetime, :hour) do
    %{datetime | minute: 0, second: 0, microsecond: {0, 0}}
  end

  defp truncate_to_period(datetime, :day) do
    %{datetime | hour: 0, minute: 0, second: 0, microsecond: {0, 0}}
  end

  defp truncate_to_period(datetime, :week) do
    day_of_week = Date.day_of_week(DateTime.to_date(datetime))
    days_since_monday = day_of_week - 1

    datetime
    |> DateTime.add(-days_since_monday * 86_400, :second)
    |> then(&%{&1 | hour: 0, minute: 0, second: 0, microsecond: {0, 0}})
  end
end
