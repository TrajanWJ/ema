defmodule EmaWeb.IntentController do
  use EmaWeb, :controller

  alias Ema.Intelligence.IntentMap

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:project_id, params["project_id"])
      |> maybe_add(:level, parse_int(params["level"]))

    nodes = IntentMap.list_nodes(opts) |> Enum.map(&IntentMap.serialize/1)
    json(conn, %{nodes: nodes})
  end

  def tree(conn, %{"project_id" => project_id}) do
    tree = IntentMap.tree(project_id)
    json(conn, %{tree: tree})
  end

  def show(conn, %{"id" => id}) do
    case IntentMap.get_node(id) do
      nil -> {:error, :not_found}
      node -> json(conn, IntentMap.serialize(node))
    end
  end

  def create(conn, params) do
    attrs = %{
      title: params["title"],
      description: params["description"],
      level: params["level"] || 0,
      parent_id: params["parent_id"],
      project_id: params["project_id"],
      status: params["status"] || "planned",
      linked_task_ids: Jason.encode!(params["linked_task_ids"] || []),
      linked_wiki_path: params["linked_wiki_path"]
    }

    with {:ok, node} <- IntentMap.create_node(attrs) do
      EmaWeb.Endpoint.broadcast("intent:live", "node_created", IntentMap.serialize(node))

      conn
      |> put_status(:created)
      |> json(IntentMap.serialize(node))
    end
  end

  def update(conn, %{"id" => id} = params) do
    attrs =
      params
      |> Map.take(~w(title description level parent_id status project_id linked_wiki_path))
      |> Map.new(fn {k, v} -> {String.to_existing_atom(k), v} end)

    attrs =
      case params["linked_task_ids"] do
        nil -> attrs
        ids -> Map.put(attrs, :linked_task_ids, Jason.encode!(ids))
      end

    with {:ok, node} <- IntentMap.update_node(id, attrs) do
      EmaWeb.Endpoint.broadcast("intent:live", "node_updated", IntentMap.serialize(node))
      json(conn, IntentMap.serialize(node))
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, _} <- IntentMap.delete_node(id) do
      EmaWeb.Endpoint.broadcast("intent:live", "node_deleted", %{id: id})
      json(conn, %{ok: true})
    end
  end

  def export(conn, %{"project_id" => project_id}) do
    markdown = IntentMap.export_markdown(project_id)
    json(conn, %{markdown: markdown})
  end

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)

  defp parse_int(nil), do: nil
  defp parse_int(val) when is_integer(val), do: val
  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> nil
    end
  end
end
