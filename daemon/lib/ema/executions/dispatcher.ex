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

  alias Ema.Executions.{Execution, Router}
  alias Ema.Feedback.Broadcast
  alias Ema.Intelligence.ContextBuilder
  alias Ema.Intelligence.OutcomeTracker
  alias Ema.Intelligence.ReflexionInjector
  alias Ema.Intelligence.ScopeAdvisor
  alias Ema.Superman
  alias Ema.Vault.VaultBridge

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
    Logger.info(
      "[Dispatcher] Dispatching #{execution.id}: #{execution.title} (mode: #{execution.mode})"
    )

    packet = build_packet(execution)
    base_prompt = format_prompt(packet)

    # Scope check — warn if recent outcomes show repeated failures
    scope_meta =
      try do
        result = ScopeAdvisor.check(packet.agent_role, execution.mode, execution.title)
        ScopeAdvisor.to_metadata(result)
      rescue
        _ -> %{"warn" => false, "reason" => nil}
      end

    if scope_meta["warn"] do
      Logger.warning("[Dispatcher] ScopeAdvisor: #{scope_meta["reason"]}")
      Ema.Executions.record_event(execution.id, "scope_warning", scope_meta)
    end

    # Inject pre-dispatch context from local files
    prompt =
      try do
        context = ContextBuilder.build_context(execution)
        enriched = ContextBuilder.inject_context(base_prompt, context)

        enriched =
          prepend_project_intelligence(enriched, execution.project_slug)

        if enriched != base_prompt do
          Logger.debug(
            "[Dispatcher] Context injected for #{execution.id} (mode: #{execution.mode})"
          )
        end

        enriched
      rescue
        e ->
          Logger.warning(
            "[Dispatcher] ContextBuilder failed for #{execution.id}: #{inspect(e)} — using base prompt"
          )

          base_prompt
      end

    # Inject project memory context doc (tasks, proposals, execution history)
    prompt =
      try do
        project_id = execution.project_id || execution.project_slug

        if is_binary(project_id) and project_id != "" do
          case Ema.Projects.ProjectWorker.get_context(project_id) do
            {:ok, context_doc} when is_binary(context_doc) and context_doc != "" ->
              Logger.debug(
                "[Dispatcher] Project context doc injected for #{execution.id} (project: #{project_id})"
              )

              context_doc <> "\n\n---\n\n" <> prompt

            _ ->
              prompt
          end
        else
          prompt
        end
      rescue
        e ->
          Logger.warning(
            "[Dispatcher] ProjectWorker context injection failed for #{execution.id}: #{inspect(e)}"
          )

          prompt
      end

    # Inject reflexion lessons from past executions
    prompt =
      try do
        prefix =
          ReflexionInjector.build_prefix(
            packet.agent_role || "default",
            execution.mode || "code",
            execution.project_slug || ""
          )

        if prefix != "", do: prefix <> prompt, else: prompt
      rescue
        _ -> prompt
      end

    case Ema.Executions.create_agent_session(execution.id, %{
           agent_role: packet.agent_role,
           status: "running",
           prompt_sent: prompt,
           started_at: DateTime.utc_now() |> DateTime.truncate(:second),
           metadata: %{packet: packet, routing: build_routing_plan(execution)}
         }) do
      {:ok, agent_session} ->
        attempt_dispatch(execution, agent_session, prompt)

      {:error, reason} ->
        Logger.warning("[Dispatcher] Failed to create agent_session: #{inspect(reason)}")
        Ema.Executions.transition(execution, "failed")
    end
  end

  defp attempt_dispatch(execution, agent_session, prompt) do
    routing_plan = build_routing_plan(execution)

    Ema.Executions.record_event(execution.id, "dispatch_started", %{
      mode: execution.mode,
      requested_provider: routing_plan.requested_provider,
      dispatch_source: routing_plan.dispatch_source,
      task_type: routing_plan.task_type
    })

    # Mark running before blocking AI call so HQ shows in-progress immediately
    case Ema.Executions.transition(execution, "running") do
      {:ok, running_execution} ->
        Broadcast.emit(:intent_stream, "[EXECUTION] Running: #{execution.mode} ##{execution.id}")
        attempt_execution_path(running_execution, agent_session, prompt, routing_plan)

      {:error, reason} ->
        Logger.warning("[Dispatcher] Could not transition to running: #{inspect(reason)}")
        attempt_execution_path(execution, agent_session, prompt, routing_plan)
    end
  end

  defp attempt_execution_path(execution, agent_session, prompt, routing_plan) do
    result =
      cond do
        routing_plan.dispatch_source == :openclaw and Ema.OpenClaw.AgentBridge.connected?() ->
          Logger.info("[Dispatcher] Routing #{execution.id} via OpenClaw agent bridge")

          case Ema.OpenClaw.Dispatcher.dispatch(execution, timeout: 300_000) do
            {:ok, text} ->
              {:ok,
               %{
                 "result" => text,
                 "_ema" => %{
                   "requested_provider" => routing_plan.requested_provider,
                   "actual_provider" => "openclaw-vm",
                   "dispatch_source" => "openclaw",
                   "task_type" => to_string(routing_plan.task_type)
                 }
               }}

            {:error, :openclaw_unavailable} ->
              Logger.info("[Dispatcher] OpenClaw unavailable, falling back to local AI")
              local_ai_run(execution, prompt, routing_plan)

            {:error, reason} ->
              Logger.warning(
                "[Dispatcher] OpenClaw failed (#{inspect(reason)}), falling back to local AI"
              )

              local_ai_run(execution, prompt, routing_plan)
          end

        routing_plan.dispatch_source == :distributed_ai ->
          distributed_ai_run(execution, prompt, routing_plan)

        true ->
          local_ai_run(execution, prompt, routing_plan)
      end

    case result do
      {:ok, payload} ->
        result_text = extract_result_text(payload)
        routing_metadata = extract_routing_metadata(payload, routing_plan)

        persist_execution_routing_metadata(execution, routing_metadata)
        Ema.Executions.record_event(execution.id, "provider_routed", routing_metadata)
        Ema.Executions.complete_agent_session(agent_session.id, result_text, routing_metadata)
        Ema.Executions.on_execution_completed(execution.id, result_text)
        OutcomeTracker.record(execution)
        capture_and_store_diff(execution)

      {:error, reason} ->
        Logger.error(
          "[Dispatcher] All dispatch paths failed for #{execution.id}: #{inspect(reason)}"
        )

        Ema.Executions.complete_agent_session(agent_session.id, "FAILED: #{inspect(reason)}")
        Ema.Executions.record_event(execution.id, "failed", %{reason: inspect(reason)})
        Ema.Executions.transition(execution, "failed")
        failed_execution = %{execution | status: "failed"}
        OutcomeTracker.record(failed_execution)
    end
  end

  defp local_ai_run(execution, prompt, routing_plan) do
    project_path =
      case Ema.Projects.get_project(execution.project_slug) do
        nil -> File.cwd!()
        project -> project.path || File.cwd!()
      end

    Ema.Claude.AI.run(
      prompt,
      timeout: 300_000,
      task_type: routing_plan.task_type,
      provider_id: routing_plan.requested_provider,
      workdir: project_path,
      allow_fallback: true,
      simulate_tui: true
    )
  end

  defp distributed_ai_run(execution, prompt, routing_plan) do
    with {:ok, node} <- Ema.Claude.NodeCoordinator.find_remote_provider(routing_plan.task_type),
         {:ok, result} <-
           Ema.Claude.NodeCoordinator.execute_remote(
             node,
             prompt,
             routing_plan.task_type,
             provider_id: routing_plan.requested_provider,
             allow_fallback: true
           ) do
      {:ok, attach_distributed_metadata(result, routing_plan, node)}
    else
      {:error, reason} ->
        Logger.warning(
          "[Dispatcher] Distributed AI failed for #{execution.id}: #{inspect(reason)}; using local AI"
        )

        local_ai_run(execution, prompt, routing_plan)
    end
  end

  # Extract the clean result text from Claude's JSON output.
  # Claude returns {"result": "...", "type": "result", ...} — we want just the result field.
  defp extract_result_text(%{"result" => text}) when is_binary(text), do: text

  defp extract_result_text(%{"raw" => raw}) when is_binary(raw) do
    # The "raw" field may contain a warning prefix + JSON. Try to parse the JSON part.
    case Regex.run(~r/\{.*"result"\s*:\s*"/, raw) do
      nil ->
        raw

      _ ->
        # Find the JSON object in the raw output
        case Regex.run(~r/(\{[^\n]*"type"\s*:\s*"result"[^\n]*\})/, raw) do
          [_, json_str] ->
            case Jason.decode(json_str) do
              {:ok, %{"result" => text}} -> text
              _ -> raw
            end

          _ ->
            raw
        end
    end
  end

  defp extract_result_text(result) when is_map(result), do: Jason.encode!(result)
  defp extract_result_text(result), do: to_string(result)

  defp attach_distributed_metadata(result, routing_plan, node) when is_map(result) do
    metadata =
      result
      |> Map.get("_ema", %{})
      |> Map.put("distributed_node", to_string(node))
      |> Map.put("dispatch_source", "distributed_ai")
      |> Map.put_new("requested_provider", routing_plan.requested_provider)
      |> Map.put_new("task_type", to_string(routing_plan.task_type))

    Map.put(result, "_ema", metadata)
  end

  defp attach_distributed_metadata(result, routing_plan, node) do
    %{
      "result" => to_string(result),
      "_ema" => %{
        "requested_provider" => routing_plan.requested_provider,
        "actual_provider" => routing_plan.requested_provider,
        "dispatch_source" => "distributed_ai",
        "task_type" => to_string(routing_plan.task_type),
        "distributed_node" => to_string(node)
      }
    }
  end

  defp extract_routing_metadata(%{"_ema" => metadata}, routing_plan) when is_map(metadata) do
    Map.merge(
      %{
        "requested_provider" => routing_plan.requested_provider,
        "dispatch_source" => Atom.to_string(routing_plan.dispatch_source),
        "task_type" => to_string(routing_plan.task_type)
      },
      metadata
    )
  end

  defp extract_routing_metadata(_result, routing_plan) do
    %{
      "requested_provider" => routing_plan.requested_provider,
      "actual_provider" => routing_plan.requested_provider,
      "dispatch_source" => Atom.to_string(routing_plan.dispatch_source),
      "task_type" => to_string(routing_plan.task_type)
    }
  end

  defp persist_execution_routing_metadata(execution, routing_metadata) do
    updated_metadata =
      execution.metadata
      |> Kernel.||(%{})
      |> Map.put("routing", routing_metadata)

    execution
    |> Execution.changeset(%{metadata: updated_metadata})
    |> Ema.Repo.update()
    |> case do
      {:ok, _} ->
        :ok

      {:error, reason} ->
        Logger.warning("[Dispatcher] Failed to persist routing metadata: #{inspect(reason)}")
    end
  end

  defp build_routing_plan(execution) do
    case execution.mode do
      "implement" ->
        %{task_type: :code_generation, requested_provider: "codex-local", dispatch_source: :local_ai}

      "refactor" ->
        %{task_type: :code_generation, requested_provider: "codex-local", dispatch_source: :local_ai}

      "research" ->
        if Ema.OpenClaw.AgentBridge.connected?() do
          %{task_type: :research, requested_provider: "openclaw-vm", dispatch_source: :openclaw}
        else
          build_distributed_fallback(:research, "claude-local")
        end

      "outline" ->
        if Ema.OpenClaw.AgentBridge.connected?() do
          %{task_type: :research, requested_provider: "openclaw-vm", dispatch_source: :openclaw}
        else
          build_distributed_fallback(:research, "claude-local")
        end

      "harvest" ->
        if Ema.OpenClaw.AgentBridge.connected?() do
          %{task_type: :summarization, requested_provider: "openclaw-vm", dispatch_source: :openclaw}
        else
          build_distributed_fallback(:summarization, "claude-local")
        end

      "review" ->
        %{task_type: :code_review, requested_provider: "claude-local", dispatch_source: :local_ai}

      _ ->
        %{task_type: :general, requested_provider: "claude-local", dispatch_source: :local_ai}
    end
  end

  defp build_distributed_fallback(task_type, local_provider) do
    if distributed_ai_enabled?() and distributed_provider_available?(task_type) do
      %{task_type: task_type, requested_provider: "openclaw-vm", dispatch_source: :distributed_ai}
    else
      %{task_type: task_type, requested_provider: local_provider, dispatch_source: :local_ai}
    end
  end

  defp distributed_ai_enabled? do
    Application.get_env(:ema, :distributed_ai, [])
    |> Keyword.get(:enabled, false)
  end

  defp distributed_provider_available?(task_type) do
    case Ema.Claude.NodeCoordinator.find_remote_provider(task_type) do
      {:ok, _node} -> true
      _ -> false
    end
  rescue
    _ -> false
  end

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
      read_files:
        [
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

  defp capture_and_store_diff(execution) do
    diff =
      case capture_git_diff(execution) do
        {:ok, nil} ->
          nil

        {:ok, diff} ->
          execution
          |> Ema.Executions.Execution.changeset(%{git_diff: diff})
          |> Ema.Repo.update()
          |> case do
            {:ok, _} ->
              Logger.info(
                "[Dispatcher] Stored git diff for #{execution.id} (#{byte_size(diff)} bytes)"
              )

            {:error, reason} ->
              Logger.warning(
                "[Dispatcher] Failed to store git diff for #{execution.id}: #{inspect(reason)}"
              )
          end

        _ ->
          nil
      end

    VaultBridge.on_execution_completed(execution, diff)
    :ok
  end

  defp capture_git_diff(execution) do
    project_path = get_project_path(execution.project_slug)

    case project_path do
      nil ->
        {:ok, nil}

      path ->
        case System.cmd("git", ["diff", "HEAD~1", "HEAD", "--stat", "--patch"],
               cd: path,
               stderr_to_stdout: true
             ) do
          {output, 0} when byte_size(output) > 0 ->
            {:ok, output}

          _ ->
            case System.cmd("git", ["diff", "--stat", "--patch"],
                   cd: path,
                   stderr_to_stdout: true
                 ) do
              {output2, _} when byte_size(output2) > 0 -> {:ok, output2}
              _ -> {:ok, nil}
            end
        end
    end
  end

  defp get_project_path(project_slug) do
    paths = [
      "/home/trajan/Projects/#{project_slug}",
      "/home/trajan/Desktop/Coding/#{project_slug}",
      "/home/trajan/#{project_slug}"
    ]

    Enum.find(paths, &File.dir?/1)
  end

  defp prepend_project_intelligence(prompt, project_slug) do
    case Superman.context_for(project_slug) do
      [] ->
        prompt

      nodes ->
        intelligence =
          nodes
          |> Enum.map_join("\n\n", fn node ->
            """
            [#{node.type}] #{node.title}
            #{node.content}
            """
            |> String.trim()
          end)

        """
        Project intelligence:
        #{intelligence}

        #{prompt}
        """
        |> String.trim()
    end
  end
end
