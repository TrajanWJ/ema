defmodule Ema.Claude.ExecutionBridgeTest do
  use ExUnit.Case, async: false

  alias Ema.Claude.ExecutionBridge
  alias Ema.Superman.KnowledgeGraph

  setup do
    start_supervised!(KnowledgeGraph)
    KnowledgeGraph.clear("metropolis")
    :ok
  end

  test "prepends project intelligence when context exists" do
    :ok =
      KnowledgeGraph.ingest(
        [
          %{type: "goal", title: "Main Goal", content: "Protect the release window", tags: [], inserted_at: DateTime.utc_now()}
        ],
        "metropolis"
      )

    prompt = ExecutionBridge.prepend_project_intelligence("Implement the endpoint.", "metropolis")

    assert String.starts_with?(prompt, "Project intelligence:")
    assert String.contains?(prompt, "[goal] Main Goal")
    assert String.ends_with?(prompt, "Implement the endpoint.")
  end

  test "leaves prompt unchanged when no context exists" do
    assert ExecutionBridge.prepend_project_intelligence("Implement the endpoint.", "unknown") ==
             "Implement the endpoint."
  end
end
