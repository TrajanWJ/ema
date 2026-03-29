defmodule Place.HabitsTest do
  use Place.DataCase, async: true
  alias Place.Habits

  describe "create_habit/1" do
    test "creates a habit with auto-assigned color" do
      assert {:ok, habit} = Habits.create_habit(%{name: "Meditate"})
      assert habit.name == "Meditate"
      assert habit.frequency == "daily"
      assert habit.active == true
      assert habit.color != nil
      assert String.starts_with?(habit.id, "hab_")
    end

    test "enforces 7-habit limit" do
      for i <- 1..7 do
        assert {:ok, _} = Habits.create_habit(%{name: "Habit #{i}"})
      end

      assert {:error, :max_habits_reached} = Habits.create_habit(%{name: "Habit 8"})
    end
  end

  describe "toggle_log/2" do
    test "creates a completed log on first toggle" do
      {:ok, habit} = Habits.create_habit(%{name: "Read"})
      date = Date.utc_today() |> Date.to_iso8601()

      assert {:ok, log} = Habits.toggle_log(habit.id, date)
      assert log.completed == true
      assert String.starts_with?(log.id, "hl_")
    end

    test "toggles off on second toggle" do
      {:ok, habit} = Habits.create_habit(%{name: "Read"})
      date = Date.utc_today() |> Date.to_iso8601()

      {:ok, _} = Habits.toggle_log(habit.id, date)
      assert {:ok, log} = Habits.toggle_log(habit.id, date)
      assert log.completed == false
    end
  end

  describe "calculate_streak/1" do
    test "returns 0 for no logs" do
      {:ok, habit} = Habits.create_habit(%{name: "Exercise"})
      assert Habits.calculate_streak(habit.id) == 0
    end

    test "counts consecutive completed days" do
      {:ok, habit} = Habits.create_habit(%{name: "Exercise"})
      today = Date.utc_today()

      for offset <- 0..2 do
        date = today |> Date.add(-offset) |> Date.to_iso8601()
        Habits.toggle_log(habit.id, date)
      end

      assert Habits.calculate_streak(habit.id) == 3
    end
  end

  describe "archive_habit/1" do
    test "sets active to false" do
      {:ok, habit} = Habits.create_habit(%{name: "Old habit"})
      assert {:ok, archived} = Habits.archive_habit(habit.id)
      assert archived.active == false

      # Archived habit should not appear in active list
      assert Habits.list_active() == []
    end
  end
end
