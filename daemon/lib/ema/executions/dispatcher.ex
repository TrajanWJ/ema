defmodule Ema.Executions.Dispatcher do
  @moduledoc """
  Subscribes to executions:dispatch and delegates approved executions to agents.

  Delegation packet format sent to agent:
    execution_id, project_slug, intent_slug, agent_role, objective,
    success_criteria, read_files, write_files, constraints, mode, requires_patchback
  """

  use GenServer
  require Logger

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "executions:dispatch")
    Logger.info("[Dispatcher] Ready — subscribed to executions:dispatch")
    {:ok, %{dispatched: 0, failed: 0}}
  end

  @impl true
  def handle_info({:dispatch, execution}, state) do
    Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
      dispatch_execution(execution)
    end)
    {:noreply, %{state | dispatched: state.dispatched + 1}}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  defp dispatch_execution(execution) do
    Logger.info("[Dispatcher] Dispatching #{execution.id}: #{execution.title} (mode: #{execution.mode})")

    packet = build_packet(execution)
    prompt = format_prompt(packet)

    case Ema.Executions.create_agent_session(execution.id, %{
      agent_role: packet.agent_role,
      status: "running",
      prompt_sent: prompt,
      started_at: DateTime.utc_now() |> DateTime.truncate(:second),
      metadata: %{packet: packet}
    }) do
      {:ok, agent_session} ->
        attempt_dispatch(execution, agent_session, prompt)
      {:error, reason} ->
        Logger.warning("[Dispatcher] Failed to create agent_session: #{inspect(reason)}")
        Ema.Executions.transition(execution, "failed")
    end
  end

  defp attempt_dispatch(execution, agent_session, prompt) do
    # OpenClaw dispatch — check client signature before calling
    # For now, route directly to local Claude (reliable path)
    # TODO: wire OpenClaw.Client when spawn_agent/2 is confirmed
    Ema.Executions.record_event(execution.id, "dispatch_started", %{mode: execution.mode})
    attempt_local_claude(execution, agent_session, prompt)
  end

  defp attempt_local_claude(execution, agent_session, prompt) do
    case Ema.Claude.AI.run(prompt) do
      {:ok, result} ->
        result_text = if is_map(result), do: Jason.encode!(result), else: to_string(result)
        Ema.Executions.complete_agent_session(agent_session.id, result_text)
        Ema.Executions.on_execution_completed(execution.id, result_text)

      {:error, reason} ->
        Logger.error("[Dispatcher] Local Claude fallback failed for #{execution.id}: #{inspect(reason)}")
        Ema.Executions.record_event(execution.id, "failed", %{reason: inspect(reason)})
        Ema.Executions.transition(execution, "failed")
    end
  end

  defp build_packet(execution) do
    intent_path = execution.intent_path || ".superman/intents/#{execution.intent_slug}"

    %{
      execution_id: execution.id,
      project_slug: execution.project_slug,
      intent_slug: execution.intent_slug,
      agent_role: mode_to_role(execution.mode),
      objective: execution.objective || execution.title,
      mode: execution.mode,
      requires_patchback: not is_nil(execution.intent_path),
      success_criteria: mode_success_criteria(execution.mode),
      read_files: [
        "#{intent_path}/intent.md",
        "#{intent_path}/signals.md",
        ".superman/project.md",
        ".superman/context.md"
      ] ++ mode_read_files(execution.mode, intent_path),
      write_files: mode_write_files(execution.mode, intent_path),
      constraints: [
        "Do not modify files outside the write_files list",
        "Be specific and concrete — no vague conclusions",
        "Write complete file contents, not diffs"
      ]
    }
  end

  defp mode_to_role("research"), do: "researcher"
  defp mode_to_role("outline"), do: "outliner"
  defp mode_to_role("review"), do: "reviewer"
  defp mode_to_role("refactor"), do: "refactorer"
  defp mode_to_role("harvest"), do: "harvester"
  defp mode_to_role(_), do: "implementer"

  defp mode_success_criteria("research") do
    [
      "Durable architecture principles extracted",
      "Minimal runtime model defined",
      "Unresolved questions listed",
      "Smallest viable implementation path identified"
    ]
  end
  defp mode_success_criteria("outline") do
    [
      "Filesystem structure defined",
      "Runtime schema specified",
      "Event flow documented",
      "App boundaries clear",
      "Build order established"
    ]
  end
  defp mode_success_criteria(_), do: ["Objective completed", "Output written to specified files"]

  defp mode_read_files("outline", intent_path), do: ["#{intent_path}/research.md"]
  defp mode_read_files(_, _), do: []

  defp mode_write_files("research", intent_path), do: ["#{intent_path}/research.md"]
  defp mode_write_files("outline", intent_path), do: ["#{intent_path}/outline.md", "#{intent_path}/decisions.md"]
  defp mode_write_files(_, intent_path), do: ["#{intent_path}/result.md"]

  defp format_prompt(packet) do
    """
    # EMA Execution Delegation Packet

    **Execution ID:** #{packet.execution_id}
    **Project:** #{packet.project_slug || "ema"}
    **Intent:** #{packet.intent_slug || "unlinked"}
    **Role:** #{packet.agent_role}
    **Mode:** #{packet.mode}

    ## Objective
    #{packet.objective}

    ## Success Criteria
    #{Enum.map_join(packet.success_criteria, "\n", fn c -> "- #{c}" end)}

    ## Files to Read First
    #{Enum.map_join(packet.read_files, "\n", fn f -> "- #{f}" end)}

    ## Files to Write
    #{Enum.map_join(packet.write_files, "\n", fn f -> "- #{f}" end)}

    ## Constraints
    #{Enum.map_join(packet.constraints, "\n", fn c -> "- #{c}" end)}

    #{if packet.requires_patchback, do: "**Note:** This execution requires patchback. Write complete file contents to each write target.", else: ""}

    Begin. Read the specified files, complete the objective, write outputs to specified paths.
    """
  end
end
