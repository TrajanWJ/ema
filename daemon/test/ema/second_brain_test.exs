defmodule Ema.SecondBrainTest do
  use Ema.DataCase, async: false

  alias Ema.SecondBrain

  setup do
    # Ensure clean vault directory for each test
    vault_root = SecondBrain.vault_root()
    File.rm_rf!(vault_root)
    File.mkdir_p!(vault_root)

    on_exit(fn -> File.rm_rf!(vault_root) end)
    :ok
  end

  defp create_test_note(attrs \\ %{}) do
    defaults = %{
      file_path: "projects/test-note.md",
      title: "Test Note",
      space: "projects",
      content: "# Test Note\n\nSome content here.",
      source_type: "manual",
      tags: ["test", "example"]
    }

    SecondBrain.create_note(Map.merge(defaults, attrs))
  end

  # --- Notes CRUD ---

  describe "create_note/1" do
    test "creates a note with valid attrs" do
      assert {:ok, note} = create_test_note()
      assert note.title == "Test Note"
      assert note.space == "projects"
      assert note.source_type == "manual"
      assert note.tags == ["test", "example"]
      assert note.word_count > 0
      assert note.content_hash != nil
    end

    test "writes the .md file to disk" do
      assert {:ok, note} = create_test_note()
      full_path = SecondBrain.vault_file_path(note.file_path)
      assert File.exists?(full_path)

      {:ok, content} = File.read(full_path)
      assert String.contains?(content, "Test Note")
    end

    test "fails without file_path" do
      assert {:error, changeset} = SecondBrain.create_note(%{title: "No path"})
      assert %{file_path: ["can't be blank"]} = errors_on(changeset)
    end

    test "rejects invalid source_type" do
      assert {:error, changeset} =
               SecondBrain.create_note(%{
                 file_path: "test.md",
                 source_type: "invalid"
               })

      assert %{source_type: _} = errors_on(changeset)
    end
  end

  describe "get_note/1 and get_note_by_path/1" do
    test "retrieves note by id" do
      {:ok, note} = create_test_note()
      assert SecondBrain.get_note(note.id).id == note.id
    end

    test "retrieves note by file path" do
      {:ok, note} = create_test_note()
      assert SecondBrain.get_note_by_path("projects/test-note.md").id == note.id
    end

    test "returns nil for non-existent note" do
      assert SecondBrain.get_note("nonexistent") == nil
      assert SecondBrain.get_note_by_path("nope.md") == nil
    end
  end

  describe "update_note/2" do
    test "updates note attributes" do
      {:ok, note} = create_test_note()

      assert {:ok, updated} =
               SecondBrain.update_note(note.id, %{title: "Updated Title"})

      assert updated.title == "Updated Title"
    end

    test "updates file on disk when content changes" do
      {:ok, note} = create_test_note()

      assert {:ok, _updated} =
               SecondBrain.update_note(note.id, %{content: "# New Content\n\nUpdated."})

      {:ok, content} = File.read(SecondBrain.vault_file_path(note.file_path))
      assert String.contains?(content, "New Content")
    end

    test "returns error for non-existent note" do
      assert {:error, :not_found} = SecondBrain.update_note("nope", %{title: "X"})
    end
  end

  describe "delete_note/1" do
    test "deletes note and removes file" do
      {:ok, note} = create_test_note()
      full_path = SecondBrain.vault_file_path(note.file_path)
      assert File.exists?(full_path)

      assert {:ok, _} = SecondBrain.delete_note(note.id)
      assert SecondBrain.get_note(note.id) == nil
      refute File.exists?(full_path)
    end

    test "returns error for non-existent note" do
      assert {:error, :not_found} = SecondBrain.delete_note("nope")
    end
  end

  describe "move_note/2" do
    test "moves note to new path" do
      {:ok, note} = create_test_note()
      old_path = SecondBrain.vault_file_path(note.file_path)
      assert File.exists?(old_path)

      assert {:ok, moved} = SecondBrain.move_note("projects/test-note.md", "research-ingestion/moved.md")
      assert moved.file_path == "research-ingestion/moved.md"
      assert moved.space == "research-ingestion"

      new_path = SecondBrain.vault_file_path("research-ingestion/moved.md")
      assert File.exists?(new_path)
      refute File.exists?(old_path)
    end

    test "returns error for non-existent source" do
      assert {:error, :not_found} = SecondBrain.move_note("nope.md", "other.md")
    end
  end

  describe "list_notes/1" do
    test "lists all notes" do
      {:ok, _} = create_test_note(%{file_path: "projects/a.md", title: "A"})
      {:ok, _} = create_test_note(%{file_path: "research-ingestion/b.md", title: "B", space: "research-ingestion"})

      notes = SecondBrain.list_notes()
      assert length(notes) == 2
    end

    test "filters by space" do
      {:ok, _} = create_test_note(%{file_path: "projects/a.md", title: "A"})
      {:ok, _} = create_test_note(%{file_path: "research-ingestion/b.md", title: "B", space: "research-ingestion"})

      notes = SecondBrain.list_notes(space: "projects")
      assert length(notes) == 1
      assert hd(notes).title == "A"
    end

    test "filters by tags" do
      {:ok, _} = create_test_note(%{file_path: "projects/a.md", title: "A", tags: ["elixir", "otp"]})
      {:ok, _} = create_test_note(%{file_path: "projects/b.md", title: "B", tags: ["react"]})

      notes = SecondBrain.list_notes(tags: ["elixir"])
      assert length(notes) == 1
      assert hd(notes).title == "A"
    end
  end

  describe "search_notes/2" do
    test "searches by title" do
      {:ok, _} = create_test_note(%{file_path: "projects/alpha.md", title: "Alpha Design"})
      {:ok, _} = create_test_note(%{file_path: "projects/beta.md", title: "Beta Plan"})

      results = SecondBrain.search_notes("Alpha")
      assert length(results) == 1
      assert hd(results).title == "Alpha Design"
    end

    test "searches by file path" do
      {:ok, _} = create_test_note(%{file_path: "projects/unique-path.md", title: "Note"})

      results = SecondBrain.search_notes("unique-path")
      assert length(results) == 1
    end

    test "returns empty for no matches" do
      {:ok, _} = create_test_note()
      assert SecondBrain.search_notes("zzzzzzz") == []
    end
  end

  # --- Links ---

  describe "create_link/1 and delete_link/1" do
    test "creates and deletes a link" do
      {:ok, source} = create_test_note(%{file_path: "projects/source.md", title: "Source"})
      {:ok, target} = create_test_note(%{file_path: "projects/target.md", title: "Target"})

      assert {:ok, link} =
               SecondBrain.create_link(%{
                 link_text: "Target",
                 link_type: "wikilink",
                 source_note_id: source.id,
                 target_note_id: target.id
               })

      assert link.link_text == "Target"
      assert link.source_note_id == source.id

      assert {:ok, _} = SecondBrain.delete_link(link.id)
    end

    test "creates a link with nil target (unresolved)" do
      {:ok, source} = create_test_note(%{file_path: "projects/source.md", title: "Source"})

      assert {:ok, link} =
               SecondBrain.create_link(%{
                 link_text: "Nonexistent",
                 link_type: "wikilink",
                 source_note_id: source.id,
                 target_note_id: nil
               })

      assert link.target_note_id == nil
    end
  end

  # --- Graph Queries ---

  describe "get_neighbors/1" do
    test "returns all linked notes" do
      {:ok, a} = create_test_note(%{file_path: "projects/a.md", title: "A"})
      {:ok, b} = create_test_note(%{file_path: "projects/b.md", title: "B"})
      {:ok, c} = create_test_note(%{file_path: "projects/c.md", title: "C"})

      # a -> b, c -> a
      {:ok, _} = SecondBrain.create_link(%{link_text: "B", source_note_id: a.id, target_note_id: b.id})
      {:ok, _} = SecondBrain.create_link(%{link_text: "A", source_note_id: c.id, target_note_id: a.id})

      neighbors = SecondBrain.get_neighbors(a.id)
      neighbor_ids = Enum.map(neighbors, & &1.id) |> Enum.sort()
      assert neighbor_ids == Enum.sort([b.id, c.id])
    end
  end

  describe "get_backlinks/1" do
    test "returns notes that link to this note" do
      {:ok, target} = create_test_note(%{file_path: "projects/target.md", title: "Target"})
      {:ok, linker} = create_test_note(%{file_path: "projects/linker.md", title: "Linker"})
      {:ok, other} = create_test_note(%{file_path: "projects/other.md", title: "Other"})

      {:ok, _} = SecondBrain.create_link(%{link_text: "Target", source_note_id: linker.id, target_note_id: target.id})
      {:ok, _} = SecondBrain.create_link(%{link_text: "Other", source_note_id: other.id, target_note_id: linker.id})

      backlinks = SecondBrain.get_backlinks(target.id)
      assert length(backlinks) == 1
      assert hd(backlinks).id == linker.id
    end
  end

  describe "get_orphans/0" do
    test "returns notes with no links" do
      {:ok, linked} = create_test_note(%{file_path: "projects/linked.md", title: "Linked"})
      {:ok, orphan} = create_test_note(%{file_path: "projects/orphan.md", title: "Orphan"})

      {:ok, _} = SecondBrain.create_link(%{link_text: "Linked", source_note_id: linked.id, target_note_id: linked.id})

      orphans = SecondBrain.get_orphans()
      orphan_ids = Enum.map(orphans, & &1.id)
      assert orphan.id in orphan_ids
      refute linked.id in orphan_ids
    end
  end

  describe "get_hubs/1" do
    test "returns notes with most connections" do
      {:ok, hub} = create_test_note(%{file_path: "projects/hub.md", title: "Hub"})
      {:ok, a} = create_test_note(%{file_path: "projects/a.md", title: "A"})
      {:ok, b} = create_test_note(%{file_path: "projects/b.md", title: "B"})
      {:ok, c} = create_test_note(%{file_path: "projects/c.md", title: "C"})

      {:ok, _} = SecondBrain.create_link(%{link_text: "A", source_note_id: hub.id, target_note_id: a.id})
      {:ok, _} = SecondBrain.create_link(%{link_text: "B", source_note_id: hub.id, target_note_id: b.id})
      {:ok, _} = SecondBrain.create_link(%{link_text: "C", source_note_id: hub.id, target_note_id: c.id})

      hubs = SecondBrain.get_hubs(1)
      assert length(hubs) == 1
      assert hd(hubs).note.id == hub.id
      assert hd(hubs).connection_count == 3
    end
  end

  describe "get_full_graph/1" do
    test "returns nodes and edges" do
      {:ok, a} = create_test_note(%{file_path: "projects/a.md", title: "A"})
      {:ok, b} = create_test_note(%{file_path: "projects/b.md", title: "B"})
      {:ok, _} = SecondBrain.create_link(%{link_text: "B", source_note_id: a.id, target_note_id: b.id})

      graph = SecondBrain.get_full_graph()
      assert length(graph.nodes) == 2
      assert length(graph.edges) == 1
      assert hd(graph.edges).source == a.id
      assert hd(graph.edges).target == b.id
    end
  end
end
