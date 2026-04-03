defmodule Ema.Intelligence.IntentMap do
  @moduledoc """
  Intent Map — hierarchical intent tracking with 5 levels:
  Product → Flow → Action → System → Implementation
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Intelligence.IntentNode
  alias Ema.Intelligence.IntentEdge

  # ── Nodes ──

  def list_nodes(opts \\ []) do
    query = IntentNode |> order_by(asc: :level, asc: :title)

    query =
      case Keyword.get(opts, :project_id) do
        nil -> query
        pid -> where(query, [n], n.project_id == ^pid)
      end

    query =
      case Keyword.get(opts, :level) do
        nil -> query
        lvl -> where(query, [n], n.level == ^lvl)
      end

    query =
      case Keyword.get(opts, :parent_id) do
        nil -> query
        pid -> where(query, [n], n.parent_id == ^pid)
      end

    Repo.all(query)
  end

  def get_node(id), do: Repo.get(IntentNode, id)

  def create_node(attrs) do
    id = generate_id("int")

    %IntentNode{}
    |> IntentNode.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_node(id, attrs) do
    case get_node(id) do
      nil -> {:error, :not_found}
      node -> node |> IntentNode.changeset(attrs) |> Repo.update()
    end
  end

  def delete_node(id) do
    case get_node(id) do
      nil -> {:error, :not_found}
      node -> Repo.delete(node)
    end
  end

  # ── Tree ──

  def tree(project_id) do
    nodes = list_nodes(project_id: project_id)
    build_tree(nodes, nil)
  end

  defp build_tree(nodes, parent_id) do
    nodes
    |> Enum.filter(fn n -> n.parent_id == parent_id end)
    |> Enum.map(fn node ->
      children = build_tree(nodes, node.id)
      Map.put(serialize(node), :children, children)
    end)
  end

  # ── Edges ──

  def create_edge(attrs) do
    id = generate_id("ie")

    %IntentEdge{}
    |> IntentEdge.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def list_edges(opts \\ []) do
    query = IntentEdge

    query =
      case Keyword.get(opts, :source_id) do
        nil -> query
        sid -> where(query, [e], e.source_id == ^sid)
      end

    Repo.all(query)
  end

  # ── Export ──

  def export_markdown(project_id) do
    nodes = tree(project_id)
    render_markdown(nodes, 0)
  end

  defp render_markdown(nodes, depth) do
    Enum.map_join(nodes, "\n", fn node ->
      prefix = String.duplicate("  ", depth)
      status_icon = case node.status do
        "complete" -> "[x]"
        "partial" -> "[-]"
        _ -> "[ ]"
      end
      line = "#{prefix}- #{status_icon} **#{node.title}**"
      desc = if node.description, do: "\n#{prefix}  #{node.description}", else: ""
      children = if node.children != [], do: "\n" <> render_markdown(node.children, depth + 1), else: ""
      line <> desc <> children
    end)
  end

  # ── Serialization ──

  def serialize(node) do
    %{
      id: node.id,
      title: node.title,
      description: node.description,
      level: node.level,
      level_name: IntentNode.level_name(node.level),
      parent_id: node.parent_id,
      status: node.status,
      project_id: node.project_id,
      linked_task_ids: Jason.decode!(node.linked_task_ids || "[]"),
      linked_wiki_path: node.linked_wiki_path,
      created_at: node.inserted_at
    }
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
