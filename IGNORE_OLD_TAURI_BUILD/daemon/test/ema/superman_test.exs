defmodule Ema.SupermanTest do
  use Ema.DataCase, async: false

  alias Ema.Superman
  alias Ema.Superman.KnowledgeGraph

  import Ema.Factory

  setup do
    start_supervised!(KnowledgeGraph)
    :ok
  end

  test "context_bundle_for/2 returns a structured graph bundle when graph data exists" do
    project = insert!(:project, %{name: "Daily Planet", slug: "daily-planet"})
    KnowledgeGraph.clear(project.id)
    KnowledgeGraph.clear(project.slug)

    :ok =
      KnowledgeGraph.ingest(
        [
          %{
            type: "goal",
            title: "Primary Goal",
            content: "Ship the newsroom tools",
            tags: ["ops"],
            inserted_at: DateTime.utc_now()
          }
        ],
        project.slug
      )

    assert {:ok, bundle} = Superman.context_bundle_for(project.id)
    assert bundle.project_id == project.id
    assert bundle.project_slug == project.slug
    assert bundle.format == :structured
    assert bundle.source == :graph
    assert length(bundle.graph_nodes) == 1
    assert is_map(bundle.assembled_context)
    assert is_binary(bundle.prompt_text)
    assert bundle.metadata.graph_node_count == 1
    assert bundle.metadata.fallback_source == nil
  end

  test "context_bundle_for/2 returns an assembler bundle when graph data is absent" do
    project = insert!(:project, %{name: "Metropolis Ops", slug: "metropolis-ops"})
    KnowledgeGraph.clear(project.id)
    KnowledgeGraph.clear(project.slug)

    assert {:ok, bundle} = Superman.context_bundle_for(project.id)
    assert bundle.project_id == project.id
    assert bundle.project_slug == project.slug
    assert bundle.format == :structured
    assert bundle.source == :assembler
    assert bundle.graph_nodes == []
    assert is_map(bundle.assembled_context)
    assert is_binary(bundle.prompt_text)
    assert bundle.metadata.graph_node_count == 0
    assert bundle.metadata.fallback_source == nil
  end
end
