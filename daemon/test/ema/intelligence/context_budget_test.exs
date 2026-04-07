defmodule Ema.Intelligence.ContextBudgetTest do
  use ExUnit.Case, async: true

  alias Ema.Intelligence.ContextBudget

  describe "allocate/1" do
    test "allocates default budget across all sections" do
      result = ContextBudget.allocate()

      assert is_map(result)
      assert Map.has_key?(result, :system_prompt)
      assert Map.has_key?(result, :tasks)
      assert Map.has_key?(result, :proposals)

      # Total should approximately equal default budget (8000)
      total = result |> Map.values() |> Enum.sum()
      assert_in_delta total, 8_000, 10
    end

    test "filters to requested sections and redistributes weight" do
      result = ContextBudget.allocate(budget: 1_000, sections: [:tasks, :proposals])

      assert Map.keys(result) |> Enum.sort() == [:proposals, :tasks]
      total = result |> Map.values() |> Enum.sum()
      assert_in_delta total, 1_000, 10

      # Tasks has higher weight than proposals, so should get more
      assert result.tasks > result.proposals
    end

    test "respects overrides and distributes remainder" do
      result =
        ContextBudget.allocate(
          budget: 2_000,
          sections: [:project, :tasks, :proposals],
          overrides: %{project: 800}
        )

      assert result.project == 800
      remaining = result.tasks + result.proposals
      assert_in_delta remaining, 1_200, 10
    end

    test "handles empty sections list" do
      result = ContextBudget.allocate(sections: [])
      assert result == %{}
    end
  end

  describe "estimate_tokens/1" do
    test "estimates tokens from string" do
      text = String.duplicate("a", 400)
      assert ContextBudget.estimate_tokens(text) == 100
    end

    test "estimates tokens from map" do
      assert ContextBudget.estimate_tokens(%{title: "hello"}) > 0
    end

    test "returns 0 for nil" do
      assert ContextBudget.estimate_tokens(nil) == 0
    end
  end

  describe "recency_score/1" do
    test "recent items score close to 1.0" do
      item = %{updated_at: DateTime.utc_now()}
      score = ContextBudget.recency_score(item)
      assert score > 0.95
    end

    test "30-day-old items score around 0.5" do
      thirty_days_ago = DateTime.add(DateTime.utc_now(), -30 * 86_400, :second)
      item = %{updated_at: thirty_days_ago}
      score = ContextBudget.recency_score(item)
      assert_in_delta score, 0.5, 0.05
    end

    test "falls back to inserted_at" do
      item = %{inserted_at: DateTime.utc_now()}
      score = ContextBudget.recency_score(item)
      assert score > 0.95
    end

    test "returns low score for missing timestamps" do
      assert ContextBudget.recency_score(%{}) == 0.1
    end
  end

  describe "term_match_score/2" do
    test "returns 1.0 when all terms match" do
      item = %{title: "Build context budget system", description: "Token allocation"}
      score = ContextBudget.term_match_score(item, ["context", "budget"])
      assert score == 1.0
    end

    test "returns 0.5 when half the terms match" do
      item = %{title: "Build context system"}
      score = ContextBudget.term_match_score(item, ["context", "unrelated"])
      assert_in_delta score, 0.5, 0.01
    end

    test "returns 0.5 for empty terms (neutral)" do
      item = %{title: "anything"}
      assert ContextBudget.term_match_score(item, []) == 0.5
    end
  end

  describe "score_item/2" do
    test "combines recency and term match" do
      item = %{
        title: "Fix budget allocation",
        updated_at: DateTime.utc_now()
      }

      score = ContextBudget.score_item(item, %{terms: ["budget"]})
      # Recent + good term match -> high score
      assert score > 0.7
    end
  end

  describe "select/2" do
    test "selects highest-relevance items within budget" do
      items = [
        %{title: "short", content: "a", relevance: 0.9},
        %{title: "medium", content: String.duplicate("b", 4000), relevance: 0.5},
        %{title: "also short", content: "c", relevance: 0.8}
      ]

      selected = ContextBudget.select(items, 100)

      # Should pick the two short items (high relevance, small tokens)
      titles = Enum.map(selected, & &1.title)
      assert "short" in titles
      assert "also short" in titles
    end

    test "returns empty list for zero budget" do
      items = [%{title: "x", content: "data", relevance: 1.0}]
      assert ContextBudget.select(items, 0) == []
    end
  end

  describe "score_and_select/2" do
    test "scores items and selects within budget" do
      items = [
        %{title: "Recent task", content: "short", updated_at: DateTime.utc_now()},
        %{
          title: "Old task",
          content: "also short",
          updated_at: DateTime.add(DateTime.utc_now(), -365 * 86_400, :second)
        }
      ]

      {selected, tokens_used} =
        ContextBudget.score_and_select(items, budget: 500, focus: %{terms: ["recent"]})

      assert length(selected) > 0
      assert tokens_used > 0
      # The recent item should be selected first due to higher relevance
      first = List.first(selected)
      assert first.title == "Recent task"
    end
  end

  describe "truncate_text/2" do
    test "returns text unchanged when within budget" do
      text = "short text"
      assert ContextBudget.truncate_text(text, 100) == text
    end

    test "truncates text exceeding budget" do
      text = String.duplicate("a", 1000)
      truncated = ContextBudget.truncate_text(text, 10)
      assert String.length(truncated) == 40
    end
  end
end
