defmodule Ema.MetaMind.PromptLibraryTest do
  use Ema.DataCase, async: false
  alias Ema.MetaMind.PromptLibrary

  # --- Helpers ---

  defp create_prompt(attrs \\ %{}) do
    defaults = %{
      name: "Test Prompt",
      body: "You are a helpful assistant that...",
      category: "system"
    }

    {:ok, prompt} = PromptLibrary.save_prompt(Map.merge(defaults, attrs))
    prompt
  end

  # --- CRUD ---

  describe "save_prompt/1" do
    test "creates a prompt with valid attrs" do
      assert {:ok, prompt} =
               PromptLibrary.save_prompt(%{
                 name: "Review Prompt",
                 body: "Review the following code...",
                 category: "review"
               })

      assert prompt.name == "Review Prompt"
      assert prompt.category == "review"
      assert prompt.version == 1
      assert prompt.effectiveness_score == 0.0
      assert prompt.usage_count == 0
    end

    test "auto-generates id if not provided" do
      assert {:ok, prompt} =
               PromptLibrary.save_prompt(%{
                 name: "Auto ID",
                 body: "body",
                 category: "system"
               })

      assert prompt.id != nil
    end

    test "fails without required fields" do
      assert {:error, changeset} = PromptLibrary.save_prompt(%{})
      errors = errors_on(changeset)
      assert errors[:name]
      assert errors[:body]
      assert errors[:category]
    end

    test "validates category" do
      assert {:error, changeset} =
               PromptLibrary.save_prompt(%{
                 name: "Bad",
                 body: "body",
                 category: "invalid"
               })

      assert %{category: [_]} = errors_on(changeset)
    end

    test "validates effectiveness_score range" do
      assert {:error, changeset} =
               PromptLibrary.save_prompt(%{
                 name: "Bad",
                 body: "body",
                 category: "system",
                 effectiveness_score: 1.5
               })

      assert %{effectiveness_score: [_]} = errors_on(changeset)
    end

    test "upserts on id conflict" do
      {:ok, original} =
        PromptLibrary.save_prompt(%{
          id: "test-upsert",
          name: "Original",
          body: "original body",
          category: "system"
        })

      {:ok, updated} =
        PromptLibrary.save_prompt(%{
          id: "test-upsert",
          name: "Updated",
          body: "updated body",
          category: "system"
        })

      assert updated.id == original.id
      assert updated.name == "Updated"
      assert length(PromptLibrary.list_prompts()) == 1
    end
  end

  describe "list_prompts/0" do
    test "returns all prompts ordered by updated_at desc" do
      create_prompt(%{name: "A"})
      create_prompt(%{name: "B"})
      prompts = PromptLibrary.list_prompts()
      assert length(prompts) == 2
    end
  end

  describe "get_prompt/1" do
    test "returns prompt by id" do
      prompt = create_prompt()
      assert fetched = PromptLibrary.get_prompt(prompt.id)
      assert fetched.id == prompt.id
    end

    test "returns nil for unknown id" do
      assert PromptLibrary.get_prompt("nonexistent") == nil
    end
  end

  # --- Search ---

  describe "search_prompts/1" do
    test "searches by name" do
      create_prompt(%{name: "Code Review Prompt"})
      create_prompt(%{name: "Writing Helper"})

      results = PromptLibrary.search_prompts("Review")
      assert length(results) == 1
      assert hd(results).name == "Code Review Prompt"
    end

    test "searches by body" do
      create_prompt(%{name: "Alpha", body: "Analyze the architecture"})
      create_prompt(%{name: "Beta", body: "Write unit tests"})

      results = PromptLibrary.search_prompts("architecture")
      assert length(results) == 1
      assert hd(results).name == "Alpha"
    end

    test "returns empty for no matches" do
      create_prompt()
      assert PromptLibrary.search_prompts("zzzznonexistent") == []
    end
  end

  describe "get_best_for_category/2" do
    test "returns prompts for category sorted by effectiveness" do
      create_prompt(%{name: "Good", category: "review", effectiveness_score: 0.9})
      create_prompt(%{name: "Bad", category: "review", effectiveness_score: 0.2})
      create_prompt(%{name: "Other", category: "system"})

      results = PromptLibrary.get_best_for_category("review")
      assert length(results) == 2
      assert hd(results).name == "Good"
    end

    test "respects limit" do
      for i <- 1..5 do
        create_prompt(%{name: "Review #{i}", category: "review"})
      end

      assert length(PromptLibrary.get_best_for_category("review", 2)) == 2
    end
  end

  # --- Tracking ---

  describe "track_outcome/2" do
    test "increments usage and success counts on success" do
      prompt = create_prompt()
      assert {:ok, updated} = PromptLibrary.track_outcome(prompt.id, true)
      assert updated.usage_count == 1
      assert updated.success_count == 1
      assert updated.effectiveness_score == 1.0
    end

    test "increments only usage on failure" do
      prompt = create_prompt()
      assert {:ok, updated} = PromptLibrary.track_outcome(prompt.id, false)
      assert updated.usage_count == 1
      assert updated.success_count == 0
      assert updated.effectiveness_score == 0.0
    end

    test "computes running effectiveness score" do
      prompt = create_prompt()
      {:ok, _} = PromptLibrary.track_outcome(prompt.id, true)
      {:ok, _} = PromptLibrary.track_outcome(prompt.id, true)
      {:ok, updated} = PromptLibrary.track_outcome(prompt.id, false)

      # 2 successes out of 3 uses
      assert updated.usage_count == 3
      assert updated.success_count == 2
      assert_in_delta updated.effectiveness_score, 0.667, 0.001
    end

    test "returns error for nonexistent id" do
      assert {:error, :not_found} = PromptLibrary.track_outcome("nope", true)
    end
  end

  # --- Delete ---

  describe "delete_prompt/1" do
    test "deletes a prompt" do
      prompt = create_prompt()
      assert {:ok, _} = PromptLibrary.delete_prompt(prompt.id)
      assert PromptLibrary.get_prompt(prompt.id) == nil
    end

    test "returns error for nonexistent id" do
      assert {:error, :not_found} = PromptLibrary.delete_prompt("nope")
    end
  end

  # --- Versioning ---

  describe "create_version/2" do
    test "creates a new version linked to parent" do
      parent = create_prompt(%{name: "V1 Prompt", body: "Original body"})

      assert {:ok, v2} = PromptLibrary.create_version(parent.id, "Improved body")
      assert v2.body == "Improved body"
      assert v2.version == 2
      assert v2.parent_id == parent.id
      assert v2.name == parent.name
      assert v2.category == parent.category
    end

    test "returns error for nonexistent parent" do
      assert {:error, :not_found} = PromptLibrary.create_version("nope", "body")
    end
  end
end
