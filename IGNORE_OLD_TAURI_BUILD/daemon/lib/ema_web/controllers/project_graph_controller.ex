defmodule EmaWeb.ProjectGraphController do
  use EmaWeb, :controller

  alias Ema.Intelligence.ProjectGraph

  action_fallback EmaWeb.FallbackController

  @doc """
  GET /api/project-graph
  GET /api/project-graph?project_id=xxx — project-focused graph
  """
  def index(conn, %{"project_id" => project_id}) do
    graph = ProjectGraph.build_for_project(project_id)
    json(conn, graph)
  end

  def index(conn, _params) do
    graph = ProjectGraph.build()
    json(conn, graph)
  end

  @doc """
  GET /api/project-graph/nodes/:id — detailed node info
  """
  def show(conn, %{"id" => id}) do
    case ProjectGraph.get_node_detail(id) do
      nil -> {:error, :not_found}
      node -> json(conn, %{node: node})
    end
  end
end
