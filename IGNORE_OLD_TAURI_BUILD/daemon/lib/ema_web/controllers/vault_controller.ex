defmodule EmaWeb.VaultController do
  use EmaWeb, :controller

  alias Ema.SecondBrain

  action_fallback EmaWeb.FallbackController

  def tree(conn, _params) do
    tree = SecondBrain.get_directory_tree()
    json(conn, %{tree: tree})
  end

  def show(conn, %{"path" => path}) do
    case SecondBrain.get_note_by_path(path) do
      nil ->
        {:error, :not_found}

      note ->
        content =
          case SecondBrain.read_note_content(path) do
            {:ok, c} -> c
            {:error, _} -> nil
          end

        json(conn, %{note: serialize_note(note), content: content})
    end
  end

  def upsert(conn, params) do
    path = params["path"]

    attrs = %{
      file_path: path,
      title: params["title"],
      space: params["space"] || extract_space(path),
      tags: params["tags"] || [],
      content: params["content"],
      source_type: params["source_type"] || "manual"
    }

    case SecondBrain.get_note_by_path(path) do
      nil ->
        with {:ok, note} <- SecondBrain.create_note(attrs) do
          broadcast_change("note_created", note)

          conn
          |> put_status(:created)
          |> json(%{note: serialize_note(note)})
        end

      existing ->
        with {:ok, note} <- SecondBrain.update_note(existing.id, attrs) do
          broadcast_change("note_updated", note)
          json(conn, %{note: serialize_note(note)})
        end
    end
  end

  def delete(conn, %{"path" => path}) do
    case SecondBrain.get_note_by_path(path) do
      nil ->
        {:error, :not_found}

      note ->
        with {:ok, deleted} <- SecondBrain.delete_note(note.id) do
          broadcast_change("note_deleted", deleted)
          json(conn, %{ok: true})
        end
    end
  end

  def move(conn, %{"from" => from, "to" => to}) do
    with {:ok, note} <- SecondBrain.move_note(from, to) do
      broadcast_change("note_moved", note)
      json(conn, %{note: serialize_note(note)})
    end
  end

  def search(conn, params) do
    query = params["q"] || ""
    opts = if params["space"], do: [space: params["space"]], else: []
    notes = SecondBrain.search_notes(query, opts)
    json(conn, %{notes: Enum.map(notes, &serialize_note/1)})
  end

  def graph(conn, _params) do
    graph = SecondBrain.get_full_graph()
    json(conn, graph)
  end

  def neighbors(conn, %{"id" => id}) do
    notes = SecondBrain.get_neighbors(id)
    json(conn, %{notes: Enum.map(notes, &serialize_note/1)})
  end

  def typed_neighbors(conn, %{"id" => id}) do
    typed = SecondBrain.get_typed_neighbors(id)

    grouped =
      typed
      |> Enum.group_by(fn {edge_type, _note} -> edge_type end, fn {_edge_type, note} -> note end)
      |> Enum.map(fn {edge_type, notes} ->
        %{edge_type: edge_type, notes: Enum.map(notes, &serialize_note/1)}
      end)

    json(conn, %{groups: grouped})
  end

  def orphans(conn, _params) do
    notes = SecondBrain.get_orphans()
    json(conn, %{notes: Enum.map(notes, &serialize_note/1)})
  end

  # --- Private ---

  defp serialize_note(note) do
    %{
      id: note.id,
      file_path: note.file_path,
      title: note.title,
      space: note.space,
      content_hash: note.content_hash,
      source_type: note.source_type,
      source_id: note.source_id,
      tags: note.tags,
      word_count: note.word_count,
      project_id: note.project_id,
      created_at: note.inserted_at,
      updated_at: note.updated_at
    }
  end

  defp broadcast_change(event, note) do
    EmaWeb.Endpoint.broadcast("vault:files", event, serialize_note(note))
  end

  defp extract_space(nil), do: nil

  defp extract_space(path) do
    case String.split(path, "/", parts: 2) do
      [space, _rest] -> space
      _ -> nil
    end
  end
end
