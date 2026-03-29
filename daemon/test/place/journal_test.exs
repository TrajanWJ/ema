defmodule Place.JournalTest do
  use Place.DataCase, async: true
  alias Place.Journal

  describe "get_or_create_entry/1" do
    test "creates entry with default template" do
      date = Date.utc_today() |> Date.to_iso8601()
      assert {:ok, entry} = Journal.get_or_create_entry(date)
      assert entry.date == date
      assert entry.content =~ "Today's Focus"
      assert String.starts_with?(entry.id, "jrn_")
    end

    test "returns same entry on second call" do
      date = Date.utc_today() |> Date.to_iso8601()
      {:ok, first} = Journal.get_or_create_entry(date)
      {:ok, second} = Journal.get_or_create_entry(date)
      assert first.id == second.id
    end
  end

  describe "update_entry/2" do
    test "changes content" do
      date = Date.utc_today() |> Date.to_iso8601()
      {:ok, _} = Journal.get_or_create_entry(date)
      assert {:ok, updated} = Journal.update_entry(date, %{content: "New content"})
      assert updated.content == "New content"
    end

    test "updates mood and energy" do
      date = Date.utc_today() |> Date.to_iso8601()
      {:ok, _} = Journal.get_or_create_entry(date)

      assert {:ok, updated} =
               Journal.update_entry(date, %{mood: 4, energy_p: 7, energy_m: 5, energy_e: 3})

      assert updated.mood == 4
      assert updated.energy_p == 7
    end

    test "rejects invalid mood" do
      date = Date.utc_today() |> Date.to_iso8601()
      {:ok, _} = Journal.get_or_create_entry(date)
      assert {:error, changeset} = Journal.update_entry(date, %{mood: 6})
      assert %{mood: _} = errors_on(changeset)
    end
  end

  describe "search/1" do
    test "finds entries by content" do
      date = Date.utc_today() |> Date.to_iso8601()
      {:ok, _} = Journal.get_or_create_entry(date)
      Journal.update_entry(date, %{content: "Learned about Elixir macros today"})

      results = Journal.search("Elixir")
      assert length(results) == 1
      assert hd(results).date == date
    end

    test "returns empty for blank query" do
      assert Journal.search("") == []
      assert Journal.search(nil) == []
    end
  end
end
