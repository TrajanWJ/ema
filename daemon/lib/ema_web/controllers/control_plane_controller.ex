defmodule EmaWeb.ControlPlaneController do
  use EmaWeb, :controller

  alias Ema.{Projects, Tasks, Proposals, Executions}

  def status(conn, _params) do
    json(conn, build_status())
  end

  def surfaces(conn, _params) do
    json(conn, %{
      host_truth: build_host_truth(),
      gateway: gateway_status(),
      peers: [],
      sessions: %{claude: [], codex: [], total: 0},
      available_endpoints: [
        "/api/status",
        "/api/surfaces",
        "/api/surfaces/host-truth",
        "/api/surfaces/gateway",
        "/api/projects",
        "/api/tasks",
        "/api/proposals",
        "/api/executions"
      ],
      compat: true
    })
  end

  def host_truth(conn, _params) do
    json(conn, build_host_truth())
  end

  def gateway(conn, _params) do
    json(conn, gateway_status())
  end

  def peers(conn, _params) do
    json(conn, %{peers: [], count: 0, compat: true})
  end

  defp build_status do
    host_truth = build_host_truth()

    %{
      status: host_truth.status,
      summary: host_truth.summary,
      counts: host_truth.counts,
      subsystems: %{
        gateway: gateway_status(),
        openclaw: %{status: "unknown"},
        superman: %{status: subsystem_status(host_truth)},
        honcho: %{status: subsystem_status(host_truth)}
      },
      recent: %{
        top_actionable_issue: List.first(host_truth.anomalies),
        anomalies: host_truth.anomalies
      },
      compat: true
    }
  end

  defp build_host_truth do
    projects = safe(fn -> Projects.list_projects() end, [])
    tasks = safe(fn -> Tasks.list_tasks() end, [])
    proposals = safe(fn -> Proposals.list_proposals() end, [])
    executions = safe(fn -> Executions.list_executions(limit: 200) end, [])

    running_execs = Enum.filter(executions, &(&1.status in ["running", "approved", "delegated", "created"]))
    failed_execs = Enum.filter(executions, &(&1.status == "failed"))
    open_proposals = Enum.filter(proposals, &(&1.status in [nil, "queued", "generated", "refined", "debated"]))
    blocked_tasks = Enum.filter(tasks, &(&1.status in ["blocked", "waiting"]))

    anomalies =
      []
      |> maybe_add(length(running_execs) >= 25, "High running execution count: #{length(running_execs)}")
      |> maybe_add(length(open_proposals) >= 50, "High open proposal count: #{length(open_proposals)}")
      |> maybe_add(length(failed_execs) >= 5, "Failed executions present: #{length(failed_execs)}")
      |> maybe_add(length(blocked_tasks) >= 5, "Blocked/waiting tasks present: #{length(blocked_tasks)}")

    status =
      cond do
        length(running_execs) >= 25 or length(open_proposals) >= 50 -> "degraded"
        length(failed_execs) >= 5 -> "degraded"
        true -> "ok"
      end

    %{
      status: status,
      summary: summary_for(status, length(running_execs), length(open_proposals), length(failed_execs)),
      counts: %{
        active_projects: length(projects),
        pending_tasks: length(Enum.filter(tasks, &(&1.status not in ["done", "cancelled", "killed"]))),
        open_proposals: length(open_proposals),
        running_agents: length(running_execs),
        failed_executions: length(failed_execs)
      },
      anomalies: anomalies,
      queue: %{
        running_execution_ids: Enum.take(Enum.map(running_execs, & &1.id), 10),
        blocked_task_ids: Enum.take(Enum.map(blocked_tasks, & &1.id), 10)
      },
      observed_at: DateTime.utc_now() |> DateTime.truncate(:second)
    }
  end

  defp gateway_status do
    %{status: "unknown", connected: nil, compat: true}
  end

  defp subsystem_status(%{status: "ok"}), do: "ok"
  defp subsystem_status(_), do: "degraded"

  defp summary_for("ok", running, proposals, failed),
    do: "EMA host healthy — #{running} running executions, #{proposals} open proposals, #{failed} failed executions"

  defp summary_for(_status, running, proposals, failed),
    do: "EMA host degraded — #{running} running executions, #{proposals} open proposals, #{failed} failed executions"

  defp maybe_add(list, true, item), do: list ++ [item]
  defp maybe_add(list, false, _item), do: list

  defp safe(fun, fallback) do
    fun.()
  rescue
    _ -> fallback
  end
end
