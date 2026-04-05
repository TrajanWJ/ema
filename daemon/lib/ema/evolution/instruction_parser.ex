defmodule Ema.Evolution.InstructionParser do
  @moduledoc """
  Parses natural language instructions into structured behavioral rules.
  Uses Claude to extract actionable rules from free-text signals.

  ## Async API (Week 7 B3)

  `parse_async/2` and `parse_signal_async/3` are non-blocking alternatives.
  They return `{:ok, task_id}` immediately and deliver results via PubSub
  ("claude:task:<task_id>") and/or a callback.

  The synchronous `parse/1` and `parse_signal/2` are retained for callers
  that require a result inline.
  """

  require Logger

  @doc """
  Parses a natural language instruction into a structured rule map.
  Returns {:ok, rule_map} or {:error, reason}.

  Synchronous — blocks until Claude responds.
  For non-blocking use, see `parse_async/2`.
  """
  def parse(instruction) when is_binary(instruction) do
    prompt = build_parse_prompt(instruction)

    case Ema.Claude.Bridge.run(prompt, model: "haiku") do
      {:ok, result} ->
        {:ok, normalize_result(result, instruction)}

      {:error, reason} ->
        Logger.warning("InstructionParser: Claude call failed: #{inspect(reason)}")
        {:ok, fallback_parse(instruction)}
    end
  end

  @doc """
  Non-blocking version of `parse/1`. Returns `{:ok, task_id}` immediately.

  Result is delivered via:
  - PubSub broadcast to `"claude:task:<task_id>"` as `{:done, task_id, {:ok, rule_map}}`
  - Optional `on_complete` callback called with `{:ok, rule_map}` or `{:error, reason}`

  ## Example

      {:ok, task_id} = InstructionParser.parse_async(instruction, fn
        {:ok, rule} -> Evolution.store_rule(rule)
        {:error, _} -> :ignore
      end)
  """
  def parse_async(instruction, on_complete \\ nil) when is_binary(instruction) do
    prompt = build_parse_prompt(instruction)

    callback = fn
      {:ok, result} ->
        rule = normalize_result(result, instruction)
        if is_function(on_complete, 1), do: on_complete.({:ok, rule})

      {:error, reason} ->
        Logger.warning("InstructionParser: async Claude call failed: #{inspect(reason)}")
        # Deliver fallback via callback so caller isn't left hanging
        fallback = fallback_parse(instruction)
        if is_function(on_complete, 1), do: on_complete.({:ok, fallback})
    end

    Ema.Claude.Bridge.run_async(prompt, [model: "haiku"], callback)
  end

  @doc """
  Parses a signal with metadata context into a rule.
  Synchronous.
  """
  def parse_signal(source, metadata) when is_atom(source) and is_map(metadata) do
    instruction = build_instruction_from_signal(source, metadata)
    parse(instruction)
  end

  @doc """
  Non-blocking version of `parse_signal/2`. Returns `{:ok, task_id}` immediately.
  """
  def parse_signal_async(source, metadata, on_complete \\ nil)
      when is_atom(source) and is_map(metadata) do
    instruction = build_instruction_from_signal(source, metadata)
    parse_async(instruction, on_complete)
  end

  # --- Private ---

  defp build_parse_prompt(instruction) do
    """
    Parse this natural language instruction into a structured behavioral rule.

    Instruction: #{instruction}

    Output JSON with these fields:
    - "content": The rule stated clearly and concisely (imperative form)
    - "source": One of: signal, correction, approval_pattern, task_outcome, manual
    - "confidence": Float 0.0-1.0, how confident you are this is a valid rule
    - "rationale": Why this rule would improve system behavior
    - "conditions": When this rule should apply (array of strings)
    - "actions": What the system should do (array of strings)
    """
  end

  defp normalize_result(result, original_instruction) do
    %{
      content: result["content"] || original_instruction,
      source: validate_source(result["source"]),
      confidence: parse_confidence(result["confidence"]),
      rationale: result["rationale"] || "",
      conditions: result["conditions"] || [],
      actions: result["actions"] || []
    }
  end

  defp fallback_parse(instruction) do
    %{
      content: instruction,
      source: "manual",
      confidence: 0.5,
      rationale: "Parsed without AI assistance",
      conditions: [],
      actions: [instruction]
    }
  end

  defp build_instruction_from_signal(:approval_pattern, metadata) do
    pattern = metadata[:pattern] || metadata["pattern"] || "unknown"

    case pattern do
      "recurring_approval" ->
        tags = metadata[:tags] || metadata["tags"] || []
        "The system consistently approves proposals tagged with #{Enum.join(tags, ", ")}. Consider prioritizing these areas."

      "recurring_rejection" ->
        tags = metadata[:tags] || metadata["tags"] || []
        "Proposals tagged with #{Enum.join(tags, ", ")} are frequently rejected. Reduce generation in these areas."

      "high_rejection_rate" ->
        "The proposal rejection rate is high (#{metadata[:killed] || 0} killed vs #{metadata[:approved] || 0} approved). Improve seed quality."

      _ ->
        "Detected pattern: #{pattern} with data: #{inspect(metadata)}"
    end
  end

  defp build_instruction_from_signal(:task_outcome, metadata) do
    pattern = metadata[:pattern] || metadata["pattern"] || "unknown"

    case pattern do
      "fast_completions" ->
        "#{metadata[:count] || 0} tasks completed rapidly. #{metadata[:suggestion] || ""}"

      "stalled_tasks" ->
        "#{metadata[:count] || 0} tasks are blocked. #{metadata[:suggestion] || ""}"

      _ ->
        "Task outcome signal: #{inspect(metadata)}"
    end
  end

  defp build_instruction_from_signal(source, metadata) do
    "Signal from #{source}: #{inspect(metadata)}"
  end

  defp validate_source(source) when source in ~w(signal correction approval_pattern task_outcome manual), do: source
  defp validate_source(_), do: "signal"

  defp parse_confidence(val) when is_float(val), do: min(1.0, max(0.0, val))
  defp parse_confidence(val) when is_integer(val), do: min(1.0, max(0.0, val / 1))

  defp parse_confidence(val) when is_binary(val) do
    case Float.parse(val) do
      {f, _} -> min(1.0, max(0.0, f))
      :error -> 0.5
    end
  end

  defp parse_confidence(_), do: 0.5
end
