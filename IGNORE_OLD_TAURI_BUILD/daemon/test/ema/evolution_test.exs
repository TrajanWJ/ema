defmodule Ema.EvolutionTest do
  use Ema.DataCase, async: false
  alias Ema.Evolution

  # --- Helpers ---

  defp create_rule(attrs \\ %{}) do
    defaults = %{
      source: "manual",
      content: "Always prefer smaller PRs"
    }

    {:ok, rule} = Evolution.create_rule(Map.merge(defaults, attrs))
    rule
  end

  # --- CRUD ---

  describe "create_rule/1" do
    test "creates a rule with valid attrs" do
      assert {:ok, rule} = Evolution.create_rule(%{source: "manual", content: "Test rule"})
      assert rule.content == "Test rule"
      assert rule.source == "manual"
      assert rule.status == "proposed"
      assert rule.version == 1
      assert String.starts_with?(rule.id, "rule_")
    end

    test "fails without required fields" do
      assert {:error, changeset} = Evolution.create_rule(%{})
      errors = errors_on(changeset)
      assert errors[:source]
      assert errors[:content]
    end

    test "validates source" do
      assert {:error, changeset} =
               Evolution.create_rule(%{source: "bogus", content: "test"})

      assert %{source: [_]} = errors_on(changeset)
    end

    test "validates status" do
      assert {:error, changeset} =
               Evolution.create_rule(%{source: "manual", content: "test", status: "invalid"})

      assert %{status: [_]} = errors_on(changeset)
    end
  end

  describe "list_rules/1" do
    test "returns all rules" do
      create_rule(%{content: "Rule A"})
      create_rule(%{content: "Rule B"})
      assert length(Evolution.list_rules()) == 2
    end

    test "filters by status" do
      create_rule(%{content: "Proposed"})
      rule = create_rule(%{content: "Activated"})
      Evolution.activate_rule(rule.id)

      assert [r] = Evolution.list_rules(status: "active")
      assert r.content == "Activated"
    end

    test "filters by source" do
      create_rule(%{source: "manual", content: "Manual"})
      create_rule(%{source: "signal", content: "Signal"})

      assert [r] = Evolution.list_rules(source: "signal")
      assert r.content == "Signal"
    end

    test "respects limit" do
      for i <- 1..5, do: create_rule(%{content: "Rule #{i}"})
      assert length(Evolution.list_rules(limit: 3)) == 3
    end
  end

  describe "get_rule/1" do
    test "returns rule by id" do
      rule = create_rule()
      assert fetched = Evolution.get_rule(rule.id)
      assert fetched.id == rule.id
    end

    test "returns nil for unknown id" do
      assert Evolution.get_rule("nonexistent") == nil
    end
  end

  # --- Actions ---

  describe "activate_rule/1" do
    test "sets status to active" do
      rule = create_rule()
      assert {:ok, activated} = Evolution.activate_rule(rule.id)
      assert activated.status == "active"
    end

    test "returns error for nonexistent id" do
      assert {:error, :not_found} = Evolution.activate_rule("nope")
    end
  end

  describe "rollback_rule/1" do
    test "sets status to rolled_back" do
      rule = create_rule()
      {:ok, _} = Evolution.activate_rule(rule.id)
      assert {:ok, rolled_back} = Evolution.rollback_rule(rule.id)
      assert rolled_back.status == "rolled_back"
    end

    test "returns error for nonexistent id" do
      assert {:error, :not_found} = Evolution.rollback_rule("nope")
    end

    test "reactivates previous rule on rollback" do
      v1 = create_rule(%{content: "Version 1"})
      {:ok, _} = Evolution.activate_rule(v1.id)

      v2 = create_rule(%{content: "Version 2", previous_rule_id: v1.id})
      {:ok, _} = Evolution.activate_rule(v2.id)

      # Rollback v2 should reactivate v1
      assert {:ok, _} = Evolution.rollback_rule(v2.id)

      reactivated = Evolution.get_rule(v1.id)
      assert reactivated.status == "active"
    end
  end

  # --- Stats ---

  describe "stats/0" do
    test "returns aggregate counts" do
      create_rule(%{content: "A"})
      rule_b = create_rule(%{content: "B"})
      Evolution.activate_rule(rule_b.id)

      stats = Evolution.stats()
      assert stats.total_rules == 2
      assert stats.active_rules == 1
      assert stats.proposed_rules == 1
      assert stats.rolled_back_rules == 0
      assert stats.sources["manual"] == 2
    end
  end

  # --- Version History ---

  describe "get_version_history/1" do
    test "returns chain of rule versions" do
      v1 = create_rule(%{content: "Version 1"})
      v2 = create_rule(%{content: "Version 2", previous_rule_id: v1.id, version: 2})

      assert {:ok, chain} = Evolution.get_version_history(v2.id)
      assert length(chain) == 2
      ids = Enum.map(chain, & &1.id)
      assert v1.id in ids
      assert v2.id in ids
    end

    test "returns single-element chain for root rule" do
      rule = create_rule()
      assert {:ok, chain} = Evolution.get_version_history(rule.id)
      assert length(chain) == 1
    end

    test "returns error for nonexistent id" do
      assert {:error, :not_found} = Evolution.get_version_history("nope")
    end
  end

  describe "get_active_rules/0" do
    test "returns only active rules" do
      create_rule(%{content: "Proposed"})
      active = create_rule(%{content: "Active"})
      Evolution.activate_rule(active.id)

      rules = Evolution.get_active_rules()
      assert length(rules) == 1
      assert hd(rules).content == "Active"
    end
  end
end
