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
