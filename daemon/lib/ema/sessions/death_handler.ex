defmodule Ema.Sessions.DeathHandler do
  @moduledoc """
  Subscribes to session lifecycle events and handles unexpected session death.

  When a session ends (via SessionMonitor :session_inactive or SessionWatcher
  status change to completed/abandoned), this handler:

  1. Fetches the last checkpoint for the session
  2. Assesses whether the linked execution completed
  3. Takes one of three actions:
     - **Complete** — execution finished, mark done
     - **Interrupted** — execution was mid-flight, create continuation
     - **Failed** — execution errored out, log and mark failed
  """

  use GenServer
  require Logger

  alias Ema.Sessions.{Checkpointer, Resumption}
  alias Ema.{ClaudeSessions, Executions}

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  # --- Callbacks ---

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "claude_sessions")
    {:ok, %{}}
  end

  @impl true
  def handle_info({:session_detected, %{session_id: sid, status: status}}, state)
      when status in ["completed", "abandoned"] do
    handle_session_end(sid, status)
    {:noreply, state}
  end

  @impl true
  def handle_info({:session_inactive, %{project_dir: dir}}, state) do
    handle_inactive_project(dir)
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Internal ---

  defp handle_session_end(session_id, watcher_status) do
    case ClaudeSessions.get_session(session_id) do
      nil ->
        Logger.debug("[DeathHandler] Session #{session_id} not in DB, ignoring")

      session ->
        checkpoint = Checkpointer.latest_checkpoint(session_id)
        execution = resolve_execution(session, checkpoint)
        assess_and_act(session, execution, checkpoint, watcher_status)
    end
  rescue
    e ->
      Logger.warning(
        "[DeathHandler] Error handling session #{session_id}: #{Exception.message(e)}"
      )
  end

  defp handle_inactive_project(project_dir) do
    # Find active sessions for this project dir and check if they ended
    ClaudeSessions.get_active_sessions()
    |> Enum.filter(fn s -> s.project_path == project_dir end)
    |> Enum.each(fn session ->
      handle_session_end(session.session_id, "inactive")
    end)
  end

  defp resolve_execution(session, checkpoint) do
    # Try checkpoint's execution_id first, then session lookup
    cond do
      checkpoint && is_binary(checkpoint.execution_id) ->
        Executions.get_execution(checkpoint.execution_id)

      true ->
        Executions.get_by_session(session.id) ||
          case session.session_id do
            "exec_" <> eid -> Executions.get_execution(eid)
            _ -> nil
          end
    end
  end

  defp assess_and_act(_session, nil, _checkpoint, _status) do
    # No linked execution — nothing to do
    :ok
  end

  defp assess_and_act(session, execution, checkpoint, watcher_status) do
    outcome = assess_outcome(execution, session, watcher_status)
    Logger.info("[DeathHandler] Session #{session.session_id} outcome: #{outcome}")

    case outcome do
      :complete ->
        handle_complete(execution)

      :interrupted ->
        handle_interrupted(execution, checkpoint)

      :failed ->
        handle_failed(execution, checkpoint)
    end
  end

  defp assess_outcome(execution, _session, watcher_status) do
    cond do
      # Already marked complete by the execution system
      execution.status == "completed" ->
        :complete

      # Session completed normally and execution was running
      watcher_status == "completed" and execution.status == "running" ->
        # Check if there's a meaningful git diff suggesting work was done
        has_result = is_binary(execution.result_path) and execution.result_path != ""
        if has_result, do: :complete, else: :interrupted

      # Session abandoned or went inactive while execution in-flight
      execution.status in ["running", "delegated", "approved"] ->
        :interrupted

      # Execution was in a failed state
      execution.status in ["failed", "preflight_failed"] ->
        :failed

      # Catch-all: if session died during any active status, treat as interrupted
      watcher_status in ["abandoned", "inactive"] and
          execution.status not in ["completed", "cancelled"] ->
        :interrupted

      true ->
        :complete
    end
  end

  defp handle_complete(execution) do
    if execution.status != "completed" do
      Executions.transition(execution, "completed")
    end

    Executions.record_event(execution.id, "session_completed", %{
      handler: "death_handler",
      outcome: "complete"
    })
  end

  defp handle_interrupted(execution, checkpoint) do
    Executions.transition(execution, "failed")

    Executions.record_event(execution.id, "session_interrupted", %{
      handler: "death_handler",
      outcome: "interrupted",
      checkpoint_id: if(checkpoint, do: checkpoint.id),
      files_modified: if(checkpoint, do: checkpoint.files_modified, else: [])
    })

    # Create a continuation execution with checkpoint context
    if checkpoint do
      create_continuation(execution, checkpoint)
    end
  end

  defp handle_failed(execution, checkpoint) do
    Executions.record_event(execution.id, "session_failed", %{
      handler: "death_handler",
      outcome: "failed",
      checkpoint_id: if(checkpoint, do: checkpoint.id)
    })

    Logger.warning(
      "[DeathHandler] Execution #{execution.id} failed — session died with status #{execution.status}"
    )
  end

  defp create_continuation(original, checkpoint) do
    handoff = Resumption.build_handoff_prompt(checkpoint)

    attrs = %{
      title: "[cont] #{original.title}",
      objective: handoff,
      mode: original.mode,
      status: "created",
      project_slug: original.project_slug,
      intent_slug: original.intent_slug,
      intent_path: original.intent_path,
      requires_approval: true,
      actor_id: original.actor_id,
      metadata: %{
        "continuation_of" => original.id,
        "checkpoint_id" => checkpoint.id,
        "auto_created" => true
      }
    }

    case Executions.create(attrs) do
      {:ok, continuation} ->
        Logger.info(
          "[DeathHandler] Created continuation execution #{continuation.id} for #{original.id}"
        )

        Executions.record_event(original.id, "continuation_created", %{
          continuation_id: continuation.id
        })

      {:error, reason} ->
        Logger.warning(
          "[DeathHandler] Failed to create continuation for #{original.id}: #{inspect(reason)}"
        )
    end
  end
end
