defmodule Place.Journal do
  @moduledoc """
  Journal — daily journal entries with mood/energy tracking and search.
  """

  import Ecto.Query
  alias Place.Repo
  alias Place.Journal.Entry

  def get_entry(date) do
    Repo.get_by(Entry, date: date)
  end

  def get_or_create_entry(date) do
    case get_entry(date) do
      nil -> create_entry(date)
      entry -> {:ok, entry}
    end
  end

  def create_entry(date) do
    id = generate_id()

    %Entry{}
    |> Entry.changeset(%{id: id, date: date, content: Entry.default_template()})
    |> Repo.insert()
  end

  def update_entry(date, attrs) do
    case get_entry(date) do
      nil ->
        {:error, :not_found}

      entry ->
        entry
        |> Entry.changeset(attrs)
        |> Repo.update()
    end
  end

  def list_entries(limit \\ 30) do
    Entry
    |> order_by(desc: :date)
    |> limit(^limit)
    |> Repo.all()
  end

  def search(query) when is_binary(query) and query != "" do
    pattern = "%#{query}%"

    Entry
    |> where([e], like(e.content, ^pattern) or like(e.one_thing, ^pattern))
    |> order_by(desc: :date)
    |> Repo.all()
  end

  def search(_), do: []

  defp generate_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "jrn_#{timestamp}_#{random}"
  end
end
