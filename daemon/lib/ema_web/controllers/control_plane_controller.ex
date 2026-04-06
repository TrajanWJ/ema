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
        "/api/executions",
        "/api/context/operator/package",
        "/api/context/project/:id/package"
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

  def operator_package(conn, _params) do
    host_truth = build_host_truth()
    projects = safe(fn -> Projects.list_projects() end, [])
    tasks = safe(fn -> Tasks.list_tasks() end, [])
    proposals = safe(fn -> Proposals.list_proposals(limit: 10) end, [])
    executions = safe(fn -> Executions.list_executions(limit: 20) end, [])

    package = %{
      contract_version: "v1",
      subject: %{kind: "operator", id: "host", title: "EMA operator context"},
      summary: %{
        one_line: host_truth.summary,
        status: host_truth.status,
        top_actionable_issue: List.first(host_truth.anomalies),
        recommended_next_step: recommended_next_step(host_truth)
      },
      host_truth: host_truth,
      projects: %{
        total: length(projects),
        items:
          Enum.map(projects, fn p ->
            %{
              id: p.id,
              slug: p.slug,
              name: p.name,
              linked_path: Map.get(p, :linked_path),
              updated_at: Map.get(p, :updated_at)
            }
          end)
      },
      tasks: %{
        total: length(tasks),
        priority_items:
          tasks
          |> Enum.sort_by(fn t -> {Map.get(t, :priority) || 999, Map.get(t, :updated_at)} end, :asc)
          |> Enum.take(5)
          |> Enum.map(&task_brief/1)
      },
      proposals: %{
        active:
          proposals
          |> Enum.take(5)
          |> Enum.map(&proposal_brief/1)
      },
      executions: %{
        failed_recent:
          executions
          |> Enum.filter(&(&1.status == "failed"))
          |> Enum.take(5)
          |> Enum.map(&execution_brief/1),
        running:
          executions
          |> Enum.filter(&(&1.status in ["running", "approved", "delegated", "created"]))
          |> Enum.take(5)
          |> Enum.map(&execution_brief/1)
      },
      sources: [
        %{kind: "endpoint", path_or_endpoint: "/api/status", confidence: "high"},
        %{kind: "endpoint", path_or_endpoint: "/api/surfaces/host-truth", confidence: "high"},
        %{kind: "endpoint", path_or_endpoint: "/api/projects", confidence: "high"},
        %{kind: "endpoint", path_or_endpoint: "/api/tasks", confidence: "high"},
        %{kind: "endpoint", path_or_endpoint: "/api/proposals", confidence: "high"},
        %{kind: "endpoint", path_or_endpoint: "/api/executions", confidence: "high"}
      ],
      budget: %{mode: "operator", truncated: false},
      generated_at: DateTime.utc_now() |> DateTime.truncate(:second)
    }

    json(conn, package)
  end

  def project_package(conn, %{"id" => id}) do
    project = safe(fn -> Projects.get_project(id) end, nil)

    case project do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found", message: "Project not found"})

      project ->
        ctx = safe(fn -> Projects.get_context(project.id) end, %{}) || %{}
        host_truth = build_host_truth()

        package = %{
          contract_version: "v1",
          subject: %{
            kind: "project",
            id: project.id,
            slug: Map.get(project, :slug),
            title: Map.get(project, :name)
          },
          summary: %{
            one_line: "#{project.name} context package built from host EMA project context and host truth.",
            status: host_truth.status,
            top_actionable_issue: List.first(host_truth.anomalies),
            recommended_next_step: recommended_next_step(host_truth)
          },
          host_truth: host_truth,
          project: %{
            id: project.id,
            slug: Map.get(project, :slug),
            name: Map.get(project, :name),
            description: Map.get(project, :description),
            linked_path: Map.get(project, :linked_path),
            updated_at: Map.get(project, :updated_at)
          },
          tasks: Map.get(ctx, :tasks, %{}),
          proposals: Map.get(ctx, :proposals, %{}),
          executions: Map.get(ctx, :executions, %{}),
          vault: Map.get(ctx, :vault, %{}),
          sources: [
            %{kind: "endpoint", path_or_endpoint: "/api/projects/#{project.id}/context", confidence: "high"},
            %{kind: "endpoint", path_or_endpoint: "/api/surfaces/host-truth", confidence: "high"}
          ],
          budget: %{mode: "standard", truncated: false},
          generated_at: DateTime.utc_now() |> DateTime.truncate(:second)
        }

        json(conn, package)
    end
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

  defp recommended_next_step(%{anomalies: [first | _]}) do
    cond do
      String.contains?(first, "Failed executions") -> "Inspect and classify failed executions before increasing autonomy."
      String.contains?(first, "High open proposal count") -> "Triage or collapse open proposals into a smaller actionable set."
      String.contains?(first, "Blocked") -> "Resolve blocked tasks before queue growth continues."
      true -> "Inspect host truth and narrow the main source of degradation."
    end
  end

  defp recommended_next_step(_), do: "Proceed with bounded task execution against host EMA."

  defp task_brief(t) do
    %{
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      agent: Map.get(t, :agent),
      updated_at: Map.get(t, :updated_at)
    }
  end

  defp proposal_brief(p) do
    %{
      id: p.id,
      title: p.title,
      status: p.status,
      confidence: Map.get(p, :confidence),
      updated_at: Map.get(p, :updated_at)
    }
  end

  defp execution_brief(e) do
    %{
      id: e.id,
      title: Map.get(e, :title),
      status: e.status,
      mode: Map.get(e, :mode),
      inserted_at: Map.get(e, :inserted_at),
      completed_at: Map.get(e, :completed_at)
    }
  end

  defp maybe_add(list, true, item), do: list ++ [item]
  defp maybe_add(list, false, _item), do: list

  defp safe(fun, fallback) do
    fun.()
  rescue
    _ -> fallback
  end
end
