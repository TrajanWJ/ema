defmodule Ema.Executions do
  @moduledoc """
  The Executions context — the runtime connective tissue between intent and outcome.

  An Execution is the first-class runtime object linking:
    brain dump item → intent folder → proposal → agent session → harvested result

  Invariants:
  - Intent (.superman/intents/<slug>/) is semantic, slow-changing, durable
  - Execution is runtime, fast-changing, disposable
  - All agent delegation goes through structured packets
  - Results patch back into intent files
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Executions.{Execution, Event, AgentSession}
  require Logger

  # ── Public API ──────────────────────────────────────────────────────────────

  def list_executions(opts \\ []) do
    Execution
    |> order_by([e], desc: e.inserted_at)
    |> maybe_filter(:status, opts[:status])
    |> maybe_filter(:intent_slug, opts[:intent_slug])
    |> maybe_filter(:project_slug, opts[:project_slug])
    |> Repo.all()
  end

  def get_execution(id), do: Repo.get(Execution, id)
  def get_execution!(id), do: Repo.get!(Execution, id)

  def get_by_proposal(proposal_id),
    do: Repo.get_by(Execution, proposal_id: proposal_id)

  def get_by_session(session_id),
    do: Repo.get_by(Execution, session_id: session_id)

  def get_by_brain_dump_item(item_id),
    do: Repo.get_by(Execution, brain_dump_item_id: item_id)

  def create(attrs) do
    id = generate_id()

    %Execution{}
    |> Execution.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_ok(fn execution ->
      record_event(execution.id, "created", %{mode: execution.mode, intent_slug: execution.intent_slug})
      broadcast("execution:created", execution)
    end)
  end

  def transition(execution, new_status) do
    execution
    |> Execution.changeset(%{status: new_status})
    |> Repo.update()
    |> tap_ok(fn updated ->
      record_event(updated.id, "status_changed", %{from: execution.status, to: new_status})
      broadcast("execution:updated", updated)
    end)
  end

  def link_proposal(brain_dump_item_id, proposal_id) do
    case get_by_brain_dump_item(brain_dump_item_id) do
      nil ->
        Logger.warning("[Executions] No execution for brain_dump_item #{brain_dump_item_id}")
        {:error, :not_found}

      execution ->
        execution
        |> Execution.changeset(%{proposal_id: proposal_id, status: "proposed"})
        |> Repo.update()
        |> tap_ok(fn updated ->
          record_event(updated.id, "proposal_linked", %{proposal_id: proposal_id})
          broadcast("execution:updated", updated)
        end)
    end
  end

  def on_proposal_approved(proposal_id) do
    execution = get_by_proposal(proposal_id)

    execution =
      if is_nil(execution) do
        proposal = Ema.Proposals.get_proposal(proposal_id)

        if proposal do
          case create(%{
            title: proposal.title,
            objective: proposal.summary || proposal.body,
            mode: infer_mode_from_proposal(proposal),
            status: "created",
            proposal_id: proposal_id,
            project_slug: proposal.project_id,
            requires_approval: false
          }) do
            {:ok, ex} -> ex
            _ -> nil
          end
        end
      else
        execution
      end

    if execution do
      {:ok, updated} = transition(execution, "approved")
      dispatch_if_ready(updated)
      {:ok, updated}
    else
      {:error, :no_execution}
    end
  end

  def link_session(execution_id, session_id) do
    case get_execution(execution_id) do
      nil ->
        {:error, :not_found}

      execution ->
        execution
        |> Execution.changeset(%{session_id: session_id, status: "running"})
        |> Repo.update()
        |> tap_ok(fn updated ->
          record_event(updated.id, "session_linked", %{session_id: session_id})
          broadcast("execution:updated", updated)
        end)
    end
  end

  def on_session_completed(session_id, result_summary) do
    case get_by_session(session_id) do
      nil ->
        Logger.debug("[Executions] No execution for session #{session_id}")
        :ok

      execution ->
        signal = infer_signal(result_summary)

        execution
        |> Execution.changeset(%{
          status: "completed",
          completed_at: DateTime.utc_now() |> DateTime.truncate(:second),
          metadata: Map.put(execution.metadata, "result_summary", result_summary)
        })
        |> Repo.update()
        |> tap_ok(fn updated ->
          record_event(updated.id, "completed", %{signal: signal})
          broadcast("execution:completed", %{execution: updated, signal: signal})
          patch_intent_file(updated, result_summary)
        end)
    end
  end

  def on_execution_completed(execution_id, result_summary) do
    case get_execution(execution_id) do
      nil ->
        Logger.warning("[Executions] on_execution_completed: no execution #{execution_id}")
        {:error, :not_found}
      execution ->
        signal = infer_signal(result_summary)
        execution
        |> Execution.changeset(%{
          status: "completed",
          completed_at: DateTime.utc_now() |> DateTime.truncate(:second),
          metadata: Map.put(execution.metadata, "result_summary", result_summary)
        })
        |> Repo.update()
        |> tap_ok(fn updated ->
          record_event(updated.id, "completed", %{signal: signal})
          broadcast("execution:completed", %{execution: updated, signal: signal})
          patch_intent_file(updated, result_summary)
        end)
    end
  end

    # ── Events ───────────────────────────────────────────────────────────────────

  def list_events(execution_id) do
    Event
    |> where([e], e.execution_id == ^execution_id)
    |> order_by([e], asc: e.at)
    |> Repo.all()
  end

  def record_event(execution_id, type, payload \\ %{}) do
    %Event{}
    |> Event.changeset(%{
      id: generate_id(),
      execution_id: execution_id,
      type: type,
      actor_kind: "system",
      payload: payload,
      at: DateTime.utc_now() |> DateTime.truncate(:second)
    })
    |> Repo.insert()
    |> case do
      {:ok, _} -> :ok
      {:error, reason} ->
        Logger.warning("[Executions] Failed to record event #{type}: #{inspect(reason)}")
        :error
    end
  end

  # ── Agent Sessions ────────────────────────────────────────────────────────────

  def create_agent_session(execution_id, attrs) do
    %AgentSession{}
    |> AgentSession.changeset(
      attrs
      |> Map.put(:id, generate_id())
      |> Map.put(:execution_id, execution_id)
    )
    |> Repo.insert()
  end

  def list_agent_sessions(execution_id) do
    AgentSession
    |> where([s], s.execution_id == ^execution_id)
    |> order_by([s], desc: s.inserted_at)
    |> Repo.all()
  end

  def complete_agent_session(session_id, result_summary) do
    case Repo.get_by(AgentSession, id: session_id) do
      nil -> {:error, :not_found}
      session ->
        session
        |> AgentSession.changeset(%{
          status: "completed",
          result_summary: result_summary,
          ended_at: DateTime.utc_now() |> DateTime.truncate(:second)
        })
        |> Repo.update()
    end
  end

  # ── Private ──────────────────────────────────────────────────────────────────

  defp maybe_filter(query, _field, nil), do: query
  defp maybe_filter(query, field, value), do: where(query, [e], field(e, ^field) == ^value)

  defp broadcast(event, payload) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "executions", {event, payload})
  end

  defp generate_id do
    :crypto.strong_rand_bytes(8) |> Base.url_encode64(padding: false)
  end

  defp tap_ok({:ok, val} = result, fun) do
    fun.(val)
    result
  end
  defp tap_ok(error, _fun), do: error

  defp infer_mode_from_proposal(proposal) do
    body = String.downcase((proposal.body || "") <> " " <> (proposal.summary || ""))
    cond do
      String.contains?(body, ["research", "investigate", "explore", "study"]) -> "research"
      String.contains?(body, ["refactor", "clean up", "simplify", "improve"]) -> "refactor"
      String.contains?(body, ["review", "audit", "check", "assess"]) -> "review"
      String.contains?(body, ["outline", "plan", "design", "architect"]) -> "outline"
      true -> "implement"
    end
  end

  defp infer_signal(nil), do: "failed"
  defp infer_signal(""), do: "failed"
  defp infer_signal(s) when byte_size(s) < 50, do: "partial"
  defp infer_signal(_), do: "success"

  defp dispatch_if_ready(%{requires_approval: false} = execution) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "executions:dispatch", {:dispatch, execution})
  end
  defp dispatch_if_ready(_), do: :ok

    def compute_intent_status(project_slug, intent_slug) do
    # Get all executions, group by mode (latest per mode)
    all_execs = Execution
      |> where([e], e.project_slug == ^project_slug and e.intent_slug == ^intent_slug)
      |> order_by([e], [e.mode, desc: e.inserted_at])
      |> Repo.all()

    if Enum.empty?(all_execs) do
      %{
        status: "idle",
        modes_executed: %{},
        completion_pct: 0,
        last_updated: DateTime.utc_now() |> DateTime.to_iso8601()
      }
    else
      # Group by mode, keep latest of each
      execs_by_mode =
        all_execs
        |> Enum.uniq_by(& &1.mode)
        |> Map.new(fn exec -> {exec.mode, exec.status} end)

      # Latest execution for ID and timestamp
      latest = List.first(all_execs)

      # Compute status using 3 signals
      status = compute_phase_status(execs_by_mode)

      %{
        status: status,
        modes_executed: execs_by_mode,
        latest_execution_id: latest.id,
        completion_pct: estimate_phase_completion(execs_by_mode),
        last_updated: latest.updated_at |> DateTime.to_iso8601()
      }
    end
  end

  defp compute_phase_status(execs_by_mode) do
    cond do
      Enum.any?(execs_by_mode, fn {_mode, status} -> status == "running" end) ->
        "in_progress"

      execs_by_mode["implement"] == "completed" ->
        "completed"

      true ->
        cond do
          execs_by_mode["review"] == "failed" -> "review_blocked"
          execs_by_mode["outline"] == "completed" -> "outlined"
          execs_by_mode["research"] == "completed" -> "researched"
          execs_by_mode["implement"] == "failed" -> "implementation_blocked"
          true -> "idle"
        end
    end
  end

  defp estimate_phase_completion(execs_by_mode) do
    case execs_by_mode do
      %{"implement" => "completed"} -> 100
      %{"research" => "completed"} -> 50
      %{"outline" => "completed"} -> 25
      %{"review" => "running"} -> 75
      %{"implement" => "running"} -> 60
      _ -> 0
    end
  end

  defp execution_to_status("completed"), do: "completed"
  defp execution_to_status("failed"), do: "blocked"
  defp execution_to_status("running"), do: "in_progress"
  defp execution_to_status(status), do: status

  defp estimate_completion("completed"), do: 100
  defp estimate_completion("running"), do: 50
  defp estimate_completion("approved"), do: 10
  defp estimate_completion(_), do: 0


  defp patch_intent_file(%{intent_path: nil}, _), do: :ok
  defp patch_intent_file(%{intent_path: ""}, _), do: :ok
  defp patch_intent_file(execution, result_summary) do
    project_path = resolve_project_path(execution.project_slug) || File.cwd!()
    slug = execution.intent_slug || Path.basename(execution.intent_path)

    case Ema.Executions.IntentFolder.append_log(project_path, slug, execution.id, execution.mode, result_summary) do
      :ok -> :ok
      {:error, reason} -> Logger.error("[IntentFolder] append_log failed for #{slug}: #{inspect(reason)}")
    end
  end
  defp resolve_project_path(nil), do: nil
  defp resolve_project_path(slug) do
    case Ema.Projects.get_project(slug) do
      nil -> nil
      project -> project.path
    end
  end
end
