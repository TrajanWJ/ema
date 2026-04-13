defmodule Ema.Proposals.Orchestrator do
  @moduledoc """
  GenServer that manages the 4-stage proposal pipeline with quality gates.

  ## Pipeline Stages
    1. Generator  (haiku)  — Initial proposal from seed + context
    2. Refiner    (sonnet) — Improve structure, detail, and coherence
    3. RiskAnalyzer (sonnet) — Identify risks + mitigation strategies
    4. Formatter  (haiku)  — Final markdown formatting

  ## Flow
    - `start_proposal/3` returns immediately with `{:ok, proposal_id, pubsub_topic}`
    - Client subscribes to `"proposal:<id>"` for streaming updates
    - Pipeline runs async via Task.Supervisor
    - QualityGate runs after all 4 stages; failures loop back (max 3x)

  ## PubSub Events (topic: "proposal:<id>")
    - `{:stage_started, stage_name, stage_num}`
    - `{:stage_update, stage_name, partial_text}`
    - `{:stage_complete, stage_name, output}`
    - `{:quality_gate_passed, proposal}`
    - `{:quality_gate_failed, feedback, iteration}`
    - `{:quality_gate_warning, output, failures}`
    - `{:complete, proposal}`
    - `{:pipeline_error, reason}`
  """

  use GenServer
  require Logger

  alias Ema.Proposals.{Prompts, QualityGate}
  alias Ema.Claude.Bridge
  alias Ema.Proposals

  @stage_models %{
    generator: "haiku",
    refiner: "sonnet",
    risk_analyzer: "sonnet",
    formatter: "haiku"
  }

  @stages [:generator, :refiner, :risk_analyzer, :formatter]
  @stage_nums %{generator: 1, refiner: 2, risk_analyzer: 3, formatter: 4}
  @stage_labels %{
    generator: "Generating",
    refiner: "Refining",
    risk_analyzer: "Analyzing Risks",
    formatter: "Formatting"
  }

  # ── Client API ──────────────────────────────────────────────────────────────

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Start an async proposal generation pipeline.

  Returns `{:ok, proposal_id, pubsub_topic}` immediately.
  Subscribe to the pubsub_topic to receive streaming updates.

  ## Parameters
    - `seed` — The proposal seed (Ema.Proposals.Seed struct or map with :prompt_template)
    - `project` — The project context (map or nil)
    - `context` — Additional context map (vault entries, goals, etc.)
  """
  def start_proposal(seed, project \\ nil, context \\ %{}) do
    GenServer.call(__MODULE__, {:start_proposal, seed, project, context})
  end

  @doc """
  Cancel an active proposal pipeline.
  """
  def cancel_proposal(proposal_id) do
    GenServer.cast(__MODULE__, {:cancel_proposal, proposal_id})
  end

  @doc """
  List all active pipeline runs.
  """
  def active_pipelines do
    GenServer.call(__MODULE__, :active_pipelines)
  end

  # ── GenServer Callbacks ────────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    {:ok, %{pipelines: %{}}}
  end

  @impl true
  def handle_call({:start_proposal, seed, project, context}, _from, state) do
    proposal_id = generate_proposal_id()
    pubsub_topic = "proposal:#{proposal_id}"

    # Create initial DB record with generating status
    attrs = %{
      id: proposal_id,
      title: "Generating: #{seed_title(seed)}",
      summary: "",
      body: "",
      status: "generating",
      project_id: project && project.id,
      seed_id: seed[:id] || seed.id,
      generation_log: %{"stage" => "started", "started_at" => DateTime.utc_now() |> to_string()}
    }

    case Proposals.create_proposal(attrs) do
      {:ok, proposal} ->
        # Spawn async pipeline
        task =
          Task.Supervisor.async_nolink(
            Ema.ProposalEngine.TaskSupervisor,
            fn -> run_pipeline(proposal, seed, project, context) end
          )

        pipeline_state = %{
          proposal_id: proposal_id,
          task: task,
          pubsub_topic: pubsub_topic,
          started_at: DateTime.utc_now()
        }

        new_state = put_in(state.pipelines[proposal_id], pipeline_state)
        {:reply, {:ok, proposal_id, pubsub_topic}, new_state}

      {:error, reason} ->
        Logger.error("[Orchestrator] Failed to create proposal record: #{inspect(reason)}")
        {:reply, {:error, reason}, state}
    end
  end

  @impl true
  def handle_call(:active_pipelines, _from, state) do
    summary =
      state.pipelines
      |> Enum.map(fn {id, p} ->
        %{proposal_id: id, started_at: p.started_at, pubsub_topic: p.pubsub_topic}
      end)

    {:reply, summary, state}
  end

  @impl true
  def handle_cast({:cancel_proposal, proposal_id}, state) do
    case Map.get(state.pipelines, proposal_id) do
      nil ->
        {:noreply, state}

      %{task: task} ->
        Task.Supervisor.terminate_child(Ema.ProposalEngine.TaskSupervisor, task.pid)
        broadcast(proposal_id, {:pipeline_error, :cancelled})
        {:noreply, %{state | pipelines: Map.delete(state.pipelines, proposal_id)}}
    end
  end

  # Handle task completion
  @impl true
  def handle_info({ref, result}, state) when is_reference(ref) do
    Process.demonitor(ref, [:flush])

    # Find and remove the pipeline by task ref
    case find_pipeline_by_task_ref(state.pipelines, ref) do
      {proposal_id, _pipeline} ->
        case result do
          {:error, reason} ->
            Logger.error("[Orchestrator] Pipeline #{proposal_id} failed: #{inspect(reason)}")
            broadcast(proposal_id, {:pipeline_error, reason})

          _ ->
            :ok
        end

        {:noreply, %{state | pipelines: Map.delete(state.pipelines, proposal_id)}}

      nil ->
        {:noreply, state}
    end
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, _pid, _reason}, state) do
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # ── Pipeline Execution ─────────────────────────────────────────────────────

  defp run_pipeline(proposal, seed, project, context) do
    proposal_id = proposal.id

    Logger.info("[Orchestrator] Starting pipeline for proposal #{proposal_id}")

    # Start a named Bridge session for multi-turn context
    session_name = "proposal-#{proposal_id}"

    with {:ok, session_id} <- start_session(proposal_id, session_name, project) do
      result = execute_stages(proposal_id, session_id, seed, project, context, 1)
      end_session(proposal_id, session_id)
      result
    else
      {:error, reason} ->
        Logger.error("[Orchestrator] Session start failed for #{proposal_id}: #{inspect(reason)}")
        update_proposal_status(proposal_id, "failed")
        broadcast(proposal_id, {:pipeline_error, {:session_failed, reason}})
        {:error, reason}
    end
  end

  defp execute_stages(proposal_id, session_id, seed, project, context, iteration) do
    # Run all 4 stages
    with {:ok, stage_outputs} <- run_all_stages(proposal_id, session_id, seed, project, context) do
      # Evaluate quality
      combined_output = build_combined_output(stage_outputs)

      case QualityGate.evaluate(combined_output, :proposal, iteration) do
        {:pass, output} ->
          handle_pipeline_success(proposal_id, output, stage_outputs, iteration)

        {:fail, feedback, iter} ->
          handle_quality_gate_failure(
            proposal_id,
            session_id,
            seed,
            project,
            context,
            feedback,
            iter,
            stage_outputs
          )

        {:pass_with_warnings, output, failures} ->
          handle_pipeline_warning(proposal_id, output, stage_outputs, failures, iteration)
      end
    end
  end

  defp run_all_stages(proposal_id, session_id, seed, project, context) do
    Enum.reduce_while(@stages, {:ok, %{}}, fn stage, {:ok, acc} ->
      case run_stage(proposal_id, session_id, stage, seed, project, context, acc) do
        {:ok, output} -> {:cont, {:ok, Map.put(acc, stage, output)}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp run_stage(proposal_id, session_id, stage, seed, project, context, prior_outputs) do
    stage_num = @stage_nums[stage]
    stage_label = @stage_labels[stage]
    _model = @stage_models[stage]

    Logger.info("[Orchestrator] #{proposal_id}: Stage #{stage_num}/4 #{stage_label}")
    broadcast(proposal_id, {:stage_started, stage, stage_num})

    # Update DB with current stage
    update_proposal_log(proposal_id, %{"current_stage" => Atom.to_string(stage)})

    # Build stage prompt
    prompt =
      Prompts.build(stage, %{
        seed: seed,
        project: project,
        context: context,
        prior_outputs: prior_outputs
      })

    # Run via Bridge (multi-turn — same session, synchronous call)
    case Bridge.call(session_id, prompt) do
      {:ok, %{text: text}} when is_binary(text) and byte_size(text) > 0 ->
        broadcast(proposal_id, {:stage_complete, stage, text})
        {:ok, text}

      {:ok, result} ->
        text = extract_text(result)
        broadcast(proposal_id, {:stage_complete, stage, text})
        {:ok, text}

      {:error, reason} ->
        Logger.error("[Orchestrator] Stage #{stage} failed: #{inspect(reason)}")
        broadcast(proposal_id, {:pipeline_error, {stage, reason}})
        {:error, {stage, reason}}
    end
  end

  defp handle_pipeline_success(proposal_id, output, stage_outputs, iteration) do
    Logger.info("[Orchestrator] #{proposal_id}: Pipeline passed quality gate (iter #{iteration})")

    proposal_attrs =
      parse_proposal_output(output, stage_outputs, %{
        status: "queued",
        quality_score: 1.0,
        generation_log: %{
          "completed_at" => DateTime.utc_now() |> to_string(),
          "iterations" => iteration,
          "quality_score" => 1.0
        }
      })

    case update_proposal_with_attrs(proposal_id, proposal_attrs) do
      {:ok, proposal} ->
        broadcast(proposal_id, {:quality_gate_passed, proposal})
        broadcast(proposal_id, {:complete, proposal})
        {:ok, proposal}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp handle_quality_gate_failure(
         proposal_id,
         session_id,
         seed,
         project,
         context,
         feedback,
         iter,
         _stage_outputs
       ) do
    Logger.info("[Orchestrator] #{proposal_id}: Quality gate failed (iter #{iter}), retrying...")
    broadcast(proposal_id, {:quality_gate_failed, feedback, iter})

    # Send feedback as a follow-up turn in the SAME session (multi-turn)
    feedback_message =
      "Feedback on your previous response:\n\n#{feedback}\n\nPlease revise your proposal addressing all the issues above."

    case Bridge.call(session_id, feedback_message) do
      {:ok, _} ->
        # Loop back to stage 2 (Refiner) with incremented iteration
        next_iter = iter + 1
        Logger.info("[Orchestrator] #{proposal_id}: Starting iteration #{next_iter}")

        # Only re-run stages 2-4 (Refiner through Formatter)
        refine_stages = [:refiner, :risk_analyzer, :formatter]

        # Re-run from refiner with prior generator output preserved
        with {:ok, gen_output} <- get_generator_output_for_proposal(proposal_id),
             {:ok, stage_outputs} <-
               run_stages_from(
                 proposal_id,
                 session_id,
                 refine_stages,
                 seed,
                 project,
                 context,
                 %{generator: gen_output}
               ) do
          combined_output = build_combined_output(stage_outputs)

          case QualityGate.evaluate(combined_output, :proposal, next_iter) do
            {:pass, output} ->
              handle_pipeline_success(proposal_id, output, stage_outputs, next_iter)

            {:fail, next_feedback, next_iter2} when next_iter2 < 3 ->
              handle_quality_gate_failure(
                proposal_id,
                session_id,
                seed,
                project,
                context,
                next_feedback,
                next_iter2,
                stage_outputs
              )

            {:fail, _, _} ->
              # Exhausted iterations — pass with warnings
              handle_pipeline_warning(
                proposal_id,
                combined_output,
                stage_outputs,
                ["Maximum iterations reached"],
                next_iter
              )

            {:pass_with_warnings, output, failures} ->
              handle_pipeline_warning(proposal_id, output, stage_outputs, failures, next_iter)
          end
        end

      {:error, reason} ->
        Logger.error(
          "[Orchestrator] Failed to send feedback for #{proposal_id}: #{inspect(reason)}"
        )

        # Fall through to warning path
        handle_pipeline_warning(proposal_id, "", %{}, [feedback], iter)
    end
  end

  defp handle_pipeline_warning(proposal_id, output, stage_outputs, failures, iteration) do
    Logger.warning(
      "[Orchestrator] #{proposal_id}: Passing with warnings after #{iteration} iterations"
    )

    proposal_attrs =
      parse_proposal_output(output, stage_outputs, %{
        status: "queued",
        quality_score: 0.4,
        generation_log: %{
          "completed_at" => DateTime.utc_now() |> to_string(),
          "iterations" => iteration,
          "quality_score" => 0.4,
          "warnings" => failures
        }
      })

    case update_proposal_with_attrs(proposal_id, proposal_attrs) do
      {:ok, proposal} ->
        broadcast(proposal_id, {:quality_gate_warning, proposal, failures})
        broadcast(proposal_id, {:complete, proposal})
        {:ok, proposal}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp run_stages_from(proposal_id, session_id, stages, seed, project, context, initial_acc) do
    Enum.reduce_while(stages, {:ok, initial_acc}, fn stage, {:ok, acc} ->
      case run_stage(proposal_id, session_id, stage, seed, project, context, acc) do
        {:ok, output} -> {:cont, {:ok, Map.put(acc, stage, output)}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  # ── Session Management ─────────────────────────────────────────────────────

  defp start_session(proposal_id, session_name, project) do
    project_path = (project && Map.get(project, :path)) || File.cwd!()

    opts = [
      session_id: session_name,
      project_path: project_path
    ]

    case Bridge.start_link(opts) do
      {:ok, pid} ->
        Logger.info("[Orchestrator] Started Bridge session for proposal #{proposal_id}")
        {:ok, pid}

      {:error, reason} ->
        Logger.error(
          "[Orchestrator] Failed to start session for #{proposal_id}: #{inspect(reason)}"
        )

        {:error, reason}
    end
  end

  defp end_session(proposal_id, session_pid) do
    Bridge.stop(session_pid)
    Logger.info("[Orchestrator] Ended Bridge session for proposal #{proposal_id}")
  end

  # ── Output Parsing ─────────────────────────────────────────────────────────

  defp build_combined_output(stage_outputs) do
    formatter_output = Map.get(stage_outputs, :formatter, "")
    generator_output = Map.get(stage_outputs, :generator, "")
    refiner_output = Map.get(stage_outputs, :refiner, "")
    risk_output = Map.get(stage_outputs, :risk_analyzer, "")

    # Use formatter output as primary, fall back to refiner or generator
    primary =
      if byte_size(formatter_output) > 50,
        do: formatter_output,
        else: if(byte_size(refiner_output) > 50, do: refiner_output, else: generator_output)

    %{
      text: primary,
      risks_text: risk_output,
      all_stages: stage_outputs
    }
  end

  defp parse_proposal_output(output, stage_outputs, extra_attrs) do
    text =
      case output do
        %{text: t} -> t
        t when is_binary(t) -> t
        _ -> ""
      end

    risks_text = Map.get(stage_outputs, :risk_analyzer, "")

    # Try to parse JSON if the formatter returned structured data
    parsed = try_parse_json(text)

    base_attrs = %{
      title: Map.get(parsed, "title") || extract_title(text),
      summary: Map.get(parsed, "summary") || extract_summary(text),
      body: Map.get(parsed, "body") || text,
      risks: Map.get(parsed, "risks") || extract_risks(risks_text),
      benefits: Map.get(parsed, "benefits") || [],
      estimated_scope: Map.get(parsed, "estimated_scope"),
      steelman: Map.get(stage_outputs, :refiner),
      synthesis: Map.get(stage_outputs, :formatter)
    }

    Map.merge(base_attrs, extra_attrs)
  end

  defp try_parse_json(text) when is_binary(text) do
    # Try to find JSON block in the text
    case Regex.run(~r/```json\n?(.*?)\n?```/s, text) do
      [_, json_str] ->
        case Jason.decode(json_str) do
          {:ok, parsed} -> parsed
          _ -> %{}
        end

      _ ->
        case Jason.decode(String.trim(text)) do
          {:ok, parsed} when is_map(parsed) -> parsed
          _ -> %{}
        end
    end
  end

  defp try_parse_json(_), do: %{}

  defp extract_title(text) when is_binary(text) do
    case Regex.run(~r/^#\s+(.+)$/m, text) do
      [_, title] ->
        String.trim(title)

      _ ->
        case String.split(text, "\n") do
          [first | _] when byte_size(first) > 0 -> String.slice(first, 0..80)
          _ -> "Generated Proposal"
        end
    end
  end

  defp extract_title(_), do: "Generated Proposal"

  defp extract_summary(text) when is_binary(text) do
    # Find first non-header paragraph
    text
    |> String.split("\n")
    |> Enum.reject(fn line -> String.starts_with?(line, "#") end)
    |> Enum.reject(fn line -> String.trim(line) == "" end)
    |> Enum.take(2)
    |> Enum.join(" ")
    |> String.slice(0..300)
  end

  defp extract_summary(_), do: ""

  defp extract_risks(text) when is_binary(text) do
    # Extract bullet points from risk section
    text
    |> String.split("\n")
    |> Enum.filter(fn line -> String.match?(line, ~r/^[\-\*]\s+.+/) end)
    |> Enum.map(fn line -> Regex.replace(~r/^[\-\*]\s+/, line, "") end)
    |> Enum.take(10)
  end

  defp extract_risks(_), do: []

  defp extract_text(%{text: t}) when is_binary(t), do: t
  defp extract_text(t) when is_binary(t), do: t
  defp extract_text(_), do: ""

  # ── DB Helpers ─────────────────────────────────────────────────────────────

  defp update_proposal_status(proposal_id, status) do
    case Proposals.get_proposal(proposal_id) do
      nil ->
        Logger.warning("[Orchestrator] Proposal #{proposal_id} not found for status update")

      proposal ->
        Proposals.update_proposal(proposal, %{status: status})
    end
  end

  defp update_proposal_log(proposal_id, log_update) do
    case Proposals.get_proposal(proposal_id) do
      nil ->
        :ok

      proposal ->
        existing_log = proposal.generation_log || %{}
        new_log = Map.merge(existing_log, log_update)
        Proposals.update_proposal(proposal, %{generation_log: new_log})
    end
  end

  defp update_proposal_with_attrs(proposal_id, attrs) do
    case Proposals.get_proposal(proposal_id) do
      nil ->
        {:error, :not_found}

      proposal ->
        Proposals.update_proposal(proposal, attrs)
    end
  end

  defp get_generator_output_for_proposal(proposal_id) do
    case Proposals.get_proposal(proposal_id) do
      nil ->
        {:error, :not_found}

      proposal ->
        gen_log = proposal.generation_log || %{}
        {:ok, Map.get(gen_log, "generator_output", proposal.body || "")}
    end
  end

  # ── PubSub ─────────────────────────────────────────────────────────────────

  defp broadcast(proposal_id, event) do
    topic = "proposal:#{proposal_id}"

    Phoenix.PubSub.broadcast(Ema.PubSub, topic, event)
    |> case do
      :ok ->
        :ok

      {:error, reason} ->
        Logger.debug("[Orchestrator] PubSub broadcast failed for #{topic}: #{inspect(reason)}")
        :ok
    end
  end

  # ── Utility ────────────────────────────────────────────────────────────────

  defp generate_proposal_id do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "prop_#{ts}_#{rand}"
  end

  defp seed_title(%{name: name}), do: String.slice(name, 0..40)
  defp seed_title(%{"name" => name}), do: String.slice(name, 0..40)
  defp seed_title(_), do: "new proposal"

  defp find_pipeline_by_task_ref(pipelines, ref) do
    Enum.find(pipelines, fn {_id, pipeline} ->
      pipeline.task && pipeline.task.ref == ref
    end)
  end
end
