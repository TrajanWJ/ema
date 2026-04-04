defmodule Ema.Superman.IntentParserTest do
  use ExUnit.Case, async: true

  alias Ema.Superman.IntentParser

  test "parses frontmatter and section nodes" do
    content = """
    ---
    title: Metropolis API
    tags: [backend, phoenix]
    ---
    # Goal
    Ship the public API this week.

    ## Approach
    Build the auth layer first, then the resource endpoints.

    ## Constraints
    - No schema changes
    - Keep existing clients working

    ## Prior Outcomes
    - Background job retries reduced incident volume
    """

    nodes = IntentParser.parse(content, source: "/tmp/projects/metropolis/.superman")

    assert Enum.any?(nodes, &(&1.type == "goal" and &1.title == "Metropolis API Goal"))
    assert Enum.any?(nodes, &(&1.type == "approach" and String.contains?(&1.content, "auth layer")))

    constraint_titles =
      nodes
      |> Enum.filter(&(&1.type == "constraints"))
      |> Enum.map(& &1.title)

    assert "Metropolis API Constraint 1" in constraint_titles
    assert "Metropolis API Constraint 2" in constraint_titles

    assert Enum.all?(nodes, fn node ->
             "backend" in node.tags and "phoenix" in node.tags and match?(%DateTime{}, node.inserted_at)
           end)
  end
end
