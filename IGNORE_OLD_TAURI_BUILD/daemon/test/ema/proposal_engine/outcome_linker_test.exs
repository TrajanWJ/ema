defmodule Ema.ProposalEngine.OutcomeLinkerTest do
  use ExUnit.Case, async: true

  alias Ema.Executions.Execution
  alias Ema.ProposalEngine.OutcomeLinker
  alias Ema.Proposals.Proposal

  describe "summarize/2" do
    test "returns a linked successful outcome with excerpt and effectiveness" do
      proposal = %Proposal{id: "prop_123", title: "Ship endpoint", status: "approved"}

      summary =
        "# Delivery Notes\n\n" <>
          String.duplicate("Implemented endpoint and verified behavior. ", 8)

      execution = %Execution{
        id: "exe_123",
        status: "completed",
        mode: "implement",
        completed_at: ~U[2026-04-05 12:00:00Z],
        result_path: "/tmp/results/exe_123.md",
        metadata: %{"result_summary" => summary}
      }

      outcome = OutcomeLinker.summarize(proposal, execution)

      assert outcome.proposal == %{id: "prop_123", status: "approved", title: "Ship endpoint"}
      assert outcome.execution_exists == true
      assert outcome.execution.id == "exe_123"
      assert outcome.execution.status == "completed"
      assert outcome.execution.mode == "implement"
      assert outcome.execution.completed_at == ~U[2026-04-05 12:00:00Z]
      assert outcome.execution.result_path == "/tmp/results/exe_123.md"
      assert outcome.outcome_signal == "success"
      assert String.starts_with?(outcome.result_summary_excerpt, "# Delivery Notes")
      assert outcome.effectiveness == "effective"
    end

    test "falls back to failed/inconclusive states from execution status and missing summary" do
      proposal = %Proposal{id: "prop_456", title: "Refactor flow", status: "approved"}

      execution = %Execution{
        id: "exe_456",
        status: "failed",
        mode: "refactor",
        metadata: %{}
      }

      outcome = OutcomeLinker.summarize(proposal, execution)

      assert outcome.outcome_signal == "failed"
      assert outcome.result_summary_excerpt == nil
      assert outcome.effectiveness == "ineffective"
    end

    test "reports a proposal with no execution as not executed" do
      proposal = %Proposal{id: "prop_789", title: "Research options", status: "queued"}

      outcome = OutcomeLinker.summarize(proposal, nil)

      assert outcome.execution_exists == false
      assert outcome.execution == nil
      assert outcome.outcome_signal == "unknown"
      assert outcome.result_summary_excerpt == nil
      assert outcome.effectiveness == "not_executed"
    end
  end
end
