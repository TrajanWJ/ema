defmodule Ema.SecondBrain.GraphBuilderTest do
  use Ema.DataCase, async: false

  alias Ema.SecondBrain
  alias Ema.SecondBrain.GraphBuilder

  setup do
    vault_root = SecondBrain.vault_root()
    File.rm_rf!(vault_root)
    File.mkdir_p!(vault_root)

    on_exit(fn -> File.rm_rf!(vault_root) end)
    :ok
  end

  describe "parse_wikilinks/1" do
    test "extracts simple wikilinks" do
      content = "Check out [[My Note]] and [[Another Note]] for details."
      assert GraphBuilder.parse_wikilinks(content) == [
               {"references", "My Note"},
               {"references", "Another Note"}
             ]
    end

    test "extracts wikilinks with display text" do
      content = "See [[projects/ema/spec|the EMA spec]] for details."
      assert GraphBuilder.parse_wikilinks(content) == [{"references", "projects/ema/spec"}]
    end

    test "deduplicates links" do
      content = "Link to [[Note A]] and again to [[Note A]]."
      assert GraphBuilder.parse_wikilinks(content) == [{"references", "Note A"}]
    end

    test "returns empty for content without links" do
      assert GraphBuilder.parse_wikilinks("No links here.") == []
    end

    test "returns empty for nil" do
      assert GraphBuilder.parse_wikilinks(nil) == []
    end

    test "handles multiple links on same line" do
      content = "[[A]] links to [[B]] and [[C]]"
      assert GraphBuilder.parse_wikilinks(content) == [
               {"references", "A"},
               {"references", "B"},
               {"references", "C"}
             ]
    end

    test "handles links with paths" do
      content = "See [[projects/ema/design]] for the design doc."
      assert GraphBuilder.parse_wikilinks(content) == [{"references", "projects/ema/design"}]
    end
  end

  describe "link creation from content" do
    test "creates links by scanning note content on disk" do
      # Create two notes
      {:ok, source} =
        SecondBrain.create_note(%{
          file_path: "projects/source.md",
          title: "Source",
          space: "projects",
          content: "This links to [[Target]] note."
        })

      {:ok, target} =
        SecondBrain.create_note(%{
          file_path: "projects/target.md",
          title: "Target",
          space: "projects",
          content: "# Target\n\nNo links here."
        })

      # Start GraphBuilder to process the notes
      start_supervised!(GraphBuilder)

      # Give it a moment to process
      Process.sleep(200)

      # Check that a link was created from source to target
      neighbors = SecondBrain.get_neighbors(source.id)
      neighbor_ids = Enum.map(neighbors, & &1.id)
      assert target.id in neighbor_ids
    end

    test "creates unresolved links for missing targets" do
      {:ok, _source} =
        SecondBrain.create_note(%{
          file_path: "projects/lonely.md",
          title: "Lonely",
          space: "projects",
          content: "Links to [[Nonexistent Note]] which does not exist."
        })

      start_supervised!(GraphBuilder)
      Process.sleep(200)

      # The link should exist but with no target
      links = Ema.Repo.all(Ema.SecondBrain.Link)
      assert length(links) >= 1

      unresolved = Enum.find(links, &(&1.link_text == "Nonexistent Note"))
      assert unresolved != nil
      assert unresolved.target_note_id == nil
    end
  end
end
