defmodule EmaWeb.ProjectContextTest do
  use EmaWeb.ConnCase, async: false

  setup do
    {:ok, project} =
      Ema.Projects.create_project(%{
        slug: "test-context-proj",
        name: "Test Context Project",
        status: "active"
      })

    {:ok, project: project}
  end

  describe "GET /api/projects/:slug/context" do
    test "returns context for existing project", %{conn: conn, project: project} do
      conn = get(conn, "/api/projects/#{project.slug}/context")

      assert %{
               "project" => proj,
               "executions" => _,
               "proposals" => _,
               "tasks" => _,
               "stats" => stats
             } = json_response(conn, 200)

      assert proj["slug"] == project.slug
      assert is_integer(stats["total_executions"])
      assert is_integer(stats["active_tasks"])
    end

    test "returns 404 for unknown slug", %{conn: conn} do
      conn = get(conn, "/api/projects/nonexistent-slug/context")
      assert conn.status == 404
    end

    test "includes active_campaign field", %{conn: conn, project: project} do
      conn = get(conn, "/api/projects/#{project.slug}/context")
      body = json_response(conn, 200)
      assert Map.has_key?(body, "active_campaign")
    end

    test "active_campaign is nil when no running executions", %{conn: conn, project: project} do
      conn = get(conn, "/api/projects/#{project.slug}/context")
      body = json_response(conn, 200)
      assert body["active_campaign"] == nil
    end

    test "includes intent_threads field", %{conn: conn, project: project} do
      conn = get(conn, "/api/projects/#{project.slug}/context")
      body = json_response(conn, 200)
      assert is_list(body["intent_threads"])
    end
  end
end
