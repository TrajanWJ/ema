defmodule Ema.ProposalEngine.OutcomeLinker do
  @moduledoc """
  Resolves the current execution outcome view for a proposal.
  """

  alias Ema.Executions.Execution
  alias Ema.Executions.Router
  alias Ema.Proposals.Proposal

  @excerpt_limit 240
  @pending_statuses ~w(created proposed awaiting_approval approved delegated running harvesting)

  @spec summarize(Proposal.t(), Execution.t() | nil) :: map()
  def summarize(%Proposal{} = proposal, %Execution{} = execution) do
    result_summary = get_in(execution.metadata || %{}, ["result_summary"])
    outcome_signal = infer_outcome_signal(execution, result_summary)

    %{
      proposal: %{
        id: proposal.id,
        status: proposal.status,
        title: proposal.title
      },
      execution_exists: true,
      execution: %{
        id: execution.id,
        status: execution.status,
        mode: execution.mode,
        completed_at: execution.completed_at,
        result_path: execution.result_path
      },
      outcome_signal: Atom.to_string(outcome_signal),
      result_summary_excerpt: excerpt(result_summary),
      effectiveness: classify_effectiveness(execution.status, outcome_signal)
    }
  end

  def summarize(%Proposal{} = proposal, nil) do
    %{
      proposal: %{
        id: proposal.id,
        status: proposal.status,
        title: proposal.title
      },
      execution_exists: false,
      execution: nil,
      outcome_signal: "unknown",
      result_summary_excerpt: nil,
      effectiveness: "not_executed"
    }
  end

  @spec infer_outcome_signal(Execution.t(), String.t() | nil) ::
          :success | :partial | :failed | :unknown
  def infer_outcome_signal(_execution, result_summary)
      when is_binary(result_summary) and result_summary != "" do
    Router.classify_outcome(result_summary)
  end

  def infer_outcome_signal(%Execution{status: status}, _result_summary)
      when status in ["failed", "cancelled"] do
    :failed
  end

  def infer_outcome_signal(_execution, _result_summary), do: :unknown

  @spec classify_effectiveness(String.t(), :success | :partial | :failed | :unknown) :: String.t()
  def classify_effectiveness(status, _signal) when status in @pending_statuses, do: "pending"
  def classify_effectiveness("completed", :success), do: "effective"
  def classify_effectiveness("completed", :partial), do: "mixed"
  def classify_effectiveness("completed", :failed), do: "ineffective"

  def classify_effectiveness(status, :failed) when status in ["failed", "cancelled"],
    do: "ineffective"

  def classify_effectiveness(_status, _signal), do: "inconclusive"

  @doc """
  Feed outcome effectiveness back to the originating seed.
  Deactivates seeds with avg < 0.3 after 3+ proposals; logs high-performers > 0.7.
  """
  def feed_seed_quality(%Proposal{seed_id: nil}, _effectiveness), do: :ok

  def feed_seed_quality(%Proposal{seed_id: seed_id}, effectiveness) do
    require Logger

    with seed when not is_nil(seed) <- Ema.Proposals.get_seed(seed_id) do
      score = effectiveness_score(effectiveness)
      scores = Map.get(seed.metadata || %{}, "outcome_scores", [])
      updated_scores = (scores ++ [score]) |> Enum.take(-20)
      avg = Enum.sum(updated_scores) / length(updated_scores)

      new_metadata =
        Map.merge(seed.metadata || %{}, %{
          "outcome_scores" => updated_scores,
          "avg_effectiveness" => Float.round(avg, 3)
        })

      attrs = %{metadata: new_metadata}

      attrs =
        cond do
          length(updated_scores) >= 3 and avg < 0.3 ->
            Logger.info(
              "[OutcomeLinker] Deactivating low-performing seed #{seed_id} (avg: #{avg})"
            )

            Map.put(attrs, :active, false)

          length(updated_scores) >= 3 and avg > 0.7 ->
            Logger.info("[OutcomeLinker] High-performing seed #{seed_id} (avg: #{avg})")
            attrs

          true ->
            attrs
        end

      Ema.Proposals.update_seed(seed, attrs)
    end
  end

  defp effectiveness_score("effective"), do: 1.0
  defp effectiveness_score("mixed"), do: 0.5
  defp effectiveness_score("ineffective"), do: 0.0
  defp effectiveness_score("pending"), do: 0.5
  defp effectiveness_score(_), do: 0.3

  @doc """
  Run the full outcome feedback loop for a completed execution.

  Resolves the originating proposal, computes effectiveness, updates seed
  quality scores, and feeds low-scoring proposals back to KillMemory so the
  pattern is suppressed in future runs even when the user never explicitly
  killed the proposal.

  Always returns `:ok` — failures are logged but never propagated.
  """
  def feed_back(execution) do
    require Logger

    proposal_id = Map.get(execution, :proposal_id)

    if is_binary(proposal_id) and proposal_id != "" do
      case Ema.Proposals.get_proposal(proposal_id) do
        nil ->
          :ok

        proposal ->
          summary = summarize(proposal, execution)
          effectiveness = summary.effectiveness
          score = effectiveness_score(effectiveness)

          feed_seed_quality(proposal, effectiveness)
          maybe_feed_kill_memory(proposal, score, effectiveness)
      end
    end

    :ok
  rescue
    e ->
      require Logger
      Logger.debug("[OutcomeLinker] feed_back crashed: #{Exception.message(e)}")
      :ok
  end

  # When an execution's outcome scores poorly (<0.3), broadcast a synthetic
  # `proposal_killed` event so KillMemory records the title/tag pattern.
  # KillMemory subscribes to "proposals:events" and indexes anything it sees
  # via that topic — this gives us implicit kills from observed failures.
  defp maybe_feed_kill_memory(_proposal, score, _effectiveness) when score >= 0.3, do: :ok

  defp maybe_feed_kill_memory(proposal, _score, effectiveness) do
    require Logger

    Logger.info(
      "[OutcomeLinker] Feeding KillMemory: proposal=#{proposal.id} effectiveness=#{effectiveness}"
    )

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "proposals:events",
      {"proposal_killed", proposal}
    )

    :ok
  end

  defp excerpt(nil), do: nil
  defp excerpt(""), do: nil

  defp excerpt(text) do
    normalized = text |> String.replace(~r/\s+/, " ") |> String.trim()

    if String.length(normalized) <= @excerpt_limit do
      normalized
    else
      String.slice(normalized, 0, @excerpt_limit) <> "..."
    end
  end
end
