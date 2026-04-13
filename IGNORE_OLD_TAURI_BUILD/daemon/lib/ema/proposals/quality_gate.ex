defmodule Ema.Proposals.QualityGate do
  @moduledoc """
  Quality gate for the Proposal Orchestrator pipeline.

  Evaluates multi-stage proposal output against five dimensions:
    1. **Completeness** — Has title, summary, body, and key sections
    2. **Actionability** — Contains concrete, assignable next steps
    3. **Risk Coverage** — Identifies at least 2 specific risks
    4. **Scope Boundaries** — Clear scope definition (what's in/out)
    5. **Goal Alignment** — References project goals or objectives

  ## Return Values
    - `{:pass, output}` — All gates pass, proposal is accepted
    - `{:fail, feedback, iteration}` — One or more gates failed; feedback for revision
    - `{:pass_with_warnings, output, failures}` — Max iterations reached or minor issues

  ## Iteration Logic
    - On failure + iteration < 3 → return {:fail, feedback, iteration}
      → Orchestrator sends feedback to Bridge session and loops back to Refiner
    - On failure + iteration >= 3 → return {:pass_with_warnings, output, failures}
      → Persist with quality_score: 0.4

  ## Usage

      case QualityGate.evaluate(combined_output, :proposal, 1) do
        {:pass, output} ->
          # All checks passed — persist and emit :complete
          
        {:fail, feedback, iter} ->
          # Send feedback to Bridge, re-run from Refiner
          
        {:pass_with_warnings, output, failures} ->
          # Persist with quality_score: 0.4, emit warning
      end
  """

  require Logger

  @max_iterations 3

  # ── Public API ─────────────────────────────────────────────────────────────

  @doc """
  Evaluate proposal output against quality gates.

  ## Parameters
    - `output` — The combined output from all pipeline stages (map or string)
    - `proposal_type` — Atom like `:proposal` (only `:proposal` has full gates)
    - `iteration` — Current iteration count (1-based)
  """
  def evaluate(output, type \\ :proposal, iteration \\ 1)

  def evaluate(output, :proposal, iteration) do
    text = extract_text(output)

    checks = [
      check_completeness(text),
      check_actionability(text),
      check_risk_coverage(output, text),
      check_scope_boundaries(text),
      check_goal_alignment(text)
    ]

    decide(output, checks, iteration, :proposal)
  end

  def evaluate(output, :general, iteration) do
    text = extract_text(output)

    checks = [
      check_not_empty(text),
      check_no_hallucination_markers(text)
    ]

    decide(output, checks, iteration, :general)
  end

  def evaluate(output, _type, iteration) do
    evaluate(output, :general, iteration)
  end

  # ── Decision Logic ─────────────────────────────────────────────────────────

  defp decide(output, checks, iteration, _type) do
    failures = Enum.filter(checks, &match?({:fail, _}, &1))
    warnings = Enum.filter(checks, &match?({:warn, _}, &1))

    cond do
      failures == [] and warnings == [] ->
        Logger.info("[QualityGate] All checks passed (iteration #{iteration})")
        {:pass, output}

      failures == [] and warnings != [] ->
        warning_msgs = Enum.map(warnings, fn {:warn, msg} -> msg end)

        Logger.info(
          "[QualityGate] Passed with #{length(warnings)} warning(s) (iteration #{iteration})"
        )

        {:pass_with_warnings, output, warning_msgs}

      iteration >= @max_iterations ->
        Logger.warning(
          "[QualityGate] Max iterations (#{@max_iterations}) reached. " <>
            "Accepting with #{length(failures)} failure(s)."
        )

        all_issues =
          (failures ++ warnings)
          |> Enum.map(fn {_, msg} -> msg end)

        {:pass_with_warnings, output, all_issues}

      true ->
        feedback = format_feedback(failures, iteration)

        Logger.info(
          "[QualityGate] Iteration #{iteration}: #{length(failures)} failure(s). " <>
            "Requesting revision."
        )

        {:fail, feedback, iteration}
    end
  end

  # ── Gate Functions ─────────────────────────────────────────────────────────

  @doc false
  def check_completeness(text) when is_binary(text) do
    issues = []

    # Must have some substantial content
    issues =
      if String.length(text) < 200 do
        ["Proposal is too short (minimum 200 characters)"] ++ issues
      else
        issues
      end

    # Should have a title or header
    issues =
      if not Regex.match?(~r/(^|\n)\#{1,3}\s+\S|^title:/im, text) do
        ["Missing a clear title or heading"] ++ issues
      else
        issues
      end

    # Should have a summary or overview section
    issues =
      if not Regex.match?(~r/(summary|overview|abstract|introduction)/i, text) do
        ["Missing summary or overview section"] ++ issues
      else
        issues
      end

    case issues do
      [] -> :pass
      [single] -> {:fail, single}
      multiple -> {:fail, "Completeness issues: " <> Enum.join(multiple, "; ")}
    end
  end

  def check_completeness(_), do: {:fail, "Proposal content is empty"}

  @doc false
  def check_actionability(text) when is_binary(text) do
    # Look for concrete action verbs, numbered steps, or task language
    action_patterns = [
      ~r/\b(implement|create|add|remove|update|migrate|refactor|fix|deploy|test|write|build|configure)\b/i,
      ~r/\bstep\s+\d+/i,
      ~r/^\d+\.\s+\S/m,
      ~r/\b(next steps?|action items?|todo|to-do)\b/i,
      ~r/\b(should|must|will|need to|requires?)\s+\w+/i
    ]

    matches = Enum.count(action_patterns, &Regex.match?(&1, text))

    cond do
      matches >= 2 -> :pass
      matches == 1 -> {:warn, "Steps not clearly assignable — add specific action items"}
      true -> {:fail, "Steps not assignable — missing concrete next steps with clear ownership"}
    end
  end

  def check_actionability(_), do: {:fail, "Cannot check actionability: empty content"}

  @doc false
  def check_risk_coverage(output, text) when is_binary(text) do
    risks_text =
      case output do
        %{risks_text: rt} when is_binary(rt) and byte_size(rt) > 0 -> rt
        _ -> text
      end

    # Count explicit risk mentions
    risk_bullet_count =
      risks_text
      |> String.split("\n")
      |> Enum.count(fn line ->
        Regex.match?(~r/^[\-\*]\s+.+(risk|issue|concern|challenge|problem)/i, line) or
          (Regex.match?(~r/^[\-\*]\s+\S.{10,}/, line) and
             Regex.match?(~r/(risk|issue|concern|challenge|problem|mitigation)/i, risks_text))
      end)

    risk_section_present = Regex.match?(~r/(risk|risks|challenges?|concerns?)/i, text)

    mitigation_present =
      Regex.match?(~r/(mitigation|mitigate|address|reduce|minimize)/i, risks_text)

    cond do
      not risk_section_present ->
        {:fail, "Missing risk section — must identify and analyze specific risks"}

      risk_bullet_count < 2 and not mitigation_present ->
        {:fail,
         "Insufficient risk coverage — identify at least 2 specific risks with mitigations"}

      not mitigation_present ->
        {:warn, "Risk mitigation strategies not clearly stated"}

      true ->
        :pass
    end
  end

  def check_risk_coverage(_, _), do: {:fail, "Cannot check risk coverage: empty content"}

  @doc false
  def check_scope_boundaries(text) when is_binary(text) do
    in_scope = Regex.match?(~r/(in[\s\-]scope|includes?|covers?|within scope)/i, text)

    out_scope =
      Regex.match?(
        ~r/(out[\s\-]of[\s\-]scope|excludes?|does not include|won't cover|not included)/i,
        text
      )

    scope_section = Regex.match?(~r/(scope|boundaries|limitations?)/i, text)

    cond do
      in_scope and out_scope -> :pass
      scope_section -> {:warn, "Scope section exists but in/out boundaries not explicitly stated"}
      true -> {:fail, "Scope not bounded — must define what is in-scope and out-of-scope"}
    end
  end

  def check_scope_boundaries(_), do: {:fail, "Cannot check scope: empty content"}

  @doc false
  def check_goal_alignment(text) when is_binary(text) do
    goal_patterns = [
      ~r/\b(goal|objective|aim|purpose|outcome|target|mission)\b/i,
      ~r/\b(aligns?|supports?|enables?|achieves?|accomplishes?)\b/i,
      ~r/\b(benefit|value|impact|improvement|enhancement)\b/i
    ]

    matches = Enum.count(goal_patterns, &Regex.match?(&1, text))

    cond do
      matches >= 2 ->
        :pass

      matches == 1 ->
        {:warn, "Goal alignment is weak — explicitly link to project objectives"}

      true ->
        {:fail, "Goal not aligned — proposal must trace back to a project goal or objective"}
    end
  end

  def check_goal_alignment(_), do: {:fail, "Cannot check goal alignment: empty content"}

  # ── Shared Checks ──────────────────────────────────────────────────────────

  defp check_not_empty(text) when is_binary(text) and byte_size(text) > 0, do: :pass
  defp check_not_empty(_), do: {:fail, "Output is empty"}

  defp check_no_hallucination_markers(text) when is_binary(text) do
    markers = [
      ~r/I don't have access to/i,
      ~r/I cannot verify/i,
      ~r/As an AI/i,
      ~r/I'm not able to/i,
      ~r/I do not have the ability/i
    ]

    found = Enum.filter(markers, &Regex.match?(&1, text))

    cond do
      length(found) >= 2 -> {:fail, "Multiple AI refusal markers detected — check prompt"}
      length(found) == 1 -> {:warn, "Possible hedging detected"}
      true -> :pass
    end
  end

  defp check_no_hallucination_markers(_), do: :pass

  # ── Feedback Formatting ────────────────────────────────────────────────────

  defp format_feedback(failures, iteration) do
    issue_list =
      failures
      |> Enum.map(fn {:fail, msg} -> "• #{msg}" end)
      |> Enum.join("\n")

    """
    === Quality Gate Feedback (Iteration #{iteration}) ===

    Your proposal did not meet the following quality standards:

    #{issue_list}

    Please revise the proposal to address ALL of the above issues.

    Specific guidance:
    #{generate_specific_guidance(failures)}

    Ensure the final proposal has:
    - A clear title and summary
    - Concrete, assignable next steps
    - At least 2 identified risks with mitigation strategies
    - Explicit in-scope / out-of-scope boundaries
    - Clear connection to project goals
    """
  end

  defp generate_specific_guidance(failures) do
    failures
    |> Enum.map(fn {:fail, msg} ->
      case msg do
        "Missing risk section" <> _ ->
          "  → Add a '## Risks' section listing specific risks as bullet points"

        "Steps not assignable" <> _ ->
          "  → Add a '## Next Steps' section with numbered, clearly assignable tasks"

        "Scope not bounded" <> _ ->
          "  → Add a '## Scope' section with '**In scope:**' and '**Out of scope:**' subsections"

        "Goal not aligned" <> _ ->
          "  → Add a '## Goal Alignment' section explaining how this supports project objectives"

        "Missing summary" <> _ ->
          "  → Add a '## Summary' section with 2-3 sentences describing the proposal"

        _ ->
          "  → Fix: #{msg}"
      end
    end)
    |> Enum.join("\n")
  end

  # ── Text Extraction ────────────────────────────────────────────────────────

  defp extract_text(%{text: text}) when is_binary(text), do: text
  defp extract_text(text) when is_binary(text), do: text

  defp extract_text(%{all_stages: stages}) when is_map(stages) do
    formatter = Map.get(stages, :formatter, "")
    refiner = Map.get(stages, :refiner, "")
    if byte_size(formatter) > 0, do: formatter, else: refiner
  end

  defp extract_text(_), do: ""
end
