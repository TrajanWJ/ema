defmodule Ema.Claude.QualityGate do
  @moduledoc """
  Post-completion verification for Claude Code outputs.
  Inspired by Citadel's quality-gate.js cold-path verification lenses
  and the generator-evaluator loop pattern from RalphCTL.

  Runs after Bridge.run completes. Checks output quality against
  configurable criteria. Returns accept/regenerate decisions.

  ## Usage

      result = Bridge.run("generate a proposal", model: "opus")
      case QualityGate.evaluate(result, :proposal) do
        {:accept, result} -> save_proposal(result)
        {:accept_with_warnings, result, warnings} -> save_with_warnings(result, warnings)
        {:regenerate, feedback} -> Bridge.run(feedback_prompt(feedback), model: "opus")
      end
  """

  require Logger

  @max_iterations 3

  @doc """
  Evaluate a Claude output against quality criteria for the given type.
  Returns {:accept, result} | {:accept_with_warnings, result, warnings} | {:regenerate, feedback}
  """
  def evaluate(result, type, iteration \\ 1)

  def evaluate(result, :proposal, iteration) do
    checks = [
      check_has_field(result, "title", "Proposal must have a title"),
      check_has_field(result, "summary", "Proposal must have a summary"),
      check_has_field(result, "body", "Proposal body must be substantive (100+ chars)"),
      check_has_field(result, "risks", "Proposal must identify at least one risk"),
      check_has_field(result, "benefits", "Proposal must identify at least one benefit"),
      check_no_hallucination_markers(result),
      check_actionability(result)
    ]

    decide(result, checks, iteration)
  end

  def evaluate(result, :code_review, iteration) do
    checks = [
      check_has_field(result, "findings", "Review must have findings"),
      check_has_field(result, "severity", "Review must categorize severity"),
      check_no_hallucination_markers(result)
    ]

    decide(result, checks, iteration)
  end

  def evaluate(result, :general, iteration) do
    checks = [
      check_not_empty(result),
      check_no_hallucination_markers(result)
    ]

    decide(result, checks, iteration)
  end

  def evaluate(result, _type, iteration) do
    evaluate(result, :general, iteration)
  end

  # ── Decision Logic ─────────────────────────────────────────────────────────

  defp decide(result, checks, iteration) do
    failures = Enum.filter(checks, &match?({:fail, _}, &1))
    warnings = Enum.filter(checks, &match?({:warn, _}, &1))

    cond do
      failures == [] and warnings == [] ->
        {:accept, result}

      failures == [] and warnings != [] ->
        warning_msgs = Enum.map(warnings, fn {:warn, msg} -> msg end)
        {:accept_with_warnings, result, warning_msgs}

      iteration >= @max_iterations ->
        Logger.warning(
          "[QualityGate] Max iterations reached. Accepting with #{length(failures)} failures."
        )

        all_issues = Enum.map(failures ++ warnings, fn {_, msg} -> msg end)
        {:accept_with_warnings, result, all_issues}

      true ->
        feedback = format_feedback(failures)

        Logger.info(
          "[QualityGate] Iteration #{iteration}: #{length(failures)} failures. Requesting regeneration."
        )

        {:regenerate, feedback}
    end
  end

  # ── Check Functions ────────────────────────────────────────────────────────

  defp check_has_field(result, field, message) when is_map(result) do
    case Map.get(result, field) || Map.get(result, String.to_atom(field)) do
      nil -> {:fail, message}
      "" -> {:fail, message}
      val when is_binary(val) and byte_size(val) < 10 -> {:warn, "#{field} seems too short"}
      val when is_list(val) and length(val) == 0 -> {:fail, message}
      _ -> :pass
    end
  end

  defp check_has_field(%{text: text}, _field, _message) when is_binary(text) do
    # For raw text results (not parsed JSON), just check it's non-empty
    if String.length(text) > 20, do: :pass, else: {:warn, "Output seems very short"}
  end

  defp check_has_field(_, _, message), do: {:fail, message}

  defp check_not_empty(%{text: text}) when is_binary(text) and byte_size(text) > 0, do: :pass
  defp check_not_empty(result) when is_map(result) and map_size(result) > 0, do: :pass
  defp check_not_empty(_), do: {:fail, "Output is empty"}

  defp check_no_hallucination_markers(result) do
    text = extract_text(result)

    markers = [
      ~r/I don't have access to/i,
      ~r/I cannot verify/i,
      ~r/As an AI/i,
      ~r/I'm not able to/i,
      ~r/hypothetically/i
    ]

    found = Enum.filter(markers, &Regex.match?(&1, text))

    cond do
      length(found) >= 2 -> {:fail, "Multiple hedging/hallucination markers detected"}
      length(found) == 1 -> {:warn, "Possible hedging detected — verify claims"}
      true -> :pass
    end
  end

  defp check_actionability(result) do
    text = extract_text(result)

    action_patterns = [
      ~r/\b(implement|create|add|remove|update|migrate|refactor|fix)\b/i,
      ~r/\bstep\s+\d/i,
      ~r/\b(should|must|need to|will)\b/i
    ]

    action_count = Enum.count(action_patterns, &Regex.match?(&1, text))

    if action_count >= 1, do: :pass, else: {:warn, "Proposal may lack concrete actions"}
  end

  # ── Helpers ────────────────────────────────────────────────────────────────

  defp extract_text(%{text: text}) when is_binary(text), do: text
  defp extract_text(%{"body" => body}) when is_binary(body), do: body
  defp extract_text(%{"summary" => s}) when is_binary(s), do: s
  defp extract_text(result) when is_map(result), do: inspect(result)
  defp extract_text(_), do: ""

  defp format_feedback(failures) do
    issues =
      failures
      |> Enum.map(fn {:fail, msg} -> "- #{msg}" end)
      |> Enum.join("\n")

    """
    Your previous output did not pass quality checks. Please fix these issues:

    #{issues}

    Regenerate your response addressing all issues above. Ensure completeness.
    """
  end
end
