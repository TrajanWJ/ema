defmodule Ema.ProposalEngine.Scorer do
  @moduledoc """
  Scores proposals on four dimensions after the debate stage:
  - Codebase coverage: how well the proposal addresses uncovered areas
  - Architectural coherence: alignment with existing patterns
  - Impact: estimated value relative to scope
  - Prompt specificity: how actionable the proposal text is

  Produces idea_score and prompt_quality_score (1-10 each) and
  stores a detailed score_breakdown map. Also performs duplicate
  detection via cosine similarity > 0.85.
  """

  use GenServer

  require Logger

  @duplicate_threshold 0.85

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Manually trigger scoring for a proposal."
  def score(proposal) do
    GenServer.cast(__MODULE__, {:score, proposal})
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "proposals:pipeline")
    {:ok, %{scored_count: 0}}
  end

  @impl true
  def handle_cast({:score, proposal}, state) do
    Task.Supervisor.start_child(Ema.ProposalEngine.TaskSupervisor, fn ->
      do_score(proposal)
    end)

    {:noreply, %{state | scored_count: state.scored_count + 1}}
  end

  @impl true
  def handle_info({:proposals, :debated, proposal}, state) do
    Task.Supervisor.start_child(Ema.ProposalEngine.TaskSupervisor, fn ->
      do_score(proposal)
    end)

    {:noreply, %{state | scored_count: state.scored_count + 1}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Scoring Logic ---

  defp do_score(proposal) do
    case embed_proposal(proposal) do
      {:ok, vector} ->
        duplicate_check = check_duplicates(proposal, vector)

        case duplicate_check do
          {:duplicate, similar_id, similarity} ->
            handle_duplicate(proposal, similar_id, similarity)

          :unique ->
            breakdown = compute_scores(proposal, vector)
            persist_scores(proposal, vector, breakdown)
        end

      {:error, reason} ->
        Logger.warning("Scorer: embedding failed for #{proposal.id}: #{inspect(reason)}")
        # Score without vectors using text-only heuristics
        breakdown = compute_text_scores(proposal)
        persist_scores(proposal, nil, breakdown)
    end
  end

  defp embed_proposal(proposal) do
    Ema.Vectors.Embedder.embed_proposal(proposal)
  end

  defp check_duplicates(proposal, vector) do
    results = Ema.Vectors.Index.similar_above(vector, @duplicate_threshold, project_id: proposal.project_id)

    duplicate =
      results
      |> Enum.reject(fn {entry, _sim} -> entry[:proposal_id] == proposal.id end)
      |> Enum.reject(fn {entry, _sim} -> is_nil(entry[:proposal_id]) end)
      |> List.first()

    case duplicate do
      {entry, similarity} -> {:duplicate, entry.proposal_id, similarity}
      nil -> :unique
    end
  end

  defp handle_duplicate(proposal, similar_id, similarity) do
    Logger.info(
      "Scorer: proposal #{proposal.id} is duplicate of #{similar_id} " <>
        "(similarity: #{Float.round(similarity, 3)})"
    )

    log = Map.merge(proposal.generation_log || %{}, %{
      "scorer" => %{
        "duplicate_of" => similar_id,
        "similarity" => Float.round(similarity, 3),
        "action" => "killed_as_duplicate"
      }
    })

    Ema.Proposals.update_proposal(proposal, %{
      status: "killed",
      generation_log: log,
      idea_score: 0.0,
      prompt_quality_score: 0.0,
      score_breakdown: %{"duplicate_of" => similar_id, "similarity" => similarity}
    })

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "proposals:pipeline",
      {:proposals, :duplicate_killed, proposal}
    )
  end

  defp compute_scores(proposal, vector) do
    coverage = score_codebase_coverage(proposal, vector)
    coherence = score_architectural_coherence(proposal, vector)
    impact = score_impact(proposal)
    specificity = score_prompt_specificity(proposal)

    %{
      codebase_coverage: coverage,
      architectural_coherence: coherence,
      impact: impact,
      prompt_specificity: specificity
    }
  end

  defp compute_text_scores(proposal) do
    %{
      codebase_coverage: 5.0,
      architectural_coherence: 5.0,
      impact: score_impact(proposal),
      prompt_specificity: score_prompt_specificity(proposal)
    }
  end

  defp persist_scores(proposal, vector, breakdown) do
    idea_score = compute_idea_score(breakdown)
    prompt_quality = compute_prompt_quality(breakdown)

    embedding_binary =
      if vector, do: Ema.Vectors.Index.serialize_embedding(vector), else: nil

    attrs = %{
      embedding: embedding_binary,
      idea_score: idea_score,
      prompt_quality_score: prompt_quality,
      score_breakdown: breakdown,
      generation_log:
        Map.merge(proposal.generation_log || %{}, %{
          "scorer" => %{
            "idea_score" => idea_score,
            "prompt_quality_score" => prompt_quality,
            "breakdown" => breakdown
          }
        })
    }

    case Ema.Proposals.update_proposal(proposal, attrs) do
      {:ok, updated} ->
        # Store in vector index for future comparisons
        if vector do
          Ema.Vectors.Index.upsert(%{
            proposal_id: proposal.id,
            text: "#{proposal.title}\n#{proposal.summary}",
            embedding: vector,
            project_id: proposal.project_id,
            kind: :proposal
          })
        end

        Phoenix.PubSub.broadcast(
          Ema.PubSub,
          "proposals:pipeline",
          {:proposals, :scored, updated}
        )

        Logger.info(
          "Scorer: #{proposal.id} scored idea=#{Float.round(idea_score, 1)} " <>
            "prompt=#{Float.round(prompt_quality, 1)}"
        )

      {:error, reason} ->
        Logger.error("Scorer: failed to persist scores for #{proposal.id}: #{inspect(reason)}")
    end
  end

  # --- Dimension Scorers ---

  defp score_codebase_coverage(proposal, vector) do
    # How much of the codebase does this proposal touch uncovered ground?
    # Look at nearest code chunks - if few are close, this is novel territory.
    results = Ema.Vectors.Index.nearest(vector, k: 5, project_id: proposal.project_id)

    code_results =
      results
      |> Enum.reject(fn {entry, _} -> entry[:kind] == :proposal end)

    case code_results do
      [] ->
        # No code indexed yet - neutral score
        5.0

      entries ->
        avg_similarity =
          entries
          |> Enum.map(fn {_entry, sim} -> sim end)
          |> then(fn sims -> Enum.sum(sims) / length(sims) end)

        # Low similarity to existing code = high coverage value (novel area)
        # High similarity = targeting already-covered code
        cond do
          avg_similarity < 0.2 -> 8.0 + :rand.uniform() * 2
          avg_similarity < 0.4 -> 6.0 + :rand.uniform() * 2
          avg_similarity < 0.6 -> 4.0 + :rand.uniform() * 2
          true -> 2.0 + :rand.uniform() * 2
        end
    end
  end

  defp score_architectural_coherence(proposal, vector) do
    # Does this proposal align with existing code patterns?
    # High similarity to existing code = more coherent
    results = Ema.Vectors.Index.nearest(vector, k: 10, project_id: proposal.project_id)

    code_results =
      results
      |> Enum.reject(fn {entry, _} -> entry[:kind] == :proposal end)

    case code_results do
      [] ->
        5.0

      entries ->
        max_similarity =
          entries
          |> Enum.map(fn {_entry, sim} -> sim end)
          |> Enum.max()

        # Higher similarity = better architectural coherence
        (max_similarity * 10.0) |> Float.round(1) |> min(10.0) |> max(1.0)
    end
  end

  defp score_impact(proposal) do
    scope_weight =
      case proposal.estimated_scope do
        "xl" -> 9.0
        "l" -> 7.5
        "m" -> 6.0
        "s" -> 4.0
        "xs" -> 2.5
        _ -> 5.0
      end

    benefits_count = length(proposal.benefits || [])
    risks_count = length(proposal.risks || [])

    benefit_bonus = min(benefits_count * 0.8, 3.0)
    risk_penalty = min(risks_count * 0.4, 2.0)
    confidence_factor = (proposal.confidence || 0.5) * 2.0

    (scope_weight + benefit_bonus - risk_penalty + confidence_factor)
    |> Float.round(1)
    |> min(10.0)
    |> max(1.0)
  end

  defp score_prompt_specificity(proposal) do
    body = proposal.body || ""
    title = proposal.title || ""

    body_length = String.length(body)
    has_code_refs = String.contains?(body, [".ex", ".ts", ".tsx", "def ", "function ", "class "])
    has_structure = String.contains?(body, ["\n-", "\n*", "\n1.", "##"])
    has_specifics = String.contains?(body, ["module", "component", "endpoint", "schema", "migration"])
    title_specific = String.length(title) > 15 and String.length(title) < 100

    score = 3.0
    score = if body_length > 200, do: score + 1.5, else: score
    score = if body_length > 500, do: score + 1.0, else: score
    score = if has_code_refs, do: score + 1.5, else: score
    score = if has_structure, do: score + 1.0, else: score
    score = if has_specifics, do: score + 1.0, else: score
    score = if title_specific, do: score + 1.0, else: score

    score |> Float.round(1) |> min(10.0) |> max(1.0)
  end

  # --- Composite Scores ---

  defp compute_idea_score(breakdown) do
    # Weighted average: coverage 30%, coherence 25%, impact 30%, specificity 15%
    (breakdown.codebase_coverage * 0.30 +
       breakdown.architectural_coherence * 0.25 +
       breakdown.impact * 0.30 +
       breakdown.prompt_specificity * 0.15)
    |> Float.round(1)
    |> min(10.0)
    |> max(1.0)
  end

  defp compute_prompt_quality(breakdown) do
    # Weighted: specificity 50%, coherence 25%, coverage 25%
    (breakdown.prompt_specificity * 0.50 +
       breakdown.architectural_coherence * 0.25 +
       breakdown.codebase_coverage * 0.25)
    |> Float.round(1)
    |> min(10.0)
    |> max(1.0)
  end
end
