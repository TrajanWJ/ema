defmodule EmaWeb.TeamPulseController do
  @moduledoc """
  Team Pulse — aggregates agent activity, execution counts, proposal throughput, and task velocity.
  """

  use EmaWeb, :controller

  alias Ema.Agents
  alias Ema.Tasks
  alias Ema.Proposals

  action_fallback EmaWeb.FallbackController

  # GET /api/team-pulse — overview dashboard
  def index(conn, _params) do
    agents = Agents.list_active_agents()
    agent_count = length(agents)

    task_counts = count_tasks_by_status()
    proposal_counts = count_proposals_by_status()

    json(conn, %{
      pulse: %{
        active_agents: agent_count,
        tasks: task_counts,
        proposals: proposal_counts,
        timestamp: DateTime.utc_now()
      }
    })
  end

  # GET /api/team-pulse/agents — per-agent activity breakdown
  def agents(conn, _params) do
    agents = Agents.list_active_agents()

    agent_stats =
      Enum.map(agents, fn agent ->
        %{
          slug: agent.slug,
          name: agent.name,
          status: agent.status,
          model: agent.model,
          created_at: agent.inserted_at,
          updated_at: agent.updated_at
        }
      end)

    json(conn, %{agents: agent_stats})
  end

  # GET /api/team-pulse/velocity — task completion velocity
  def velocity(conn, _params) do
    # Count tasks completed in the last 7 days and 30 days
    now = DateTime.utc_now()
    seven_days_ago = DateTime.add(now, -7 * 24 * 3600, :second)
    thirty_days_ago = DateTime.add(now, -30 * 24 * 3600, :second)

    all_tasks = safe_list_tasks()

    completed_7d =
      all_tasks
      |> Enum.filter(fn t ->
        t.status == "done" and not is_nil(t.updated_at) and
          DateTime.compare(t.updated_at, seven_days_ago) == :gt
      end)
      |> length()

    completed_30d =
      all_tasks
      |> Enum.filter(fn t ->
        t.status == "done" and not is_nil(t.updated_at) and
          DateTime.compare(t.updated_at, thirty_days_ago) == :gt
      end)
      |> length()

    total_open =
      all_tasks
      |> Enum.count(fn t -> t.status in ~w(open in_progress) end)

    json(conn, %{
      velocity: %{
        completed_7d: completed_7d,
        completed_30d: completed_30d,
        daily_avg_7d: if(completed_7d > 0, do: Float.round(completed_7d / 7, 1), else: 0),
        daily_avg_30d: if(completed_30d > 0, do: Float.round(completed_30d / 30, 1), else: 0),
        total_open: total_open
      }
    })
  end

  # GET /api/team-pulse/standups
  def standups(conn, _params) do
    json(conn, %{standups: []})
  end

  # POST /api/team-pulse/standups
  def create_standup(conn, _params) do
    json(conn, %{ok: true, message: "Standup recording not yet implemented"})
  end

  defp count_tasks_by_status do
    tasks = safe_list_tasks()

    %{
      open: Enum.count(tasks, &(&1.status == "open")),
      in_progress: Enum.count(tasks, &(&1.status == "in_progress")),
      done: Enum.count(tasks, &(&1.status == "done")),
      total: length(tasks)
    }
  end

  defp count_proposals_by_status do
    proposals = safe_list_proposals()

    %{
      queued: Enum.count(proposals, &(&1.status == "queued")),
      approved: Enum.count(proposals, &(&1.status == "approved")),
      killed: Enum.count(proposals, &(&1.status == "killed")),
      total: length(proposals)
    }
  end

  defp safe_list_tasks do
    if function_exported?(Tasks, :list_tasks, 0) do
      Tasks.list_tasks()
    else
      Tasks.list_tasks([])
    end
  rescue
    _ -> []
  end

  defp safe_list_proposals do
    if function_exported?(Proposals, :list_proposals, 0) do
      Proposals.list_proposals()
    else
      Proposals.list_proposals([])
    end
  rescue
    _ -> []
  end
end
