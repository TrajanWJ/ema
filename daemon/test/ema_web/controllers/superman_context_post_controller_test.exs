defmodule EmaWeb.SupermanContextPostControllerTest do
  use EmaWeb.ConnCase, async: false

  alias Ema.Superman.KnowledgeGraph

  import Ema.Factory

  setup do
    start_supervised!(KnowledgeGraph)
    :ok
  end

  test "POST /api/superman/context returns the structured bundle with provider status", %{conn: conn} do
    project = insert!(:project, %{name: "Daily Planet", slug: "daily-planet"})
    KnowledgeGraph.clear(project.id)
    KnowledgeGraph.clear(project.slug)

    conn = post(conn, "/api/superman/context", %{project_id: project.id})
    body = json_response(conn, 200)

    assert body["project_id"] == project.id
    assert body["project_slug"] == project.slug
    assert body["format"] == "structured"
    assert body["source"] in ["assembler", "graph", "fallback_file", "fallback_db"]
    assert is_map(body["provider_status"])
    assert Map.has_key?(body["provider_status"], "status")
    assert Map.has_key?(body["provider_status"], "checked_at")
  end
end
