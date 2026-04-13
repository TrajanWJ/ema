defmodule EmaWeb.JournalController do
  use EmaWeb, :controller

  alias Ema.Journal

  action_fallback EmaWeb.FallbackController

  def show(conn, %{"date" => date}) do
    with {:ok, entry} <- Journal.get_or_create_entry(date) do
      json(conn, serialize_entry(entry))
    end
  end

  def update(conn, %{"date" => date} = params) do
    valid_fields = ~w(content one_thing mood energy_p energy_m energy_e gratitude tags)

    attrs =
      params
      |> Map.take(valid_fields)
      |> Map.new(fn {k, v} -> {String.to_existing_atom(k), v} end)

    case Journal.update_entry(date, attrs) do
      {:ok, entry} ->
        EmaWeb.Endpoint.broadcast("journal:today", "entry_updated", serialize_entry(entry))
        json(conn, serialize_entry(entry))

      {:error, :not_found} ->
        # Entry doesn't exist yet — create it first, then update
        with {:ok, _entry} <- Journal.get_or_create_entry(date),
             {:ok, entry} <- Journal.update_entry(date, attrs) do
          EmaWeb.Endpoint.broadcast("journal:today", "entry_updated", serialize_entry(entry))
          json(conn, serialize_entry(entry))
        end

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def search(conn, %{"q" => query}) do
    entries = Journal.search(query) |> Enum.map(&serialize_entry/1)
    json(conn, %{entries: entries})
  end

  def search(conn, _params) do
    json(conn, %{entries: []})
  end

  defp serialize_entry(entry) do
    %{
      id: entry.id,
      date: entry.date,
      content: entry.content,
      one_thing: entry.one_thing,
      mood: entry.mood,
      energy_p: entry.energy_p,
      energy_m: entry.energy_m,
      energy_e: entry.energy_e,
      gratitude: entry.gratitude,
      tags: entry.tags,
      created_at: entry.inserted_at,
      updated_at: entry.updated_at
    }
  end
end
