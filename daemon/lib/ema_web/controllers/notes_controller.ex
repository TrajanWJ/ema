defmodule EmaWeb.NotesController do
  use EmaWeb, :controller

  alias Ema.Notes

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    notes = Notes.list_notes(search: params["search"])
    json(conn, %{notes: Enum.map(notes, &Notes.serialize/1)})
  end

  def show(conn, %{"id" => id}) do
    case Notes.get_note(id) do
      nil -> {:error, :not_found}
      note -> json(conn, %{note: Notes.serialize(note)})
    end
  end

  def create(conn, params) do
    case Notes.create_note(params) do
      {:ok, note} ->
        conn |> put_status(:created) |> json(%{note: Notes.serialize(note)})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Notes.update_note(id, params) do
      {:ok, note} ->
        json(conn, %{note: Notes.serialize(note)})

      {:error, :not_found} ->
        {:error, :not_found}

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  def delete(conn, %{"id" => id}) do
    case Notes.delete_note(id) do
      {:ok, _} -> json(conn, %{ok: true})
      {:error, :not_found} -> {:error, :not_found}
    end
  end

  defp format_errors(%Ecto.Changeset{} = cs) do
    Ecto.Changeset.traverse_errors(cs, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end

  defp format_errors(err), do: %{detail: inspect(err)}
end
