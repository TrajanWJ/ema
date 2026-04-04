defmodule Ema.Executions.Dispatcher do
  @moduledoc """
  Subscribes to executions:dispatch and delegates approved executions to agents.

  Delegation packet format sent to agent:
    execution_id, project_slug, intent_slug, agent_role, objective,
    success_criteria, read_files, write_files, constraints, mode, requires_patchback

  Context injection: before each dispatch, `Ema.Intelligence.ContextBuilder.build_context/1`
  assembles local context (recent outcomes, vault preferences, daily note, relevant notes)
  and prepends it to the prompt.

  Outcome recording: on completion, `Ema.Intelligence.OutcomeTracker.record/1` writes
  the execution result to ~/.local/share/ema/outcome-tracker.json.
  """

  use GenServer
  require Logger

  alias Ema.Executions.Router
  alias Ema.Intelligence.ContextBuilder
  alias Ema.Intelligence.OutcomeTracker

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
    base_prompt = format_prompt(packet)

    # Inject pre-dispatch context from local files
    prompt =
      try do
        context = ContextBuilder.build_context(execution)
        enriched = ContextBuilder.inject_context(base_prompt, context)
        if enriched != base_prompt do
          Logger.debug("[Dispatcher] Context injected for #{execution.id} (mode: #{execution.mode})")
        end
        enriched
      rescue
        e ->
          Logger.warning("[Dispatcher] ContextBuilder failed for #{execution.id}: #{inspect(e)} — using base prompt")
          base_prompt
      end

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
    Ema.Executions.record_event(execution.id, "dispatch_started", %{mode: execution.mode})
    # Mark running before blocking AI call so HQ shows in-progress immediately
    case Ema.Executions.transition(execution, "running") do
      {:ok, running_execution} ->
        attempt_local_claude(running_execution, agent_session, prompt)
      {:error, reason} ->
        Logger.warning("[Dispatcher] Could not transition to running: #{inspect(reason)}")
        attempt_local_claude(execution, agent_session, prompt)
    end
  end

  defp attempt_local_claude(execution, agent_session, prompt) do
    # 5 min timeout — delegation prompts are long and Claude needs time to read files + produce output
    case Ema.Claude.AI.run(prompt, timeout: 300_000) do
      {:ok, result} ->
        result_text = extract_result_text(result)
        Ema.Executions.complete_agent_session(agent_session.id, result_text)
        Ema.Executions.on_execution_completed(execution.id, result_text)
        # Record outcome for future context injection
        OutcomeTracker.record(execution)

      {:error, reason} ->
        Logger.error("[Dispatcher] Local Claude failed for #{execution.id}: #{inspect(reason)}")
        Ema.Executions.complete_agent_session(agent_session.id, "FAILED: #{inspect(reason)}")
        Ema.Executions.record_event(execution.id, "failed", %{reason: inspect(reason)})
        Ema.Executions.transition(execution, "failed")
        # Record failure outcome too
        failed_execution = %{execution | status: "failed"}
        OutcomeTracker.record(failed_execution)
    end
  end

  # Extract the clean result text from Claude's JSON output.
  # Claude returns {"result": "...", "type": "result", ...} — we want just the result field.
  defp extract_result_text(%{"result" => text}) when is_binary(text), do: text
  defp extract_result_text(%{"raw" => raw}) when is_binary(raw) do
    # The "raw" field may contain a warning prefix + JSON. Try to parse the JSON part.
    case Regex.run(~r/\{.*"result"\s*:\s*"/, raw) do
      nil -> raw
      _ ->
        # Find the JSON object in the raw output
        case Regex.run(~r/(\{[^\n]*"type"\s*:\s*"result"[^\n]*\})/, raw) do
          [_, json_str] ->
            case Jason.decode(json_str) do
              {:ok, %{"result" => text}} -> text
              _ -> raw
            end
          _ -> raw
        end
    end
  end
  defp extract_result_text(result) when is_map(result), do: Jason.encode!(result)
  defp extract_result_text(result), do: to_string(result)

  defp build_packet(execution) do
    intent_path = execution.intent_path || ".superman/intents/#{execution.intent_slug}"

    %{
      execution_id: execution.id,
      project_slug: execution.project_slug,
      intent_slug: execution.intent_slug,
      agent_role: Router.mode_to_role(execution.mode),
      objective: execution.objective || execution.title,
      mode: execution.mode,
      requires_patchback: not is_nil(execution.intent_path),
      success_criteria: Router.mode_success_criteria(execution.mode),
      read_files: [
        "#{intent_path}/intent.md",
        "#{intent_path}/signals.md",
        ".superman/project.md",
        ".superman/context.md"
      ] ++ Router.mode_read_files(execution.mode, intent_path),
      write_files: Router.mode_write_files(execution.mode, intent_path),
      constraints: [
        "Do not modify files outside the write_files list",
        "Be specific and concrete — no vague conclusions",
        "Write complete file contents, not diffs"
      ]
    }
  end

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
