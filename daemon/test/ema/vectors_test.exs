defmodule Ema.Vectors.IndexTest do
  use Ema.DataCase, async: false
  alias Ema.Vectors.Index

  # The Index is a GenServer that uses ETS. Start it for tests.
  setup do
    case GenServer.whereis(Ema.Vectors.Index) do
      nil -> start_supervised!(Ema.Vectors.Index)
      _pid -> :ok
    end

    :ok
  end

  # --- Helpers ---

  defp sample_vector(seed) do
    # Produce a deterministic 8-dim vector for testing
    for i <- 1..8 do
      :math.sin(seed * i) |> Float.round(6)
    end
  end

  defp insert_entry(opts \\ []) do
    id = Keyword.get(opts, :id, "test_#{System.unique_integer([:positive])}")
    project_id = Keyword.get(opts, :project_id, "proj_1")
    seed = Keyword.get(opts, :seed, :rand.uniform(100))

    entry = %{
      proposal_id: id,
      kind: :proposal,
      text: "Entry #{id}",
      embedding: sample_vector(seed),
      project_id: project_id
    }

    Index.upsert(entry)
    # Give the async cast time to process
    :timer.sleep(10)
    entry
  end

  # Clean up ETS between tests by removing our test entries
  setup do
    # The :vector_index ETS table is shared. We'll work with unique IDs
    # and filter by project_id to avoid interference.
    :ok
  end

  # --- Cosine Similarity (pure function, no GenServer needed) ---

  describe "cosine_similarity/2" do
    test "identical vectors have similarity 1.0" do
      v = [1.0, 0.0, 0.0]
      assert_in_delta Index.cosine_similarity(v, v), 1.0, 0.0001
    end

    test "orthogonal vectors have similarity 0.0" do
      a = [1.0, 0.0, 0.0]
      b = [0.0, 1.0, 0.0]
      assert_in_delta Index.cosine_similarity(a, b), 0.0, 0.0001
    end

    test "opposite vectors have similarity -1.0" do
      a = [1.0, 0.0]
      b = [-1.0, 0.0]
      assert_in_delta Index.cosine_similarity(a, b), -1.0, 0.0001
    end

    test "zero vector returns 0.0" do
      a = [0.0, 0.0, 0.0]
      b = [1.0, 2.0, 3.0]
      assert Index.cosine_similarity(a, b) == 0.0
    end

    test "non-list inputs return 0.0" do
      assert Index.cosine_similarity(nil, nil) == 0.0
    end
  end

  # --- Serialization ---

  describe "serialize_embedding/1 and deserialize_embedding/1" do
    test "round-trips a vector" do
      original = [1.0, -0.5, 0.333, 42.0]
      binary = Index.serialize_embedding(original)
      assert is_binary(binary)
      assert byte_size(binary) == 4 * 8

      assert {:ok, restored} = Index.deserialize_embedding(binary)
      assert length(restored) == length(original)

      Enum.zip(original, restored)
      |> Enum.each(fn {orig, rest} ->
        assert_in_delta orig, rest, 0.0001
      end)
    end

    test "serialize nil returns nil" do
      assert Index.serialize_embedding(nil) == nil
    end

    test "deserialize nil returns :error" do
      assert Index.deserialize_embedding(nil) == :error
    end

    test "deserialize empty binary returns :error" do
      assert Index.deserialize_embedding(<<>>) == :error
    end
  end

  # --- GenServer operations ---

  describe "upsert + nearest/2" do
    test "inserts entries and finds nearest neighbors" do
      project = "proj_nearest_#{System.unique_integer([:positive])}"

      # Insert three entries with known vectors
      base = sample_vector(1.0)
      similar = sample_vector(1.1)
      distant = sample_vector(50.0)

      Index.upsert(%{
        proposal_id: "near_a",
        kind: :proposal,
        text: "Base",
        embedding: base,
        project_id: project
      })

      Index.upsert(%{
        proposal_id: "near_b",
        kind: :proposal,
        text: "Similar",
        embedding: similar,
        project_id: project
      })

      Index.upsert(%{
        proposal_id: "near_c",
        kind: :proposal,
        text: "Distant",
        embedding: distant,
        project_id: project
      })

      :timer.sleep(20)

      results = Index.nearest(base, k: 2, project_id: project)
      assert length(results) == 2

      # The first result should be the base itself (similarity ~1.0)
      [{first_entry, first_sim} | _] = results
      assert first_entry.text == "Base"
      assert_in_delta first_sim, 1.0, 0.0001
    end
  end

  describe "similar_above/3" do
    test "returns only entries above threshold" do
      project = "proj_above_#{System.unique_integer([:positive])}"
      query = [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

      # Very similar to query
      Index.upsert(%{
        proposal_id: "above_a",
        kind: :proposal,
        text: "Aligned",
        embedding: [0.9, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        project_id: project
      })

      # Orthogonal to query
      Index.upsert(%{
        proposal_id: "above_b",
        kind: :proposal,
        text: "Orthogonal",
        embedding: [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        project_id: project
      })

      :timer.sleep(20)

      results = Index.similar_above(query, 0.5, project_id: project)
      assert length(results) == 1
      [{entry, sim}] = results
      assert entry.text == "Aligned"
      assert sim > 0.5
    end
  end

  describe "stats/0" do
    test "returns total_entries and projects_indexed" do
      stats = Index.stats()
      assert is_integer(stats.total_entries)
      assert is_integer(stats.projects_indexed)
    end
  end
end
