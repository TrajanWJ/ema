defmodule Ema.Knowledge do
  @moduledoc """
  Context module for the Wiki Knowledge Compiler (W8-00).

  Manages wiki sources, sections, knowledge items, and edges.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Knowledge.{WikiSource, WikiSection, KnowledgeItem, KnowledgeEdge}

  # --- WikiSource ---

  def list_sources(opts \\ []) do
    WikiSource
    |> maybe_filter(:project_key, opts[:project_key])
    |> maybe_filter(:space_key, opts[:space_key])
    |> order_by(desc: :updated_at)
    |> Repo.all()
  end

  def get_source(id), do: Repo.get(WikiSource, id)
  def get_source_by_path(path), do: Repo.get_by(WikiSource, path: path)

  def create_source(attrs) do
    %WikiSource{}
    |> WikiSource.changeset(Map.put_new(attrs, :id, generate_id("ws")))
    |> Repo.insert()
  end

  def update_source(%WikiSource{} = source, attrs) do
    source |> WikiSource.changeset(attrs) |> Repo.update()
  end

  def delete_source(%WikiSource{} = source), do: Repo.delete(source)

  # --- WikiSection ---

  def list_sections(source_id) do
    WikiSection
    |> where([s], s.source_id == ^source_id)
    |> order_by(:ordinal)
    |> Repo.all()
  end

  def get_section(id), do: Repo.get(WikiSection, id)

  def create_section(attrs) do
    %WikiSection{}
    |> WikiSection.changeset(Map.put_new(attrs, :id, generate_id("wsec")))
    |> Repo.insert()
  end

  def upsert_section(attrs) do
    %WikiSection{}
    |> WikiSection.changeset(Map.put_new(attrs, :id, generate_id("wsec")))
    |> Repo.insert(
      on_conflict: {:replace, [:heading, :ordinal, :content, :updated_at]},
      conflict_target: [:source_id, :section_key]
    )
  end

  def delete_sections_for_source(source_id) do
    WikiSection
    |> where([s], s.source_id == ^source_id)
    |> Repo.delete_all()
  end

  # --- KnowledgeItem ---

  def list_items(opts \\ []) do
    KnowledgeItem
    |> maybe_filter(:kind, opts[:kind])
    |> maybe_filter(:status, opts[:status])
    |> maybe_filter(:project_id, opts[:project_id])
    |> order_by(desc: :updated_at)
    |> Repo.all()
  end

  def get_item(id), do: Repo.get(KnowledgeItem, id)

  def create_item(attrs) do
    %KnowledgeItem{}
    |> KnowledgeItem.changeset(Map.put_new(attrs, :id, generate_id("ki")))
    |> Repo.insert()
  end

  def update_item(%KnowledgeItem{} = item, attrs) do
    item |> KnowledgeItem.changeset(attrs) |> Repo.update()
  end

  def delete_item(%KnowledgeItem{} = item), do: Repo.delete(item)

  def items_for_project(project_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)

    KnowledgeItem
    |> where([i], i.project_id == ^project_id)
    |> maybe_filter(:kind, opts[:kind])
    |> maybe_filter(:status, opts[:status])
    |> order_by(desc: :updated_at)
    |> limit(^limit)
    |> Repo.all()
  end

  # --- KnowledgeEdge ---

  def list_edges(opts \\ []) do
    KnowledgeEdge
    |> maybe_filter(:edge_type, opts[:edge_type])
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  def create_edge(attrs) do
    %KnowledgeEdge{}
    |> KnowledgeEdge.changeset(Map.put_new(attrs, :id, generate_id("ke")))
    |> Repo.insert()
  end

  def delete_edge(%KnowledgeEdge{} = edge), do: Repo.delete(edge)

  # --- Helpers ---

  defp generate_id(prefix) do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{ts}_#{rand}"
  end

  defp maybe_filter(query, _field, nil), do: query
  defp maybe_filter(query, field, value), do: where(query, [q], field(q, ^field) == ^value)
end
