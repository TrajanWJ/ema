defmodule Ema.Intelligence.ContextFetcherTest do
  use Ema.DataCase, async: false

  alias Ema.Intelligence.{ContextFetcher, ContextIndexer, ContextStore}

  describe "fetch/2" do
    test "formats the top ranked project fragments with task-title matching" do
      {:ok, _} =
        ContextStore.create_fragment(%{
          project_slug: "ctx-fetcher",
          fragment_type: "code",
          content: "def sync_context(project_slug)",
          file_path: "lib/ema/intelligence/context_fetcher.ex",
          relevance_score: 0.5
        })

      {:ok, _} =
        ContextStore.create_fragment(%{
          project_slug: "ctx-fetcher",
          fragment_type: "code",
          content: "def unrelated_feature(flag)",
          file_path: "lib/ema/misc.ex",
          relevance_score: 0.9
        })

      assert block = ContextFetcher.fetch("ctx-fetcher", "sync context fragments")
      assert String.starts_with?(block, "Relevant code context:\n")
      assert String.contains?(block, "def sync_context(project_slug)")
    end
  end

  describe "ContextIndexer.reindex_project/1" do
    test "indexes signatures from linked project source files" do
      root_dir = Path.join(System.tmp_dir!(), "ema-context-indexer-#{System.unique_integer([:positive])}")
      File.mkdir_p!(Path.join(root_dir, "lib"))

      source_path = Path.join(root_dir, "lib/sample.ex")

      File.write!(source_path, """
      defmodule Sample.Module do
        def visible(arg), do: arg
        defp hidden(), do: :ok
      end
      """)

      on_exit(fn -> File.rm_rf!(root_dir) end)

      {:ok, project} =
        Ema.Projects.create_project(%{
          slug: "indexed-project",
          name: "Indexed Project",
          linked_path: root_dir
        })

      assert {:ok, fragments} = ContextIndexer.reindex_project(project)
      assert length(fragments) == 1

      [fragment] = ContextStore.list_fragments(project.slug)
      assert fragment.file_path == "lib/sample.ex"
      assert String.contains?(fragment.content, "defmodule Sample.Module")
      assert String.contains?(fragment.content, "def visible(arg)")
    end
  end
end
