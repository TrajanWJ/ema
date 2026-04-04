defmodule Ema.Superman.KnowledgeGraph do
  @moduledoc """
  In-memory project intelligence graph backed by ETS.
  """

  use GenServer

  @table :ema_superman_knowledge_graph

  @type kg_node :: %{
          required(:project_id) => String.t(),
          required(:type) => String.t(),
          required(:title) => String.t(),
          required(:content) => String.t(),
          required(:tags) => [String.t()],
          required(:inserted_at) => DateTime.t()
        }

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def ingest(nodes, project_id) when is_list(nodes) and is_binary(project_id) do
    GenServer.call(__MODULE__, {:ingest, project_id, nodes})
  end

  def context_for(project_id) when is_binary(project_id) do
    if :ets.whereis(@table) == :undefined do
      []
    else
      case :ets.lookup(@table, project_id) do
        [{^project_id, nodes}] ->
          nodes
          |> Map.values()
          |> Enum.sort_by(&node_rank/1, :desc)
          |> Enum.take(10)

        [] ->
          []
      end
    end
  end

  def context_for(_), do: []

  def clear(project_id) when is_binary(project_id) do
    GenServer.call(__MODULE__, {:clear, project_id})
  end

  @impl true
  def init(_opts) do
    table =
      :ets.new(@table, [
        :named_table,
        :set,
        :public,
        read_concurrency: true,
        write_concurrency: true
      ])

    {:ok, %{table: table}}
  end

  @impl true
  def handle_call({:ingest, project_id, nodes}, _from, state) do
    sanitized_nodes =
      nodes
      |> Enum.map(&normalize_node(&1, project_id))
      |> Enum.reject(&is_nil/1)
      |> Map.new(fn node -> {node_identity(node), node} end)

    :ets.insert(state.table, {project_id, sanitized_nodes})
    {:reply, :ok, state}
  end

  def handle_call({:clear, project_id}, _from, state) do
    :ets.delete(state.table, project_id)
    {:reply, :ok, state}
  end

  defp normalize_node(%{} = node, project_id) do
    with type when is_binary(type) and type != "" <- normalize_string(Map.get(node, :type) || Map.get(node, "type")),
         title when is_binary(title) and title != "" <- normalize_string(Map.get(node, :title) || Map.get(node, "title")),
         content when is_binary(content) and content != "" <- normalize_string(Map.get(node, :content) || Map.get(node, "content")) do
      %{
        project_id: project_id,
        type: type,
        title: title,
        content: content,
        tags: normalize_tags(Map.get(node, :tags) || Map.get(node, "tags")),
        inserted_at: normalize_inserted_at(Map.get(node, :inserted_at) || Map.get(node, "inserted_at"))
      }
    else
      _ -> nil
    end
  end

  defp normalize_node(_, _project_id), do: nil

  defp normalize_tags(tags) when is_list(tags) do
    tags
    |> Enum.map(&normalize_string/1)
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
  end

  defp normalize_tags(tags) when is_binary(tags), do: normalize_tags(String.split(tags, ",", trim: true))
  defp normalize_tags(_), do: []

  defp normalize_inserted_at(%DateTime{} = inserted_at), do: inserted_at

  defp normalize_inserted_at(inserted_at) when is_binary(inserted_at) do
    case DateTime.from_iso8601(inserted_at) do
      {:ok, datetime, _offset} -> datetime
      _ -> DateTime.utc_now() |> DateTime.truncate(:second)
    end
  end

  defp normalize_inserted_at(_), do: DateTime.utc_now() |> DateTime.truncate(:second)

  defp normalize_string(value) when is_binary(value) do
    case String.trim(value) do
      "" -> nil
      trimmed -> trimmed
    end
  end

  defp normalize_string(value) when is_atom(value), do: value |> Atom.to_string() |> normalize_string()
  defp normalize_string(_), do: nil

  defp node_identity(node) do
    :erlang.phash2({node.type, node.title, node.content})
  end

  defp node_rank(node) do
    {
      type_score(node.type),
      DateTime.to_unix(node.inserted_at, :microsecond),
      length(node.tags),
      String.length(node.content)
    }
  end

  defp type_score("goal"), do: 5
  defp type_score("constraints"), do: 4
  defp type_score("approach"), do: 3
  defp type_score("prior_outcomes"), do: 2
  defp type_score(_), do: 1
end
