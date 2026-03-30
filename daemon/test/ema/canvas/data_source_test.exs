defmodule Ema.Canvas.DataSourceTest do
  use Ema.DataCase, async: false
  alias Ema.Canvas.DataSource

  describe "available_sources/0" do
    test "returns a map of sources" do
      sources = DataSource.available_sources()
      assert is_map(sources)
      assert Map.has_key?(sources, "tasks:by_status")
      assert Map.has_key?(sources, "custom:query")
    end
  end

  describe "fetch/2 returns proper format" do
    test "tasks:by_status returns list of maps" do
      assert {:ok, data} = DataSource.fetch("tasks:by_status", %{})
      assert is_list(data)
    end

    test "tasks:by_project returns list of maps" do
      assert {:ok, data} = DataSource.fetch("tasks:by_project", %{})
      assert is_list(data)
    end

    test "tasks:completed_over_time returns list of maps" do
      assert {:ok, data} = DataSource.fetch("tasks:completed_over_time", %{"days" => 7})
      assert is_list(data)
    end

    test "proposals:by_confidence returns list (stub)" do
      assert {:ok, []} = DataSource.fetch("proposals:by_confidence", %{})
    end

    test "proposals:approval_rate returns list (stub)" do
      assert {:ok, []} = DataSource.fetch("proposals:approval_rate", %{})
    end

    test "habits:completion_rate returns list of maps" do
      assert {:ok, data} = DataSource.fetch("habits:completion_rate", %{"days" => 7})
      assert is_list(data)
    end

    test "responsibilities:health returns list (stub)" do
      assert {:ok, []} = DataSource.fetch("responsibilities:health", %{})
    end

    test "sessions:token_usage returns list (stub)" do
      assert {:ok, []} = DataSource.fetch("sessions:token_usage", %{})
    end

    test "vault:notes_by_space returns list of maps" do
      assert {:ok, data} = DataSource.fetch("vault:notes_by_space", %{})
      assert is_list(data)
    end

    test "unknown source returns error" do
      assert {:error, "Unknown data source: bogus"} = DataSource.fetch("bogus", %{})
    end
  end

  describe "custom:query safety" do
    test "allows valid SELECT" do
      assert {:ok, _data} = DataSource.fetch("custom:query", %{"query" => "SELECT 1"})
    end

    test "rejects INSERT" do
      assert {:error, msg} =
               DataSource.fetch("custom:query", %{
                 "query" => "INSERT INTO tasks (id, title) VALUES ('x', 'y')"
               })

      assert msg =~ "forbidden" or msg =~ "Only SELECT"
    end

    test "rejects UPDATE" do
      assert {:error, _} =
               DataSource.fetch("custom:query", %{
                 "query" => "UPDATE tasks SET title = 'hacked'"
               })
    end

    test "rejects DELETE" do
      assert {:error, _} =
               DataSource.fetch("custom:query", %{"query" => "DELETE FROM tasks"})
    end

    test "rejects DROP" do
      assert {:error, _} =
               DataSource.fetch("custom:query", %{"query" => "DROP TABLE tasks"})
    end

    test "rejects ALTER" do
      assert {:error, _} =
               DataSource.fetch("custom:query", %{
                 "query" => "ALTER TABLE tasks ADD COLUMN foo TEXT"
               })
    end

    test "rejects empty query" do
      assert {:error, "Query cannot be empty"} =
               DataSource.fetch("custom:query", %{"query" => ""})
    end

    test "rejects SELECT with embedded DELETE" do
      assert {:error, _} =
               DataSource.fetch("custom:query", %{
                 "query" => "SELECT * FROM tasks; DELETE FROM tasks"
               })
    end
  end
end
