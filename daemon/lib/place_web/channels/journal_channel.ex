defmodule PlaceWeb.JournalChannel do
  use Phoenix.Channel

  alias Place.Journal

  @impl true
  def join("journal:today", _payload, socket) do
    today = Date.utc_today() |> Date.to_iso8601()
    {:ok, entry} = Journal.get_or_create_entry(today)

    response = %{
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

    {:ok, response, socket}
  end
end
