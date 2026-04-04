defmodule Ema.Prompts.StoreTest do
  use Ema.DataCase, async: false

  alias Ema.Prompts.Store, as: Prompts
  alias Ema.Prompts.Prompt

  defp unique_kind, do: "kind_#{System.unique_integer([:positive])}"

  # ---------------------------------------------------------------------------
  # create_prompt/1
  # ---------------------------------------------------------------------------

  describe "create_prompt/1" do
    test "creates a prompt with required fields" do
      kind = unique_kind()
      {:ok, p} = Prompts.create_prompt(%{kind: kind, content: "You are helpful."})
      assert p.kind == kind
      assert p.content == "You are helpful."
      assert p.version == 1
      assert String.starts_with?(p.id, "prompt_")
    end

    test "fails without kind" do
      {:error, cs} = Prompts.create_prompt(%{content: "x"})
      assert %{kind: ["can't be blank"]} = errors_on(cs)
    end

    test "fails without content" do
      {:error, cs} = Prompts.create_prompt(%{kind: unique_kind()})
      assert %{content: ["can't be blank"]} = errors_on(cs)
    end

    test "stores a_b_test_group" do
      {:ok, p} = Prompts.create_prompt(%{
        kind:           unique_kind(),
        content:        "Control prompt.",
        a_b_test_group: "control"
      })
      assert p.a_b_test_group == "control"
    end

    test "stores metrics map" do
      {:ok, p} = Prompts.create_prompt(%{
        kind:    unique_kind(),
        content: "Prompt.",
        metrics: %{"usage_count" => 0, "success_rate" => 0.0}
      })
      assert p.metrics["usage_count"] == 0
    end
  end

  # ---------------------------------------------------------------------------
  # Versioning
  # ---------------------------------------------------------------------------

  describe "create_new_version/3" do
    test "creates version 1 when no prior prompt exists for kind" do
      kind = unique_kind()
      {:ok, p} = Prompts.create_new_version(kind, "First prompt.")
      assert p.version == 1
    end

    test "increments version from the current latest" do
      kind = unique_kind()
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "v1", version: 1})
      {:ok, p2} = Prompts.create_new_version(kind, "v2 content")
      assert p2.version == 2

      {:ok, p3} = Prompts.create_new_version(kind, "v3 content")
      assert p3.version == 3
    end

    test "supports a_b_test_group option" do
      kind = unique_kind()
      {:ok, p} = Prompts.create_new_version(kind, "Variant A.", a_b_test_group: "variant_a")
      assert p.a_b_test_group == "variant_a"
    end
  end

  describe "latest_for_kind/1" do
    test "returns the highest-version prompt for a kind" do
      kind = unique_kind()
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "v1", version: 1})
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "v2", version: 2})
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "v3", version: 3})

      latest = Prompts.latest_for_kind(kind)
      assert latest.version == 3
      assert latest.content == "v3"
    end

    test "returns nil for unknown kind" do
      assert Prompts.latest_for_kind("nonexistent_kind_xyz") == nil
    end
  end

  describe "list_latest_per_kind/0" do
    test "returns one entry per kind, the latest version each" do
      k1 = unique_kind()
      k2 = unique_kind()
      {:ok, _} = Prompts.create_prompt(%{kind: k1, content: "k1v1", version: 1})
      {:ok, _} = Prompts.create_prompt(%{kind: k1, content: "k1v2", version: 2})
      {:ok, _} = Prompts.create_prompt(%{kind: k2, content: "k2v1", version: 1})

      latest = Prompts.list_latest_per_kind()

      k1_entry = Enum.find(latest, & &1.kind == k1)
      k2_entry = Enum.find(latest, & &1.kind == k2)

      assert k1_entry.version == 2
      assert k2_entry.version == 1
    end
  end

  describe "get_by_kind_and_version/2" do
    test "returns the prompt at the exact version" do
      kind = unique_kind()
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "v1", version: 1})
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "v2", version: 2})

      p = Prompts.get_by_kind_and_version(kind, 1)
      assert p.content == "v1"
    end

    test "returns nil for a missing version" do
      assert Prompts.get_by_kind_and_version(unique_kind(), 99) == nil
    end
  end

  # ---------------------------------------------------------------------------
  # Metrics
  # ---------------------------------------------------------------------------

  describe "record_metric/3" do
    test "sets a metric key on the prompt" do
      {:ok, p} = Prompts.create_prompt(%{kind: unique_kind(), content: "Prompt."})
      {:ok, updated} = Prompts.record_metric(p, :usage_count, 42)
      assert updated.metrics["usage_count"] == 42
    end

    test "merges metrics without clobbering existing keys" do
      {:ok, p} = Prompts.create_prompt(%{
        kind:    unique_kind(),
        content: "Prompt.",
        metrics: %{"success_rate" => 0.9}
      })
      {:ok, updated} = Prompts.record_metric(p, :usage_count, 5)
      assert updated.metrics["success_rate"] == 0.9
      assert updated.metrics["usage_count"] == 5
    end
  end

  # ---------------------------------------------------------------------------
  # A/B test helpers
  # ---------------------------------------------------------------------------

  describe "A/B test helpers" do
    test "list_by_ab_group/1 returns prompts in a group" do
      kind = unique_kind()
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "control", a_b_test_group: "control"})
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "variant", a_b_test_group: "variant_a"})

      controls = Prompts.list_by_ab_group("control")
      assert Enum.any?(controls, & &1.content == "control")
      refute Enum.any?(controls, & &1.content == "variant")
    end

    test "pick_ab_variant/1 returns one of the variants" do
      kind = unique_kind()
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "c", a_b_test_group: "control"})
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "v", a_b_test_group: "variant_a"})

      picked = Prompts.pick_ab_variant(kind)
      assert picked.kind == kind
    end

    test "pick_ab_variant/1 falls back to latest when no A/B groups exist" do
      kind = unique_kind()
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "solo"})

      picked = Prompts.pick_ab_variant(kind)
      assert picked.content == "solo"
    end
  end

  # ---------------------------------------------------------------------------
  # CRUD
  # ---------------------------------------------------------------------------

  describe "list_prompts_by_kind/1" do
    test "returns all versions for a kind, newest first" do
      kind = unique_kind()
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "v1", version: 1})
      {:ok, _} = Prompts.create_prompt(%{kind: kind, content: "v2", version: 2})

      results = Prompts.list_prompts_by_kind(kind)
      assert length(results) == 2
      assert hd(results).version == 2
    end
  end

  describe "update_prompt/2" do
    test "updates content" do
      {:ok, p} = Prompts.create_prompt(%{kind: unique_kind(), content: "old"})
      {:ok, updated} = Prompts.update_prompt(p, %{content: "new"})
      assert updated.content == "new"
    end
  end

  describe "delete_prompt/1" do
    test "removes the prompt from DB" do
      {:ok, p} = Prompts.create_prompt(%{kind: unique_kind(), content: "bye"})
      {:ok, _} = Prompts.delete_prompt(p)
      assert Prompts.get_prompt(p.id) == nil
    end
  end
end
