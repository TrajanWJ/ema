defmodule Ema.Superman.KnowledgeGraphTest do
  use ExUnit.Case, async: false

  alias Ema.Superman.KnowledgeGraph

  setup do
    start_supervised!(KnowledgeGraph)
    KnowledgeGraph.clear("daily-planet")
    :ok
  end

  test "ingests, ranks, and clears nodes by project" do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    nodes = [
      %{
        type: "approach",
        title: "Approach",
        content: "Use LiveView",
        tags: ["ui"],
        inserted_at: now
      },
      %{
        type: "goal",
        title: "Goal",
        content: "Ship reporting",
        tags: ["priority"],
        inserted_at: now
      },
      %{
        type: "prior_outcomes",
        title: "Outcome",
        content: "Alerts reduced downtime",
        tags: [],
        inserted_at: now
      }
    ]

    assert :ok = KnowledgeGraph.ingest(nodes, "daily-planet")

    context = KnowledgeGraph.context_for("daily-planet")
    assert Enum.map(context, & &1.title) == ["Goal", "Approach", "Outcome"]

    assert :ok = KnowledgeGraph.clear("daily-planet")
    assert KnowledgeGraph.context_for("daily-planet") == []
  end

  test "caps returned context at ten nodes" do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    nodes =
      Enum.map(1..12, fn index ->
        %{
          type: "goal",
          title: "Goal #{index}",
          content: "Content #{index}",
          tags: [],
          inserted_at: now
        }
      end)

    assert :ok = KnowledgeGraph.ingest(nodes, "daily-planet")
    assert length(KnowledgeGraph.context_for("daily-planet")) == 10
  end
end
