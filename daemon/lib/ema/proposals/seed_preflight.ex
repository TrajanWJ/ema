defmodule Ema.Proposals.SeedPreflight do
  @moduledoc """
  Quality gate that runs before any proposal generation.

  Normalizes raw seeds into a canonical shape, scores them on a 100-point
  deterministic rubric, checks for duplicates against recent proposals,
  and optionally enriches low-scoring seeds with one bounded rewrite.

  ## Operational modes (configurable via application env)
    - `:observe`      — score and log, always pass
    - `:enrich_only`  — enrich below-threshold seeds but never reject
    - `:enforce`      — reject seeds that fail after enrichment

  ## Results
    - `{:pass, normalized_seed, diagnostics}`
    - `{:rewrite, normalized_seed, diagnostics}` — enriched and rescored
    - `{:duplicate, diagnostics}`
    - `{:reject, diagnostics}`
  """

  require Logger

  alias Ema.Proposals

  # --- Configuration defaults ---

  @default_mode :enforce
  @default_minimum_score 40
  @default_duplicate_threshold 0.6
  @duplicate_window_days 30
  @duplicate_max_recent 100

  # Stopwords excluded from token overlap calculations
  @stopwords MapSet.new(~w(
    the a an is are was were be been being have has had do does did
    will would shall should may might can could of in to for with on
    at by from as into through during before after above below between
    and or but not no nor so yet both either neither each every all
    any few more most other some such this that these those it its
    add update fix implement create use make
  ))

  # Vague verbs that indicate low specificity
  @vague_verbs MapSet.new(~w(
    improve enhance optimize better leverage utilize streamline
    refactor modernize upgrade boost revamp overhaul
  ))

  # --- Canonical seed fields ---

  @canonical_fields [
    :problem_statement,
    :current_behavior,
    :desired_behavior,
    :constraints,
    :affected_area,
    :non_goals,
    :validation_plan,
    :success_metrics,
    :rollback_plan
  ]

  # ── Public API ──────────────────────────────────────────────────────────────

  @doc """
  Run the preflight check on a seed before generation.

  Returns `{:pass | :rewrite | :duplicate | :reject, seed_or_nil, diagnostics}`.
  """
  def check(seed) do
    config = load_config()
    normalized = normalize(seed)
    recent_proposals = fetch_recent_proposals(seed.project_id)

    diagnostics = %{
      mode: config.mode,
      minimum_score: config.minimum_score,
      seed_id: seed.id,
      seed_name: seed.name
    }

    # Step 1: Duplicate check
    case check_duplicates(normalized, recent_proposals, config) do
      {:duplicate, dup_info} ->
        diag = Map.merge(diagnostics, %{
          result: :duplicate,
          duplicate_info: dup_info
        })

        Logger.info("[SeedPreflight] Seed #{seed.id} rejected as duplicate: #{inspect(dup_info)}")
        handle_mode(:duplicate, normalized, diag, config)

      :ok ->
        # Step 2: Score
        {score, breakdown} = score(normalized, recent_proposals)

        diag = Map.merge(diagnostics, %{
          initial_score: score,
          score_breakdown: breakdown
        })

        if score >= config.minimum_score do
          diag = Map.put(diag, :result, :pass)
          Logger.info("[SeedPreflight] Seed #{seed.id} passed (score: #{score})")
          {:pass, normalized, diag}
        else
          # Step 3: One bounded enrichment attempt
          enriched = enrich(normalized, breakdown)
          {rescore, rebreakdown} = score(enriched, recent_proposals)

          diag = Map.merge(diag, %{
            enriched_score: rescore,
            enriched_breakdown: rebreakdown
          })

          if rescore >= config.minimum_score do
            diag = Map.put(diag, :result, :rewrite)
            Logger.info("[SeedPreflight] Seed #{seed.id} passed after enrichment (#{score} -> #{rescore})")
            handle_mode(:rewrite, enriched, diag, config)
          else
            diag = Map.put(diag, :result, :reject)
            Logger.info("[SeedPreflight] Seed #{seed.id} rejected (#{score} -> #{rescore})")
            handle_mode(:reject, enriched, diag, config)
          end
        end
    end
  end

  @doc """
  Normalize a seed into the canonical shape with all required fields populated.
  Pure function — no side effects.
  """
  def normalize(seed) do
    template = seed.prompt_template || ""
    metadata = seed.metadata || %{}
    context = seed.context_injection || %{}

    # Extract sections from prompt template
    sections = parse_sections(template)

    # Build canonical map, pulling from metadata, context_injection, and parsed sections
    canonical =
      %{
        problem_statement: pick(sections["problem"], metadata["problem_statement"], template),
        current_behavior: pick(sections["current"], metadata["current_behavior"], "Not specified"),
        desired_behavior: pick(sections["desired"], metadata["desired_behavior"], "Not specified"),
        constraints: pick(sections["constraints"], metadata["constraints"], "None specified"),
        affected_area: pick(
          sections["affected"],
          metadata["affected_area"],
          context["affected_module"],
          infer_affected_area(seed)
        ),
        non_goals: pick(sections["non_goals"], metadata["non_goals"], "Not specified"),
        validation_plan: pick(
          sections["validation"],
          metadata["validation_plan"],
          "Manual review"
        ),
        success_metrics: pick(
          sections["success"],
          metadata["success_metrics"],
          "Not specified"
        ),
        rollback_plan: pick(
          sections["rollback"],
          metadata["rollback_plan"],
          "Revert commit"
        )
      }

    Map.put(seed, :canonical, canonical)
  end

  @doc """
  Score a normalized seed on the 100-point rubric. Returns `{total_score, breakdown}`.
  """
  def score(seed, recent_proposals \\ []) do
    canonical = seed.canonical || %{}
    template = seed.prompt_template || ""

    clarity = score_clarity(canonical, template)
    specificity = score_specificity(canonical, template)
    readiness = score_readiness(canonical)
    novelty = score_novelty(template, recent_proposals)
    completeness = score_completeness(canonical)

    raw = clarity + specificity + readiness + novelty + completeness

    # Deductions
    deductions = calculate_deductions(canonical, template, recent_proposals)

    total = max(0, raw - deductions.total)

    breakdown = %{
      clarity: clarity,
      specificity: specificity,
      readiness: readiness,
      novelty: novelty,
      completeness: completeness,
      deductions: deductions,
      raw: raw,
      total: total
    }

    {total, breakdown}
  end

  # ── Mode handling ───────────────────────────────────────────────────────────

  defp handle_mode(:duplicate, seed, diag, %{mode: :observe}) do
    {:pass, seed, diag}
  end

  defp handle_mode(:duplicate, seed, diag, %{mode: :enrich_only}) do
    {:pass, seed, diag}
  end

  defp handle_mode(:duplicate, _seed, diag, %{mode: :enforce}) do
    {:duplicate, nil, diag}
  end

  defp handle_mode(:rewrite, seed, diag, _config) do
    {:rewrite, seed, diag}
  end

  defp handle_mode(:reject, seed, diag, %{mode: :observe}) do
    {:pass, seed, Map.put(diag, :observe_note, "Would have rejected")}
  end

  defp handle_mode(:reject, seed, diag, %{mode: :enrich_only}) do
    {:rewrite, seed, diag}
  end

  defp handle_mode(:reject, _seed, diag, %{mode: :enforce}) do
    {:reject, nil, diag}
  end

  # ── Normalization helpers ───────────────────────────────────────────────────

  defp parse_sections(template) when is_binary(template) do
    # Match markdown-style sections: ## Problem, ## Current, etc.
    # Also match label: value patterns
    section_patterns = [
      {"problem", ~r/(?:^##?\s*problem[:\s]*|^problem[:\s]+)(.+?)(?=^##?\s|\z)/mis},
      {"current", ~r/(?:^##?\s*current[:\s]*|^current[_ ]?behavior[:\s]+)(.+?)(?=^##?\s|\z)/mis},
      {"desired", ~r/(?:^##?\s*desired[:\s]*|^desired[_ ]?behavior[:\s]+)(.+?)(?=^##?\s|\z)/mis},
      {"constraints", ~r/(?:^##?\s*constraints?[:\s]*|^constraints?[:\s]+)(.+?)(?=^##?\s|\z)/mis},
      {"affected", ~r/(?:^##?\s*affected[:\s]*|^affected[_ ]?(?:area|module)[:\s]+)(.+?)(?=^##?\s|\z)/mis},
      {"non_goals", ~r/(?:^##?\s*non[- _]?goals?[:\s]*|^non[- _]?goals?[:\s]+)(.+?)(?=^##?\s|\z)/mis},
      {"validation", ~r/(?:^##?\s*validation[:\s]*|^validation[_ ]?(?:plan|strategy)[:\s]+)(.+?)(?=^##?\s|\z)/mis},
      {"success", ~r/(?:^##?\s*success[:\s]*|^success[_ ]?metrics?[:\s]+)(.+?)(?=^##?\s|\z)/mis},
      {"rollback", ~r/(?:^##?\s*rollback[:\s]*|^rollback[_ ]?plan[:\s]+)(.+?)(?=^##?\s|\z)/mis}
    ]

    Enum.reduce(section_patterns, %{}, fn {key, pattern}, acc ->
      case Regex.run(pattern, template) do
        [_, content] ->
          trimmed = String.trim(content)
          if trimmed != "", do: Map.put(acc, key, trimmed), else: acc

        _ ->
          acc
      end
    end)
  end

  defp parse_sections(_), do: %{}

  defp pick(values) when is_list(values) do
    Enum.find(values, "Not specified", fn
      nil -> false
      "" -> false
      "Not specified" -> false
      _ -> true
    end)
  end

  defp pick(v1, v2, v3), do: pick([v1, v2, v3])
  defp pick(v1, v2, v3, v4), do: pick([v1, v2, v3, v4])

  defp infer_affected_area(seed) do
    cond do
      seed.project_id -> "Project: #{seed.project_id}"
      seed.seed_type == "vault" -> "Vault/Knowledge base"
      seed.seed_type == "brain_dump" -> "Brain dump / Inbox"
      true -> "Not specified"
    end
  end

  # ── Scoring: Clarity (25 pts) ───────────────────────────────────────────────

  defp score_clarity(canonical, template) do
    points = 0

    # Problem statement exists and is substantive (0-10)
    problem = canonical[:problem_statement] || ""
    points = points + score_field_substance(problem, 10)

    # Current vs desired behavior differentiated (0-8)
    current = canonical[:current_behavior] || ""
    desired = canonical[:desired_behavior] || ""
    points = points + score_differentiation(current, desired, 8)

    # Template length indicates thought (0-7)
    word_count = template |> String.split(~r/\s+/) |> length()

    points =
      points +
        cond do
          word_count >= 100 -> 7
          word_count >= 50 -> 5
          word_count >= 20 -> 3
          word_count >= 10 -> 1
          true -> 0
        end

    min(points, 25)
  end

  # ── Scoring: Specificity (25 pts) ──────────────────────────────────────────

  defp score_specificity(canonical, template) do
    points = 0

    # Affected area specified (0-8)
    affected = canonical[:affected_area] || ""

    points =
      points +
        cond do
          String.contains?(affected, "/") or String.contains?(affected, ".ex") -> 8
          affected != "Not specified" and String.length(affected) > 5 -> 5
          affected != "Not specified" -> 2
          true -> 0
        end

    # Constraints mentioned (0-7)
    constraints = canonical[:constraints] || ""
    points = points + score_field_substance(constraints, 7)

    # No vague verbs penalty check — counted here as positive for specificity
    template_words =
      template
      |> String.downcase()
      |> String.split(~r/\s+/)
      |> MapSet.new()

    vague_count = MapSet.intersection(template_words, @vague_verbs) |> MapSet.size()
    points = points + if(vague_count == 0, do: 5, else: max(0, 5 - vague_count))

    # Non-goals specified (0-5) — shows scoping thought
    non_goals = canonical[:non_goals] || ""
    points = points + if(non_goals != "Not specified" and String.length(non_goals) > 5, do: 5, else: 0)

    min(points, 25)
  end

  # ── Scoring: Implementation readiness (25 pts) ─────────────────────────────

  defp score_readiness(canonical) do
    points = 0

    # Validation plan (0-10)
    validation = canonical[:validation_plan] || ""

    points =
      points +
        cond do
          validation != "Manual review" and String.length(validation) > 20 -> 10
          validation != "Manual review" and String.length(validation) > 5 -> 6
          validation == "Manual review" -> 2
          true -> 0
        end

    # Success metrics (0-8)
    metrics = canonical[:success_metrics] || ""

    points =
      points +
        cond do
          String.contains?(metrics, "%") or Regex.match?(~r/\d/, metrics) -> 8
          metrics != "Not specified" and String.length(metrics) > 10 -> 5
          metrics != "Not specified" -> 2
          true -> 0
        end

    # Rollback plan (0-7)
    rollback = canonical[:rollback_plan] || ""

    points =
      points +
        cond do
          rollback != "Revert commit" and String.length(rollback) > 10 -> 7
          rollback == "Revert commit" -> 3
          true -> 0
        end

    min(points, 25)
  end

  # ── Scoring: Novelty (15 pts) ──────────────────────────────────────────────

  defp score_novelty(template, recent_proposals) do
    if recent_proposals == [] do
      # No history to compare against — full novelty
      15
    else
      seed_tokens = tokenize(template)

      max_overlap =
        recent_proposals
        |> Enum.map(fn p ->
          proposal_tokens = tokenize("#{p.title} #{p.summary} #{p.body}")
          token_overlap(seed_tokens, proposal_tokens)
        end)
        |> Enum.max(fn -> 0.0 end)

      cond do
        max_overlap < 0.2 -> 15
        max_overlap < 0.3 -> 12
        max_overlap < 0.4 -> 9
        max_overlap < 0.5 -> 6
        max_overlap < 0.6 -> 3
        true -> 0
      end
    end
  end

  # ── Scoring: Completeness (10 pts) ─────────────────────────────────────────

  defp score_completeness(canonical) do
    filled =
      @canonical_fields
      |> Enum.count(fn field ->
        val = Map.get(canonical, field, "Not specified")
        val != "Not specified" and val != "" and val != nil
      end)

    # 10 points scaled by fraction of fields filled
    round(filled / length(@canonical_fields) * 10)
  end

  # ── Deductions ─────────────────────────────────────────────────────────────

  defp calculate_deductions(canonical, template, recent_proposals) do
    deductions = []

    # Missing affected module: -15
    affected = canonical[:affected_area] || "Not specified"

    deductions =
      if affected == "Not specified",
        do: [{:missing_affected_module, 15} | deductions],
        else: deductions

    # No validation strategy: -10
    validation = canonical[:validation_plan] || ""

    deductions =
      if validation == "" or validation == "Not specified",
        do: [{:no_validation_strategy, 10} | deductions],
        else: deductions

    # No success metric: -10
    metrics = canonical[:success_metrics] || ""

    deductions =
      if metrics == "" or metrics == "Not specified",
        do: [{:no_success_metric, 10} | deductions],
        else: deductions

    # No rollback: -10
    rollback = canonical[:rollback_plan] || ""

    deductions =
      if rollback == "" or rollback == "Not specified",
        do: [{:no_rollback, 10} | deductions],
        else: deductions

    # Vague verbs: -10
    template_words =
      template
      |> String.downcase()
      |> String.split(~r/\s+/)
      |> MapSet.new()

    vague_count = MapSet.intersection(template_words, @vague_verbs) |> MapSet.size()

    deductions =
      if vague_count >= 3,
        do: [{:vague_verbs, 10} | deductions],
        else: deductions

    # Overlap with killed proposals: -20
    killed_overlap = check_killed_overlap(template, recent_proposals)

    deductions =
      if killed_overlap,
        do: [{:killed_overlap, 20} | deductions],
        else: deductions

    total = deductions |> Enum.map(fn {_reason, pts} -> pts end) |> Enum.sum()

    %{items: deductions, total: total}
  end

  defp check_killed_overlap(template, recent_proposals) do
    killed =
      recent_proposals
      |> Enum.filter(fn p -> p.status == "killed" end)

    if killed == [] do
      false
    else
      seed_tokens = tokenize(template)

      Enum.any?(killed, fn p ->
        proposal_tokens = tokenize("#{p.title} #{p.summary}")
        token_overlap(seed_tokens, proposal_tokens) > 0.5
      end)
    end
  end

  # ── Duplicate detection ────────────────────────────────────────────────────

  defp check_duplicates(normalized, recent_proposals, config) do
    template = normalized.prompt_template || ""

    # Stage 1: Exact fingerprint
    fingerprint = :crypto.hash(:sha256, template) |> Base.encode16(case: :lower)

    exact_match =
      Enum.find(recent_proposals, fn p ->
        p_fingerprint =
          :crypto.hash(:sha256, "#{p.title}\n#{p.body}")
          |> Base.encode16(case: :lower)

        fingerprint == p_fingerprint
      end)

    if exact_match do
      {:duplicate, %{type: :exact, proposal_id: exact_match.id, title: exact_match.title}}
    else
      # Stage 2: Token overlap
      seed_tokens = tokenize(template)

      high_overlap =
        Enum.find(recent_proposals, fn p ->
          proposal_tokens = tokenize("#{p.title} #{p.summary} #{p.body}")
          overlap = token_overlap(seed_tokens, proposal_tokens)
          overlap >= config.duplicate_threshold
        end)

      if high_overlap do
        {:duplicate,
         %{type: :token_overlap, proposal_id: high_overlap.id, title: high_overlap.title}}
      else
        :ok
      end
    end
  end

  # ── Enrichment (one bounded rewrite) ───────────────────────────────────────

  defp enrich(seed, breakdown) do
    canonical = seed.canonical || %{}
    deductions = breakdown.deductions || %{items: []}
    deduction_reasons = Enum.map(deductions.items, fn {reason, _} -> reason end)

    enriched_canonical =
      canonical
      |> maybe_enrich_field(
        :affected_area,
        :missing_affected_module,
        deduction_reasons,
        &infer_affected_area(seed)
      )
      |> maybe_enrich_field(
        :validation_plan,
        :no_validation_strategy,
        deduction_reasons,
        fn -> build_default_validation(canonical) end
      )
      |> maybe_enrich_field(
        :success_metrics,
        :no_success_metric,
        deduction_reasons,
        fn -> build_default_metrics(canonical) end
      )
      |> maybe_enrich_field(
        :rollback_plan,
        :no_rollback,
        deduction_reasons,
        fn -> "Revert the change; no data migration involved" end
      )

    Map.put(seed, :canonical, enriched_canonical)
  end

  defp maybe_enrich_field(canonical, field, deduction, deduction_reasons, generator) do
    current = Map.get(canonical, field)

    if deduction in deduction_reasons and (current == nil or current == "Not specified" or current == "") do
      Map.put(canonical, field, generator.())
    else
      canonical
    end
  end

  defp build_default_validation(canonical) do
    affected = canonical[:affected_area] || "the system"
    "Verify #{affected} works as expected after change. Run existing test suite."
  end

  defp build_default_metrics(canonical) do
    problem = canonical[:problem_statement] || "the issue"

    "#{problem} is resolved. No regressions in affected area."
    |> String.slice(0..200)
  end

  # ── Text analysis helpers ──────────────────────────────────────────────────

  defp tokenize(text) when is_binary(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s]/, " ")
    |> String.split(~r/\s+/, trim: true)
    |> Enum.reject(fn word -> MapSet.member?(@stopwords, word) end)
    |> Enum.reject(fn word -> String.length(word) < 3 end)
    |> MapSet.new()
  end

  defp tokenize(_), do: MapSet.new()

  defp token_overlap(set_a, set_b) do
    a_size = MapSet.size(set_a)
    b_size = MapSet.size(set_b)

    if a_size == 0 or b_size == 0 do
      0.0
    else
      intersection = MapSet.intersection(set_a, set_b) |> MapSet.size()
      # Jaccard similarity
      union = a_size + b_size - intersection
      if union > 0, do: intersection / union, else: 0.0
    end
  end

  defp score_field_substance(value, max_points) do
    cond do
      value in [nil, "", "Not specified"] -> 0
      String.length(value) > 50 -> max_points
      String.length(value) > 20 -> round(max_points * 0.7)
      String.length(value) > 5 -> round(max_points * 0.4)
      true -> round(max_points * 0.1)
    end
  end

  defp score_differentiation(current, desired, max_points) do
    cond do
      current in ["Not specified", ""] or desired in ["Not specified", ""] -> 0
      current == desired -> 0
      true ->
        current_tokens = tokenize(current)
        desired_tokens = tokenize(desired)
        overlap = token_overlap(current_tokens, desired_tokens)

        if overlap < 0.5, do: max_points, else: round(max_points * 0.5)
    end
  end

  # ── Data fetching ──────────────────────────────────────────────────────────

  defp fetch_recent_proposals(project_id) do
    cutoff =
      DateTime.utc_now()
      |> DateTime.add(-@duplicate_window_days * 86_400, :second)

    opts =
      [limit: @duplicate_max_recent]
      |> then(fn o -> if project_id, do: Keyword.put(o, :project_id, project_id), else: o end)

    Proposals.list_proposals(opts)
    |> Enum.filter(fn p ->
      case p.inserted_at do
        %DateTime{} = dt -> DateTime.compare(dt, cutoff) == :gt
        _ -> true
      end
    end)
  rescue
    _ -> []
  end

  # ── Configuration ──────────────────────────────────────────────────────────

  defp load_config do
    app_config = Application.get_env(:ema, :seed_preflight, [])

    %{
      mode: Keyword.get(app_config, :mode, @default_mode),
      minimum_score: Keyword.get(app_config, :minimum_score, @default_minimum_score),
      duplicate_threshold:
        Keyword.get(app_config, :duplicate_similarity_threshold, @default_duplicate_threshold)
    }
  end
end
