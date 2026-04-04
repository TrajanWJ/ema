defmodule Ema.SecondBrain do
  @moduledoc """
  Second Brain — EMA's built-in knowledge vault.
  Graph-connected markdown files organized into spaces.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.SecondBrain.{Note, Link}

  # --- Notes CRUD ---

  def list_notes(opts \\ []) do
    Note
    |> maybe_filter_space(opts[:space])
    |> maybe_filter_project(opts[:project_id])
    |> maybe_filter_tags(opts[:tags])
    |> order_by(desc: :updated_at)
    |> Repo.all()
  end

  def get_note(id), do: Repo.get(Note, id)

  def get_note_by_path(file_path) do
    Repo.get_by(Note, file_path: file_path)
  end

  def create_note(attrs) do
    id = attrs[:id] || attrs["id"] || generate_id()
    content = attrs[:content] || attrs["content"]
    file_path = attrs[:file_path] || attrs["file_path"]

    note_attrs =
      attrs
      |> to_string_keys()
      |> Map.put("id", id)
      |> maybe_compute_hash(content)
      |> maybe_compute_word_count(content)

    result =
      %Note{}
      |> Note.changeset(note_attrs)
      |> Repo.insert()

    case result do
      {:ok, note} ->
        if content && file_path do
          write_file(file_path, content, note)
        end

        Phoenix.PubSub.broadcast(Ema.PubSub, "vault:changes", {:note_created, note})
        {:ok, note}

      error ->
        error
    end
  end

  def update_note(id, attrs) do
    case get_note(id) do
      nil ->
        {:error, :not_found}

      note ->
        content = attrs[:content] || attrs["content"]

        note_attrs =
          attrs
          |> to_string_keys()
          |> maybe_compute_hash(content)
          |> maybe_compute_word_count(content)

        result =
          note
          |> Note.changeset(note_attrs)
          |> Repo.update()

        case result do
          {:ok, updated} ->
            if content do
              write_file(updated.file_path, content, updated)
            end

            Phoenix.PubSub.broadcast(Ema.PubSub, "vault:changes", {:note_updated, updated})
            {:ok, updated}

          error ->
            error
        end
    end
  end

  def delete_note(id) do
    case get_note(id) do
      nil ->
        {:error, :not_found}

      note ->
        full_path = vault_file_path(note.file_path)

        case Repo.delete(note) do
          {:ok, deleted} ->
            File.rm(full_path)
            Phoenix.PubSub.broadcast(Ema.PubSub, "vault:changes", {:note_deleted, deleted})
            {:ok, deleted}

          error ->
            error
        end
    end
  end

  def move_note(old_path, new_path) do
    case get_note_by_path(old_path) do
      nil ->
        {:error, :not_found}

      note ->
        new_space = extract_space(new_path)

        result =
          note
          |> Note.changeset(%{"file_path" => new_path, "space" => new_space})
          |> Repo.update()

        case result do
          {:ok, updated} ->
            old_full = vault_file_path(old_path)
            new_full = vault_file_path(new_path)
            File.mkdir_p!(Path.dirname(new_full))

            if File.exists?(old_full) do
              File.rename(old_full, new_full)
            end

            Phoenix.PubSub.broadcast(Ema.PubSub, "vault:changes", {:note_moved, updated})
            {:ok, updated}

          error ->
            error
        end
    end
  end

  def search_notes(query, opts \\ []) do
    escaped =
      query
      |> String.replace("\\", "\\\\")
      |> String.replace("%", "\\%")
      |> String.replace("_", "\\_")

    pattern = "%#{escaped}%"

    Note
    |> where([n], like(n.title, ^pattern) or like(n.file_path, ^pattern))
    |> maybe_filter_space(opts[:space])
    |> order_by(desc: :updated_at)
    |> Repo.all()
  end

  # --- Links CRUD ---

  def create_link(attrs) do
    id = attrs[:id] || attrs["id"] || generate_id()

    link_attrs =
      attrs
      |> to_string_keys()
      |> Map.put("id", id)

    %Link{}
    |> Link.changeset(link_attrs)
    |> Repo.insert()
  end

  def delete_link(id) do
    case Repo.get(Link, id) do
      nil -> {:error, :not_found}
      link -> Repo.delete(link)
    end
  end

  # --- Graph Queries ---

  def get_neighbors(note_id) do
    outgoing_ids =
      Link
      |> where([l], l.source_note_id == ^note_id and not is_nil(l.target_note_id))
      |> select([l], l.target_note_id)
      |> Repo.all()

    incoming_ids =
      Link
      |> where([l], l.target_note_id == ^note_id)
      |> select([l], l.source_note_id)
      |> Repo.all()

    neighbor_ids = Enum.uniq(outgoing_ids ++ incoming_ids)

    Note
    |> where([n], n.id in ^neighbor_ids)
    |> Repo.all()
  end

  def get_typed_neighbors(note_id) do
    outgoing =
      Link
      |> where([l], l.source_note_id == ^note_id and not is_nil(l.target_note_id))
      |> preload(:target_note)
      |> Repo.all()
      |> Enum.map(fn l -> {l.edge_type, l.target_note} end)

    incoming =
      Link
      |> where([l], l.target_note_id == ^note_id)
      |> preload(:source_note)
      |> Repo.all()
      |> Enum.map(fn l -> {l.edge_type, l.source_note} end)

    outgoing ++ incoming
  end

  def get_links_by_type(edge_type) do
    Link
    |> where([l], l.edge_type == ^edge_type and not is_nil(l.target_note_id))
    |> preload([:source_note, :target_note])
    |> Repo.all()
  end

  def get_backlinks(note_id) do
    source_ids =
      Link
      |> where([l], l.target_note_id == ^note_id)
      |> select([l], l.source_note_id)
      |> Repo.all()

    Note
    |> where([n], n.id in ^source_ids)
    |> Repo.all()
  end

  def get_orphans do
    linked_ids =
      Link
      |> select([l], l.source_note_id)
      |> union(^from(l in Link, where: not is_nil(l.target_note_id), select: l.target_note_id))
      |> Repo.all()

    Note
    |> where([n], n.id not in ^linked_ids)
    |> Repo.all()
  end

  def get_hubs(limit \\ 10) do
    # Count connections per note (both incoming and outgoing)
    outgoing =
      Link
      |> group_by([l], l.source_note_id)
      |> select([l], %{note_id: l.source_note_id, count: count(l.id)})

    incoming =
      Link
      |> where([l], not is_nil(l.target_note_id))
      |> group_by([l], l.target_note_id)
      |> select([l], %{note_id: l.target_note_id, count: count(l.id)})

    outgoing_counts = Repo.all(outgoing)
    incoming_counts = Repo.all(incoming)

    merged =
      (outgoing_counts ++ incoming_counts)
      |> Enum.group_by(& &1.note_id)
      |> Enum.map(fn {note_id, entries} ->
        {note_id, Enum.sum(Enum.map(entries, & &1.count))}
      end)
      |> Enum.sort_by(fn {_id, count} -> count end, :desc)
      |> Enum.take(limit)

    hub_ids = Enum.map(merged, fn {id, _} -> id end)
    notes = Note |> where([n], n.id in ^hub_ids) |> Repo.all()

    Enum.map(merged, fn {id, count} ->
      note = Enum.find(notes, &(&1.id == id))
      %{note: note, connection_count: count}
    end)
  end

  def get_full_graph(opts \\ []) do
    notes =
      Note
      |> maybe_filter_space(opts[:space])
      |> Repo.all()

    note_ids = MapSet.new(notes, & &1.id)

    links = Repo.all(Link)

    nodes =
      Enum.map(notes, fn n ->
        %{
          id: n.id,
          title: n.title,
          file_path: n.file_path,
          space: n.space,
          tags: n.tags
        }
      end)

    # Only include edges where both source and target are in the filtered note set
    edges =
      links
      |> Enum.filter(fn l ->
        MapSet.member?(note_ids, l.source_note_id) and
          MapSet.member?(note_ids, l.target_note_id)
      end)
      |> Enum.map(fn l ->
        %{
          id: l.id,
          source: l.source_note_id,
          target: l.target_note_id,
          link_text: l.link_text,
          link_type: l.link_type,
          edge_type: l.edge_type
        }
      end)

    %{nodes: nodes, edges: edges}
  end

  # --- File Operations ---

  def vault_root do
    Application.get_env(:ema, :vault_root, default_vault_root())
  end

  def vault_file_path(relative_path) do
    Path.join(vault_root(), relative_path)
  end

  def read_note_content(file_path) do
    full_path = vault_file_path(file_path)

    case File.read(full_path) do
      {:ok, content} -> {:ok, content}
      {:error, reason} -> {:error, reason}
    end
  end

  def get_directory_tree do
    root = vault_root()

    if File.dir?(root) do
      build_tree(root, root)
    else
      %{name: "vault", type: "directory", children: []}
    end
  end

  # --- Private Helpers ---

  defp build_tree(path, root) do
    name = Path.basename(path)
    relative = Path.relative_to(path, root)

    if File.dir?(path) do
      children =
        path
        |> File.ls!()
        |> Enum.sort()
        |> Enum.reject(&String.starts_with?(&1, "."))
        |> Enum.map(fn child -> build_tree(Path.join(path, child), root) end)

      %{name: name, type: "directory", path: relative, children: children}
    else
      %{name: name, type: "file", path: relative}
    end
  end

  defp maybe_filter_space(query, nil), do: query
  defp maybe_filter_space(query, space), do: where(query, [n], n.space == ^space)

  defp maybe_filter_project(query, nil), do: query
  defp maybe_filter_project(query, id), do: where(query, [n], n.project_id == ^id)

  defp maybe_filter_tags(query, nil), do: query

  defp maybe_filter_tags(query, tags) when is_list(tags) do
    Enum.reduce(tags, query, fn tag, q ->
      # SQLite stores tags as JSON array string; use LIKE for matching
      pattern = "%\"#{tag}\"%"
      where(q, [n], like(fragment("CAST(? AS TEXT)", n.tags), ^pattern))
    end)
  end

  defp maybe_compute_hash(attrs, nil), do: attrs

  defp maybe_compute_hash(attrs, content) do
    hash = :crypto.hash(:sha256, content) |> Base.encode16(case: :lower)
    Map.put(attrs, "content_hash", hash)
  end

  defp maybe_compute_word_count(attrs, nil), do: attrs

  defp maybe_compute_word_count(attrs, content) do
    count = content |> String.split(~r/\s+/, trim: true) |> length()
    Map.put(attrs, "word_count", count)
  end

  defp write_file(relative_path, content, note) do
    full_path = vault_file_path(relative_path)
    File.mkdir_p!(Path.dirname(full_path))

    frontmatter = build_frontmatter(note)
    File.write!(full_path, frontmatter <> content)
  end

  defp build_frontmatter(note) do
    """
    ---
    id: "#{note.id}"
    title: "#{note.title || ""}"
    space: #{note.space || ""}
    tags: #{Jason.encode!(note.tags || [])}
    source: #{note.source_type || "manual"}
    ---

    """
  end

  defp extract_space(file_path) do
    case String.split(file_path, "/", parts: 2) do
      [space, _rest] -> space
      _ -> nil
    end
  end

  defp to_string_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} -> {k, v}
    end)
  end

  defp generate_id do
    Ecto.UUID.generate()
  end

  defp default_vault_root do
    Ema.Config.vault_path()
  end
end
