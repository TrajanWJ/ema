defmodule Ema.Evolution.InstructionParser do
  @moduledoc """
  Parses natural language instructions into structured behavioral rules.
  Uses Claude to extract actionable rules from free-text signals.
  """

  require Logger

  @doc """
  Parses a natural language instruction into a structured rule map.
  Returns {:ok, rule_map} or {:error, reason}.
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
  Parses a signal with metadata context into a rule.
  """
  def parse_signal(source, metadata) when is_atom(source) and is_map(metadata) do
    instruction = build_instruction_from_signal(source, metadata)
    parse(instruction)
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
