defmodule EmaWeb.ExecutionController do
  use EmaWeb, :controller
  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    executions =
      Ema.Executions.list_executions(
        status: params["status"],
        intent_slug: params["intent_slug"],
        project_slug: params["project_slug"]
      )

    json(conn, %{executions: Enum.map(executions, &serialize/1)})
  end

  def show(conn, %{"id" => id}) do
    case Ema.Executions.get_execution(id) do
      nil -> conn |> put_status(404) |> json(%{error: "not found"})
      execution -> json(conn, %{execution: serialize(execution)})
    end
  end

  def create(conn, params) do
    case Ema.Executions.create(params) do
      {:ok, execution} ->
        conn |> put_status(201) |> json(%{execution: serialize(execution)})

      {:error, changeset} ->
        conn
        |> put_status(422)
        |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
    end
  end

  def approve(conn, %{"id" => id}) do
    case Ema.Executions.get_execution(id) do
      nil ->
        conn |> put_status(404) |> json(%{error: "not found"})

      execution
      when execution.status in ["running", "completed", "failed", "cancelled", "delegated"] ->
        # Already past approved — return current state, don't re-dispatch
        json(conn, %{execution: serialize(execution)})

      execution ->
        {:ok, updated} = Ema.Executions.approve_and_dispatch(execution)
        json(conn, %{execution: serialize(updated)})
    end
  end

  def cancel(conn, %{"id" => id}) do
    case Ema.Executions.get_execution(id) do
      nil ->
        conn |> put_status(404) |> json(%{error: "not found"})

      execution ->
        {:ok, updated} = Ema.Executions.transition(execution, "cancelled")
        json(conn, %{execution: serialize(updated)})
    end
  end

  def events(conn, %{"id" => id}) do
    events = Ema.Executions.list_events(id)

    json(conn, %{
      events:
        Enum.map(events, fn e ->
          %{id: e.id, type: e.type, actor_kind: e.actor_kind, payload: e.payload, at: e.at}
        end)
    })
  end

  def agent_sessions(conn, %{"id" => id}) do
    sessions = Ema.Executions.list_agent_sessions(id)

    json(conn, %{
      agent_sessions:
        Enum.map(sessions, fn s ->
          %{
            id: s.id,
            agent_role: s.agent_role,
            status: s.status,
            started_at: s.started_at,
            ended_at: s.ended_at,
            result_summary: s.result_summary
          }
        end)
    })
  end

  def diff(conn, %{"id" => id}) do
    case Ema.Executions.get_execution(id) do
      nil ->
        conn |> put_status(404) |> json(%{error: "not found"})

      execution ->
        {files_changed, lines_added, lines_removed} = parse_diff_stats(execution.git_diff)

        json(conn, %{
          execution_id: id,
          git_diff: execution.git_diff,
          files_changed: files_changed,
          lines_added: lines_added,
          lines_removed: lines_removed
        })
    end
  end

  defp parse_diff_stats(nil), do: {0, 0, 0}

  defp parse_diff_stats(diff) do
    lines = String.split(diff, "\n")
    files_changed = Enum.count(lines, &String.starts_with?(&1, "diff --git"))

    lines_added =
      lines
      |> Enum.filter(&(String.starts_with?(&1, "+") and not String.starts_with?(&1, "+++")))
      |> length()

    lines_removed =
      lines
      |> Enum.filter(&(String.starts_with?(&1, "-") and not String.starts_with?(&1, "---")))
      |> length()

    {files_changed, lines_added, lines_removed}
  end

  defp serialize(e) do
    %{
      id: e.id,
      title: e.title,
      objective: e.objective,
      mode: e.mode,
      status: e.status,
      project_slug: e.project_slug,
      intent_slug: e.intent_slug,
      intent_path: e.intent_path,
      result_path: e.result_path,
      requires_approval: e.requires_approval,
      brain_dump_item_id: e.brain_dump_item_id,
      proposal_id: e.proposal_id,
      task_id: e.task_id,
      session_id: e.session_id,
      metadata: e.metadata,
      completed_at: e.completed_at,
      inserted_at: e.inserted_at,
      updated_at: e.updated_at
    }
  end

  def complete(conn, %{"id" => id} = params) do
    result_summary = params["result_summary"] || ""

    case Ema.Executions.get_execution(id) do
      nil ->
        conn |> put_status(404) |> json(%{error: "not found"})

      execution ->
        case Ema.Executions.on_execution_completed(execution.id, result_summary) do
          {:ok, updated} -> json(conn, %{execution: serialize(updated)})
          {:error, :not_found} -> conn |> put_status(404) |> json(%{error: "not found"})
          {:error, reason} -> conn |> put_status(422) |> json(%{error: inspect(reason)})
        end
    end
  end

  def intent_status(conn, %{"project_slug" => project_slug, "intent_slug" => intent_slug}) do
    status = Ema.Executions.compute_intent_status(project_slug, intent_slug)
    json(conn, status)
  end

  def intent_status(conn, _params) do
    conn |> put_status(400) |> json(%{error: "project_slug and intent_slug required"})
  end
end
