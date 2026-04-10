defmodule Ema.Intelligence.ReflectionLoop do
  @moduledoc """
  Post-execution reflection. Triggered after each execution completes.
  Classifies outcome quality, records agent fitness, extracts lesson keywords.
  Always runs async — never blocks the completion path.
  """

  require Logger
  alias Ema.Orchestration.AgentFitnessStore
  alias Ema.Intelligence.ReflexionStore

  @doc "Async wrapper — fire and forget."
  def reflect_async(execution_id, result_text, agent_id \\ nil) do
    Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
      reflect(execution_id, result_text, agent_id)
    end)
  end

  @doc "Synchronous reflection — returns {:ok, map} or {:error, :reflection_failed}."
  def reflect(execution_id, result_text, agent_id) do
    execution = Ema.Executions.get_execution!(execution_id)
    duration_ms = calculate_duration(execution)
    outcome = classify_outcome(result_text)
    effective_agent = agent_id || "local_claude"

    AgentFitnessStore.record_outcome(effective_agent, execution.mode, outcome, duration_ms)

    Logger.info(
      "[ReflectionLoop] #{execution_id} outcome=#{outcome} agent=#{effective_agent} #{duration_ms}ms"
    )

    if outcome in [:success, :partial] do
      lesson = extract_lesson_keywords(result_text, execution.mode)

      Ema.Executions.record_event(execution_id, "reflection_complete", %{
        outcome: Atom.to_string(outcome),
        agent: effective_agent,
        duration_ms: duration_ms,
        lesson_keywords: lesson
      })

      ReflexionStore.record(
        effective_agent,
        execution.mode || "code",
        execution.project_slug || "",
        "#{execution.mode}: #{Enum.join(lesson.top_words, ", ")}",
        Atom.to_string(outcome)
      )

      store_lesson_as_guideline(execution, effective_agent, lesson, outcome, result_text)
    end

    Ema.Intelligence.SignalProcessor.record(%{
      source: "reflection_loop",
      agent_id: effective_agent,
      task_type: :reflection,
      outcome: normalize_reflection_outcome(outcome),
      duration_ms: duration_ms,
      metadata: %{execution_id: execution_id}
    })

    {:ok, %{outcome: outcome, agent: effective_agent, duration_ms: duration_ms}}
  rescue
    e ->
      Ema.Intelligence.SignalProcessor.record(%{
        source: "reflection_loop",
        agent_id: agent_id || "local_claude",
        task_type: :reflection,
        outcome: :failure,
        duration_ms: 0,
        metadata: %{execution_id: execution_id, error: Exception.message(e)}
      })

      Logger.warning("[ReflectionLoop] Error on #{execution_id}: #{Exception.message(e)}")
      {:error, :reflection_failed}
  end

  # -- Private --

  defp classify_outcome(text) when is_binary(text) do
    cond do
      String.starts_with?(text, "FAILED:") -> :failure
      byte_size(text) < 100 -> :failure
      Regex.match?(~r/^#+ /m, text) and byte_size(text) > 300 -> :success
      byte_size(text) >= 200 -> :success
      true -> :partial
    end
  end

  defp classify_outcome(_), do: :failure

  defp calculate_duration(execution) do
    start = execution.started_at || execution.inserted_at
    stop = execution.completed_at || DateTime.utc_now()
    DateTime.diff(stop, start, :millisecond)
  end

  defp extract_lesson_keywords(text, mode) do
    words =
      text
      |> String.downcase()
      |> String.split(~r/\W+/)
      |> Enum.filter(fn w -> String.length(w) > 5 end)
      |> Enum.frequencies()
      |> Enum.sort_by(&elem(&1, 1), :desc)
      |> Enum.take(10)
      |> Enum.map(&elem(&1, 0))

    %{mode: mode, top_words: words}
  end

  defp normalize_reflection_outcome(:failure), do: :failure
  defp normalize_reflection_outcome(_outcome), do: :success

  # Persist the lesson as a Memory `guideline` entry so future dispatches and
  # prompt builders can recall it. Tagged with the agent that produced it via
  # the `metadata` map (no actor FK because reflection runs identify by
  # agent_id string, not actor_id).
  defp store_lesson_as_guideline(execution, agent_id, lesson, outcome, result_text) do
    keywords = lesson.top_words |> Enum.take(8) |> Enum.join(", ")

    excerpt =
      result_text
      |> to_string()
      |> String.replace(~r/\s+/, " ")
      |> String.slice(0, 480)

    content =
      """
      [LESSON] #{execution.mode || "task"} — outcome: #{outcome}
      agent: #{agent_id}
      project: #{execution.project_slug || "unscoped"}
      keywords: #{keywords}

      #{excerpt}
      """
      |> String.trim()

    importance = if outcome == :success, do: 0.55, else: 0.45

    attrs = %{
      memory_type: "guideline",
      scope: "project",
      project_id: execution.project_id,
      source_id: execution.id,
      content: content,
      importance: importance,
      metadata: %{
        "agent_id" => agent_id,
        "mode" => execution.mode,
        "outcome" => Atom.to_string(outcome),
        "keywords" => lesson.top_words
      }
    }

    case Ema.Memory.store_entry(attrs) do
      {:ok, _} ->
        :ok

      {:error, reason} ->
        Logger.debug("[ReflectionLoop] Memory.store_entry failed: #{inspect(reason)}")
    end
  rescue
    e ->
      Logger.debug("[ReflectionLoop] store_lesson_as_guideline crashed: #{Exception.message(e)}")
  end
end
