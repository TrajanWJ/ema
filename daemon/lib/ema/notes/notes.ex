defmodule Ema.Notes do
  @moduledoc """
  Notes — freeform notes linked to sources (brain dump items, journal entries, etc).
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Notes.Note

  def list_notes(opts \\ []) do
    Note
    |> maybe_search(opts[:search])
    |> order_by(desc: :updated_at)
    |> Repo.all()
  end

  def get_note(id), do: Repo.get(Note, id)

  def create_note(attrs) do
    id = attrs["id"] || Ecto.UUID.generate()

    %Note{}
    |> Note.changeset(Map.put(attrs, "id", id))
    |> Repo.insert()
    |> tap_broadcast(:note_created)
  end

  def update_note(id, attrs) do
    case get_note(id) do
      nil ->
        {:error, :not_found}

      note ->
        note
        |> Note.changeset(attrs)
        |> Repo.update()
        |> tap_broadcast(:note_updated)
    end
  end

  def delete_note(id) do
    case get_note(id) do
      nil ->
        {:error, :not_found}

      note ->
        Repo.delete(note)
        |> tap_broadcast(:note_deleted)
    end
  end

  defp maybe_search(query, nil), do: query
  defp maybe_search(query, ""), do: query

  defp maybe_search(query, term) do
    pattern = "%#{term}%"
    where(query, [n], ilike(n.title, ^pattern) or ilike(n.content, ^pattern))
  end

  defp tap_broadcast({:ok, note} = result, event) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "notes", {event, serialize(note)})
    result
  end

  defp tap_broadcast(error, _event), do: error

  def serialize(note) do
    %{
      id: note.id,
      title: note.title,
      content: note.content,
      source_type: note.source_type,
      source_id: note.source_id,
      inserted_at: note.inserted_at,
      updated_at: note.updated_at
    }
  end
end
