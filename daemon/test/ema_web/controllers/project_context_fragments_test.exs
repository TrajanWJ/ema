defmodule EmaWeb.ProjectContextFragmentsTest do
  use EmaWeb.ConnCase, async: false

  alias Ema.Intelligence.ContextStore

  setup do
    {:ok, project} =
      Ema.Projects.create_project(%{
        slug: "project-context-fragments",
        name: "Project Context Fragments"
      })

    {:ok, _fragment} =
      ContextStore.create_fragment(%{
        project_slug: project.slug,
        fragment_type: "code",
        content: "def context_fragments(conn, params)",
        file_path: "lib/ema_web/controllers/project_controller.ex",
        relevance_score: 0.88
      })

    {:ok, project: project}
  end

  test "GET /api/projects/:slug/context-fragments returns stored fragments", %{
    conn: conn,
    project: project
  } do
    conn = get(conn, "/api/projects/#{project.slug}/context-fragments")
    slug = project.slug

    assert %{"project_slug" => ^slug, "fragments" => [fragment]} = json_response(conn, 200)
    assert fragment["file_path"] == "lib/ema_web/controllers/project_controller.ex"
    assert fragment["fragment_type"] == "code"
  end

  test "GET /api/projects/:slug/context-fragments returns 404 for unknown project", %{conn: conn} do
    conn = get(conn, "/api/projects/unknown-project/context-fragments")
    assert conn.status == 404
  end
end
