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
  alias Ema.Executions.{Execution, Event, AgentSession, Router}
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
    # Normalize to string keys so Ecto changeset doesn't get mixed atom/string maps
    attrs = attrs |> Map.new(fn {k, v} -> {to_string(k), v} end) |> Map.put("id", id)

    %Execution{}
    |> Execution.changeset(attrs)
    |> Repo.insert()
    |> tap_ok(fn execution ->
      record_event(execution.id, "created", %{mode: execution.mode, intent_slug: execution.intent_slug})
      broadcast("execution:created", execution)
      # Auto-dispatch when no approval needed
      if not execution.requires_approval do
        {:ok, approved} = transition(execution, "approved")
        dispatch_if_ready(approved)
      end
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
            mode: Router.infer_mode_from_text((proposal.body || "") <> " " <> (proposal.summary || "")),
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
        signal = Router.classify_outcome(result_summary)

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
        signal = Router.classify_outcome(result_summary)
        result_path = write_result_artifact(execution, result_summary)

        execution
        |> Execution.changeset(%{
          status: "completed",
          completed_at: DateTime.utc_now() |> DateTime.truncate(:second),
          result_path: result_path,
          metadata: Map.put(execution.metadata || %{}, "result_summary", result_summary)
        })
        |> Repo.update()
        |> tap_ok(fn updated ->
          record_event(updated.id, "completed", %{signal: signal, result_path: result_path})
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

  # ── Public: Approval & Cancellation ─────────────────────────────────────────

  def approve_execution(id) do
    case get_execution(id) do
      nil -> {:error, :not_found}
      execution ->
        case transition(execution, "approved") do
          {:ok, updated} ->
            dispatch_if_ready(updated)
            {:ok, updated}
          error -> error
        end
    end
  end

  def cancel_execution(id) do
    case get_execution(id) do
      nil -> {:error, :not_found}
      execution -> transition(execution, "cancelled")
    end
  end

  @doc """
  Approve an execution and dispatch it. Idempotent — guards against
  re-dispatching an execution that is already running or past approval.
  """
  def approve_and_dispatch(execution) do
    case execution.status do
      s when s in ["running", "completed", "failed", "cancelled", "delegated"] ->
        {:ok, execution}
      _ ->
        {:ok, approved} = transition(execution, "approved")
        dispatch_if_ready(approved)
        {:ok, approved}
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

  defp dispatch_if_ready(%{requires_approval: false, status: "approved"} = execution) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "executions:dispatch", {:dispatch, execution})
  end
  defp dispatch_if_ready(_), do: :ok

  # ── Intent Status ─────────────────────────────────────────────────────────────
  # Computes intent progress from accumulated execution history across modes.
  # "latest execution wins" is wrong — a failed retry after success isn't blocked.
  # Rules:
  #   - cancelled executions never count
  #   - any active execution → in_progress (overrides everything)
  #   - implement completed → completed (100%), regardless of review/refactor outcome
  #   - outline completed → outlined (75%), even if subsequent runs failed
  #   - research completed → researched (40%), even if retries failed
  #   - all failed, none active → blocked (0%)
  #   - otherwise fall through to raw execution status

  def compute_intent_status(project_slug, intent_slug) do
    active_statuses = ~w(running approved delegated harvesting)

    executions =
      Execution
      |> where([e], e.project_slug == ^project_slug and e.intent_slug == ^intent_slug)
      |> where([e], e.status != "cancelled")
      |> order_by([e], desc: e.inserted_at)
      |> Repo.all()

    if executions == [] do
      %{
        status: "idle",
        latest_execution_id: nil,
        modes_executed: %{},
        completion_pct: 0,
        last_updated: DateTime.utc_now() |> DateTime.to_iso8601()
      }
    else
      # Best terminal outcome per mode (completed beats failed for same mode)
      completed_modes = executions
        |> Enum.filter(&(&1.status == "completed"))
        |> Enum.map(&(&1.mode))
        |> MapSet.new()

      # Latest status per mode (for modes_executed map — useful for UI)
      modes_executed = executions
        |> Enum.uniq_by(&(&1.mode))
        |> Map.new(fn e -> {e.mode, e.status} end)

      active = Enum.find(executions, fn e -> e.status in active_statuses end)
      latest = hd(executions)

      {status, pct} = cond do
        active != nil                                -> {"in_progress", 50}
        MapSet.member?(completed_modes, "implement") -> {"completed", 100}
        MapSet.member?(completed_modes, "outline")   -> {"outlined", 75}
        MapSet.member?(completed_modes, "research")  -> {"researched", 40}
        latest.status == "failed"                    -> {"blocked", 0}
        true -> {execution_to_status(latest.status), estimate_completion(latest.status)}
      end

      %{
        status: status,
        latest_execution_id: latest.id,
        modes_executed: modes_executed,
        completion_pct: pct,
        last_updated: latest.updated_at |> DateTime.to_iso8601()
      }
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


  # Always write a result artifact to disk, regardless of intent_path.
  # Returns the path written, or nil on failure.
  defp write_result_artifact(execution, result_summary) do
    results_dir = Path.join([results_base_dir(), execution.id])

    case File.mkdir_p(results_dir) do
      :ok ->
        path = Path.join(results_dir, "result.md")
        now = DateTime.utc_now() |> DateTime.to_iso8601()

        content = """
        # Execution Result

        **Execution ID:** #{execution.id}
        **Title:** #{execution.title}
        **Mode:** #{execution.mode}
        **Project:** #{execution.project_slug || "unlinked"}
        **Completed:** #{now}

        ---

        #{result_summary}
        """

        case File.write(path, content) do
          :ok ->
            Logger.info("[Executions] Result written to #{path}")
            path
          {:error, reason} ->
            Logger.error("[Executions] Failed to write result to #{path}: #{inspect(reason)}")
            nil
        end

      {:error, reason} ->
        Logger.error("[Executions] Failed to create results dir #{results_dir}: #{inspect(reason)}")
        nil
    end
  end

  defp results_base_dir do
    Path.join([System.get_env("HOME", "/tmp"), ".local", "share", "ema", "results"])
  end

  defp patch_intent_file(%{intent_path: nil}, _), do: :ok
  defp patch_intent_file(%{intent_path: ""}, _), do: :ok
  defp patch_intent_file(execution, result_summary) do
    project_path = resolve_project_path(execution.project_slug) || File.cwd!()
    slug = execution.intent_slug || Path.basename(execution.intent_path)

    case Ema.Executions.IntentFolder.append_log(project_path, slug, execution.id, execution.mode, result_summary) do
      :ok -> :ok
      {:error, reason} -> Logger.error("[IntentFolder] append_log failed for #{slug}: #{inspect(reason)}")
    end

    case Ema.Executions.IntentFolder.write_result(project_path, slug, result_summary) do
      :ok -> :ok
      {:error, reason} -> Logger.error("[IntentFolder] write_result failed for #{slug}: #{inspect(reason)}")
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
