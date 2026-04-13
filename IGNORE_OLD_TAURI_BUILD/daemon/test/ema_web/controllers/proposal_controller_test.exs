defmodule EmaWeb.ProposalControllerTest do
  use EmaWeb.ConnCase, async: false

  alias Ema.Executions.Execution
  alias Ema.Proposals
  alias Ema.Repo

  defp create_proposal(attrs \\ %{}) do
    defaults = %{
      title: "Proposal Outcome Slice",
      summary: "Add proposal outcome endpoint",
      body: "Link proposals to execution outcomes"
    }

    {:ok, proposal} = Proposals.create_proposal(Map.merge(defaults, attrs))
    proposal
  end

  defp insert_execution!(attrs) do
    %Execution{}
    |> Execution.changeset(
      Map.merge(
        %{
          id: "exe_" <> Integer.to_string(System.unique_integer([:positive])),
          title: "Execution",
          mode: "implement",
          status: "completed"
        },
        attrs
      )
    )
    |> Repo.insert!()
  end

  describe "GET /api/proposals/:id/outcome" do
    test "returns linked proposal outcome data", %{conn: conn} do
      proposal = create_proposal(%{status: "approved"})

      summary =
        "# Result\n\n" <>
          String.duplicate("Completed the endpoint, tests, and compile verification. ", 7)

      insert_execution!(%{
        proposal_id: proposal.id,
        title: proposal.title,
        metadata: %{"result_summary" => summary},
        result_path: "/tmp/proposal-results/#{proposal.id}.md",
        completed_at: ~U[2026-04-05 13:00:00Z]
      })

      conn = get(conn, ~p"/api/proposals/#{proposal.id}/outcome")
      body = json_response(conn, 200)

      assert body["proposal"] == %{
               "id" => proposal.id,
               "status" => "approved",
               "title" => "Proposal Outcome Slice"
             }

      assert body["execution_exists"] == true
      assert body["execution"]["status"] == "completed"
      assert body["execution"]["mode"] == "implement"
      assert body["execution"]["result_path"] == "/tmp/proposal-results/#{proposal.id}.md"
      assert body["execution"]["completed_at"] == "2026-04-05T13:00:00Z"
      assert body["outcome_signal"] == "success"
      assert String.starts_with?(body["result_summary_excerpt"], "# Result")
      assert body["effectiveness"] == "effective"
    end

    test "returns not found for unknown proposal", %{conn: conn} do
      conn = get(conn, ~p"/api/proposals/prop_missing/outcome")
      assert json_response(conn, 404) == %{"error" => "not_found"}
    end
  end
end
