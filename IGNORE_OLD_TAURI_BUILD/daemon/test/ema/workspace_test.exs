defmodule Ema.WorkspaceTest do
  use Ema.DataCase

  alias Ema.Workspace

  describe "upsert/2" do
    test "creates a new window state" do
      assert {:ok, ws} =
               Workspace.upsert("brain-dump", %{x: 100, y: 200, width: 600, height: 700})

      assert ws.app_id == "brain-dump"
      assert ws.x == 100
      assert ws.is_open == false
    end

    test "updates existing window state" do
      {:ok, _} = Workspace.upsert("habits", %{x: 0, y: 0})
      {:ok, ws} = Workspace.upsert("habits", %{x: 500, y: 300})
      assert ws.x == 500
      assert ws.y == 300
    end
  end

  describe "mark_open/2 and mark_closed/2" do
    test "toggles is_open flag" do
      {:ok, ws} = Workspace.mark_open("journal", %{x: 100, y: 100, width: 800, height: 700})
      assert ws.is_open == true

      {:ok, ws} = Workspace.mark_closed("journal", %{x: 150, y: 120})
      assert ws.is_open == false
      assert ws.x == 150
    end
  end

  describe "list_open/0" do
    test "returns only open windows" do
      {:ok, _} = Workspace.mark_open("brain-dump")
      {:ok, _} = Workspace.mark_closed("habits")
      {:ok, _} = Workspace.mark_open("journal")

      open = Workspace.list_open()
      app_ids = Enum.map(open, & &1.app_id) |> Enum.sort()
      assert app_ids == ["brain-dump", "journal"]
    end
  end

  describe "close_all/0" do
    test "marks all windows as closed" do
      {:ok, _} = Workspace.mark_open("brain-dump")
      {:ok, _} = Workspace.mark_open("journal")

      Workspace.close_all()

      assert Workspace.list_open() == []
    end
  end
end
