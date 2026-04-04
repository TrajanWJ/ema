defmodule Ema.Campaigns.FlowTest do
  use Ema.DataCase, async: false

  alias Ema.Campaigns
  alias Ema.Campaigns.Flow

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp unique_campaign_id, do: "camp_#{System.unique_integer([:positive])}"

  defp create_flow!(attrs \\ %{}) do
    {:ok, flow} = Campaigns.create_flow(Map.put_new(attrs, :campaign_id, unique_campaign_id()))
    flow
  end

  # ---------------------------------------------------------------------------
  # Creation
  # ---------------------------------------------------------------------------

  describe "create_flow/1" do
    test "creates a flow in forming state with history entry" do
      {:ok, flow} = Campaigns.create_flow(%{campaign_id: unique_campaign_id()})
      assert flow.state == "forming"
      assert flow.state_entered_at != nil
      assert length(flow.state_history) == 1

      [entry] = flow.state_history
      assert entry["state"] == "forming"
      assert entry["entered_at"] != nil
      assert entry["exited_at"] == nil
    end

    test "requires campaign_id" do
      {:error, changeset} = Campaigns.create_flow(%{})
      assert %{campaign_id: ["can't be blank"]} = errors_on(changeset)
    end

    test "generates unique id with flow_ prefix" do
      {:ok, flow} = Campaigns.create_flow(%{campaign_id: unique_campaign_id()})
      assert String.starts_with?(flow.id, "flow_")
    end

    test "accepts optional title and metadata" do
      {:ok, flow} = Campaigns.create_flow(%{
        campaign_id: unique_campaign_id(),
        title: "My Campaign",
        state_metadata: %{"source" => "proposal"}
      })
      assert flow.title == "My Campaign"
    end

    test "enforces unique campaign_id" do
      id = unique_campaign_id()
      {:ok, _} = Campaigns.create_flow(%{campaign_id: id})
      {:error, changeset} = Campaigns.create_flow(%{campaign_id: id})
      assert %{campaign_id: ["has already been taken"]} = errors_on(changeset)
    end
  end

  # ---------------------------------------------------------------------------
  # Valid transitions
  # ---------------------------------------------------------------------------

  describe "valid transitions" do
    test "forming → developing" do
      flow = create_flow!()
      {:ok, updated} = Campaigns.transition(flow, "developing")
      assert updated.state == "developing"
    end

    test "forming → done (abandoned)" do
      flow = create_flow!()
      {:ok, updated} = Campaigns.transition(flow, "done")
      assert updated.state == "done"
    end

    test "developing → testing" do
      flow = create_flow!()
      {:ok, flow} = Campaigns.transition(flow, "developing")
      {:ok, flow} = Campaigns.transition(flow, "testing")
      assert flow.state == "testing"
    end

    test "developing → forming (rethink)" do
      flow = create_flow!()
      {:ok, flow} = Campaigns.transition(flow, "developing")
      {:ok, flow} = Campaigns.transition(flow, "forming")
      assert flow.state == "forming"
    end

    test "testing → done" do
      flow = create_flow!()
      {:ok, flow} = Campaigns.transition(flow, "developing")
      {:ok, flow} = Campaigns.transition(flow, "testing")
      {:ok, flow} = Campaigns.transition(flow, "done")
      assert flow.state == "done"
    end

    test "testing → developing (iterate)" do
      flow = create_flow!()
      {:ok, flow} = Campaigns.transition(flow, "developing")
      {:ok, flow} = Campaigns.transition(flow, "testing")
      {:ok, flow} = Campaigns.transition(flow, "developing")
      assert flow.state == "developing"
    end
  end

  # ---------------------------------------------------------------------------
  # Invalid transitions
  # ---------------------------------------------------------------------------

  describe "invalid transitions" do
    test "forming → testing is invalid" do
      flow = create_flow!()
      {:error, changeset} = Campaigns.transition(flow, "testing")
      assert %{state: [_msg]} = errors_on(changeset)
    end

    test "developing → done is invalid" do
      flow = create_flow!()
      {:ok, flow} = Campaigns.transition(flow, "developing")
      {:error, changeset} = Campaigns.transition(flow, "done")
      assert %{state: [_msg]} = errors_on(changeset)
    end

    test "testing → forming is invalid" do
      flow = create_flow!()
      {:ok, flow} = Campaigns.transition(flow, "developing")
      {:ok, flow} = Campaigns.transition(flow, "testing")
      {:error, changeset} = Campaigns.transition(flow, "forming")
      assert %{state: [_msg]} = errors_on(changeset)
    end

    test "done → anything is invalid" do
      flow = create_flow!()
      {:ok, flow} = Campaigns.transition(flow, "done")

      for next <- ~w(forming developing testing) do
        {:error, changeset} = Campaigns.transition(flow, next)
        assert %{state: [_]} = errors_on(changeset)
      end
    end

    test "invalid state name is rejected" do
      flow = create_flow!()
      {:error, changeset} = Campaigns.transition(flow, "bogus")
      # May have 1 or 2 errors: transition invalid + is invalid
      assert %{state: errors} = errors_on(changeset)
      assert length(errors) >= 1
    end
  end

  # ---------------------------------------------------------------------------
  # State history
  # ---------------------------------------------------------------------------

  describe "state_history tracking" do
    test "history grows with each transition" do
      flow = create_flow!()
      assert length(flow.state_history) == 1

      {:ok, flow} = Campaigns.transition(flow, "developing")
      assert length(flow.state_history) == 2

      {:ok, flow} = Campaigns.transition(flow, "testing")
      assert length(flow.state_history) == 3

      {:ok, flow} = Campaigns.transition(flow, "done")
      assert length(flow.state_history) == 4
    end

    test "exited_at is set for previous state on transition" do
      flow = create_flow!()
      {:ok, flow} = Campaigns.transition(flow, "developing")

      [forming_entry, developing_entry] = flow.state_history

      assert forming_entry["state"] == "forming"
      assert forming_entry["exited_at"] != nil

      assert developing_entry["state"] == "developing"
      assert developing_entry["exited_at"] == nil
    end

    test "transition metadata is recorded in history" do
      flow = create_flow!()
      meta = %{"reason" => "ready to build", "approved_by" => "trajan"}
      {:ok, flow} = Campaigns.transition(flow, "developing", meta)

      [_forming, developing] = flow.state_history
      assert developing["metadata"] == meta
    end

    test "state_metadata on the flow reflects the latest transition" do
      flow = create_flow!()
      meta = %{"triggered_by" => "api"}
      {:ok, flow} = Campaigns.transition(flow, "developing", meta)
      assert flow.state_metadata == meta
    end

    test "multi-step history records all states in order" do
      flow = create_flow!()
      {:ok, flow} = Campaigns.transition(flow, "developing")
      {:ok, flow} = Campaigns.transition(flow, "testing")
      {:ok, flow} = Campaigns.transition(flow, "developing")
      {:ok, flow} = Campaigns.transition(flow, "testing")
      {:ok, flow} = Campaigns.transition(flow, "done")

      states = Enum.map(flow.state_history, & &1["state"])
      assert states == ~w(forming developing testing developing testing done)
    end

    test "state_durations returns non-negative durations for all entries" do
      flow = create_flow!()
      {:ok, flow} = Campaigns.transition(flow, "developing")
      {:ok, flow} = Campaigns.transition(flow, "testing")
      {:ok, flow} = Campaigns.transition(flow, "done")

      durations = Campaigns.state_durations(flow)
      assert length(durations) == 4
      assert Enum.all?(durations, fn d -> d.duration_s >= 0 end)
    end
  end

  # ---------------------------------------------------------------------------
  # Timestamp tracking
  # ---------------------------------------------------------------------------

  describe "state_entered_at" do
    test "is set on creation" do
      flow = create_flow!()
      assert %DateTime{} = flow.state_entered_at
    end

    test "is updated on each transition" do
      flow = create_flow!()
      original_ts = flow.state_entered_at

      # Small sleep to ensure timestamp differs
      Process.sleep(10)
      {:ok, updated} = Campaigns.transition(flow, "developing")

      # entered_at should be >= original (or equal if very fast, but should not error)
      assert DateTime.compare(updated.state_entered_at, original_ts) in [:gt, :eq]
    end
  end

  # ---------------------------------------------------------------------------
  # Flow helpers
  # ---------------------------------------------------------------------------

  describe "Flow.valid_transition?/2" do
    test "returns true for all valid transitions" do
      assert Flow.valid_transition?("forming", "developing")
      assert Flow.valid_transition?("forming", "done")
      assert Flow.valid_transition?("developing", "testing")
      assert Flow.valid_transition?("developing", "forming")
      assert Flow.valid_transition?("testing", "done")
      assert Flow.valid_transition?("testing", "developing")
    end

    test "returns false for all invalid transitions" do
      assert Flow.valid_transition?("forming", "testing")   == false
      assert Flow.valid_transition?("developing", "done")   == false
      assert Flow.valid_transition?("testing", "forming")   == false
      assert Flow.valid_transition?("done", "forming")      == false
      assert Flow.valid_transition?("done", "developing")   == false
      assert Flow.valid_transition?("done", "testing")      == false
      assert Flow.valid_transition?("done", "done")         == false
    end
  end

  describe "Flow.valid_transitions/1" do
    test "returns correct allowed states for each state" do
      assert Enum.sort(Flow.valid_transitions("forming"))    == Enum.sort(~w(developing done))
      assert Enum.sort(Flow.valid_transitions("developing")) == Enum.sort(~w(testing forming))
      assert Enum.sort(Flow.valid_transitions("testing"))    == Enum.sort(~w(done developing))
      assert Flow.valid_transitions("done") == []
    end
  end

  describe "Flow.states/0" do
    test "returns all 4 states in order" do
      assert Flow.states() == ~w(forming developing testing done)
    end
  end

  # ---------------------------------------------------------------------------
  # transition_by_id
  # ---------------------------------------------------------------------------

  describe "Campaigns.transition_by_id/3" do
    test "transitions an existing flow by id" do
      flow = create_flow!()
      {:ok, updated} = Campaigns.transition_by_id(flow.id, "developing")
      assert updated.state == "developing"
    end

    test "returns {:error, :not_found} for unknown id" do
      assert {:error, :not_found} = Campaigns.transition_by_id("flow_nonexistent", "developing")
    end
  end

  # ---------------------------------------------------------------------------
  # Query helpers
  # ---------------------------------------------------------------------------

  describe "list_flows_by_state/1" do
    test "returns only flows in the given state" do
      f1 = create_flow!()
      f2 = create_flow!()
      {:ok, _} = Campaigns.transition(f2, "developing")

      forming = Campaigns.list_flows_by_state("forming")
      assert Enum.any?(forming, & &1.id == f1.id)
      refute Enum.any?(forming, & &1.id == f2.id)

      developing = Campaigns.list_flows_by_state("developing")
      assert Enum.any?(developing, & &1.id == f2.id)
    end
  end

  describe "get_flow_by_campaign/1" do
    test "returns the flow for a given campaign_id" do
      id = unique_campaign_id()
      {:ok, flow} = Campaigns.create_flow(%{campaign_id: id})
      found = Campaigns.get_flow_by_campaign(id)
      assert found.id == flow.id
    end

    test "returns nil for unknown campaign" do
      assert Campaigns.get_flow_by_campaign("nonexistent") == nil
    end
  end

  # ---------------------------------------------------------------------------
  # Edge cases
  # ---------------------------------------------------------------------------

  describe "edge cases" do
    test "cycling developing → forming → developing preserves full history" do
      flow = create_flow!()
      {:ok, flow} = Campaigns.transition(flow, "developing")
      {:ok, flow} = Campaigns.transition(flow, "forming")
      {:ok, flow} = Campaigns.transition(flow, "developing")

      states = Enum.map(flow.state_history, & &1["state"])
      assert states == ~w(forming developing forming developing)
    end

    test "history entries all have valid entered_at ISO strings" do
      flow = create_flow!()
      {:ok, flow} = Campaigns.transition(flow, "developing")
      {:ok, flow} = Campaigns.transition(flow, "testing")
      {:ok, flow} = Campaigns.transition(flow, "done")

      Enum.each(flow.state_history, fn entry ->
        assert {:ok, _, _} = DateTime.from_iso8601(entry["entered_at"])
      end)
    end

    test "rejected transition does not mutate the flow in DB" do
      flow = create_flow!()
      {:error, _} = Campaigns.transition(flow, "testing")

      refetched = Campaigns.get_flow!(flow.id)
      assert refetched.state == "forming"
      assert length(refetched.state_history) == 1
    end
  end
end
