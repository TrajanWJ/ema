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
               "generated_at" => _
             } = json_response(conn, 200)

      assert proj["slug"] == project.slug
    end

    test "returns 404 for unknown slug", %{conn: conn} do
      conn = get(conn, "/api/projects/nonexistent-slug/context")
      assert conn.status == 404
    end

    test "includes brain_dump field", %{conn: conn, project: project} do
      conn = get(conn, "/api/projects/#{project.slug}/context")
      body = json_response(conn, 200)
      assert Map.has_key?(body, "brain_dump")
    end

    test "includes vault field", %{conn: conn, project: project} do
      conn = get(conn, "/api/projects/#{project.slug}/context")
      body = json_response(conn, 200)
      assert Map.has_key?(body, "vault")
    end
  end
end
