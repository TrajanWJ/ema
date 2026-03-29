defmodule Place.BrainDumpTest do
  use Place.DataCase, async: true
  alias Place.BrainDump

  describe "create_item/1" do
    test "creates an item with valid attrs" do
      assert {:ok, item} = BrainDump.create_item(%{content: "Buy milk"})
      assert item.content == "Buy milk"
      assert item.source == "text"
      assert item.processed == false
      assert item.action == nil
      assert String.starts_with?(item.id, "bd_")
    end

    test "fails without content" do
      assert {:error, changeset} = BrainDump.create_item(%{})
      assert %{content: ["can't be blank"]} = errors_on(changeset)
    end
  end

  describe "list_unprocessed/0" do
    test "returns only unprocessed items in queue order" do
      {:ok, first} = BrainDump.create_item(%{content: "First"})
      {:ok, processed} = BrainDump.create_item(%{content: "Processed"})
      {:ok, _second} = BrainDump.create_item(%{content: "Second"})
      BrainDump.process_item(processed.id, "archive")
      items = BrainDump.list_unprocessed()
      assert length(items) == 2
      assert hd(items).id == first.id
    end
  end

  describe "process_item/2" do
    test "marks item as processed" do
      {:ok, item} = BrainDump.create_item(%{content: "Process me"})
      assert {:ok, processed} = BrainDump.process_item(item.id, "task")
      assert processed.processed == true
      assert processed.action == "task"
      assert processed.processed_at != nil
    end

    test "returns error for non-existent item" do
      assert {:error, :not_found} = BrainDump.process_item("nope", "task")
    end
  end

  describe "delete_item/1" do
    test "deletes an existing item" do
      {:ok, item} = BrainDump.create_item(%{content: "Delete me"})
      assert {:ok, _} = BrainDump.delete_item(item.id)
      assert BrainDump.get_item(item.id) == nil
    end
  end

  describe "unprocessed_count/0" do
    test "returns count of unprocessed items" do
      {:ok, _} = BrainDump.create_item(%{content: "One"})
      {:ok, item} = BrainDump.create_item(%{content: "Two"})
      BrainDump.process_item(item.id, "archive")
      assert BrainDump.unprocessed_count() == 1
    end
  end
end
