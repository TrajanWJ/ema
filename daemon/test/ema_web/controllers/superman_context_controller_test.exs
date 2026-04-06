defmodule EmaWeb.SupermanContextControllerTest do
  use EmaWeb.ConnCase, async: false

  alias Ema.Superman.KnowledgeGraph

  setup do
    start_supervised!(KnowledgeGraph)
    KnowledgeGraph.clear("daily-planet")
    :ok
  end

  test "returns project intelligence for a slug", %{conn: conn} do
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
        "daily-planet"
      )

    conn = get(conn, "/api/superman/context/daily-planet")

    assert %{"project_slug" => "daily-planet", "nodes" => [node]} = json_response(conn, 200)
    assert node["type"] == "goal"
    assert node["title"] == "Primary Goal"
  end
end
