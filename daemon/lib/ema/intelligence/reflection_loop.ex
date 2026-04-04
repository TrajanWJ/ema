defmodule Ema.Intelligence.ReflectionLoop do
  @moduledoc """
  Post-execution reflection. Triggered after each execution completes.
  Classifies outcome quality, records agent fitness, extracts lesson keywords.
  Always runs async — never blocks the completion path.
  """

  require Logger
  alias Ema.Orchestration.AgentFitnessStore

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

    Logger.info("[ReflectionLoop] #{execution_id} outcome=#{outcome} agent=#{effective_agent} #{duration_ms}ms")

    if outcome in [:success, :partial] do
      lesson = extract_lesson_keywords(result_text, execution.mode)

      Ema.Executions.record_event(execution_id, "reflection_complete", %{
        outcome: Atom.to_string(outcome),
        agent: effective_agent,
        duration_ms: duration_ms,
        lesson_keywords: lesson
      })
    end

    {:ok, %{outcome: outcome, agent: effective_agent, duration_ms: duration_ms}}
  rescue
    e ->
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
end
