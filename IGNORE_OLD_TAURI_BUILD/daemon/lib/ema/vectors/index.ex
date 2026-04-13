defmodule Ema.Vectors.Index do
  @moduledoc """
  In-memory vector store backed by SQLite persistence.
  Manages embeddings for code chunks and proposals, provides
  similarity search and nearest-neighbor queries using cosine similarity.

  Since SQLite doesn't support pgvector, embeddings are stored as binary
  blobs and similarity is computed in Elixir.
  """

  use GenServer

  require Logger

  @table :vector_index

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Insert or update a vector entry in the index."
  def upsert(entry) do
    GenServer.cast(__MODULE__, {:upsert, entry})
  end

  @doc """
  Find the k nearest neighbors to a query vector.
  Returns [{entry, similarity}] sorted by descending similarity.
  """
  def nearest(query_vector, opts \\ []) do
    GenServer.call(__MODULE__, {:nearest, query_vector, opts}, 15_000)
  end

  @doc """
  Find entries with cosine similarity above a threshold.
  Returns [{entry, similarity}] sorted by descending similarity.
  """
  def similar_above(query_vector, threshold, opts \\ []) do
    GenServer.call(__MODULE__, {:similar_above, query_vector, threshold, opts}, 15_000)
  end

  @doc "Return all entries for a given project."
  def entries_for_project(project_id) do
    GenServer.call(__MODULE__, {:project_entries, project_id})
  end

  @doc "Return stats about the index."
  def stats do
    GenServer.call(__MODULE__, :stats)
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    :ets.new(@table, [:set, :named_table, :public, read_concurrency: true])
    count = load_from_db()
    Logger.info("Vectors.Index: loaded #{count} entries from database")
    {:ok, %{count: count}}
  end

  @impl true
  def handle_cast({:upsert, entry}, state) do
    key = build_key(entry)
    record = Map.put(entry, :key, key)
    :ets.insert(@table, {key, record})
    {:noreply, %{state | count: :ets.info(@table, :size)}}
  end

  @impl true
  def handle_call({:nearest, query_vector, opts}, _from, state) do
    k = Keyword.get(opts, :k, 10)
    project_id = Keyword.get(opts, :project_id)

    results =
      all_entries(project_id)
      |> Enum.map(fn entry -> {entry, cosine_similarity(query_vector, entry.embedding)} end)
      |> Enum.sort_by(fn {_entry, sim} -> sim end, :desc)
      |> Enum.take(k)

    {:reply, results, state}
  end

  @impl true
  def handle_call({:similar_above, query_vector, threshold, opts}, _from, state) do
    project_id = Keyword.get(opts, :project_id)

    results =
      all_entries(project_id)
      |> Enum.map(fn entry -> {entry, cosine_similarity(query_vector, entry.embedding)} end)
      |> Enum.filter(fn {_entry, sim} -> sim > threshold end)
      |> Enum.sort_by(fn {_entry, sim} -> sim end, :desc)

    {:reply, results, state}
  end

  @impl true
  def handle_call({:project_entries, project_id}, _from, state) do
    entries = all_entries(project_id)
    {:reply, entries, state}
  end

  @impl true
  def handle_call(:stats, _from, state) do
    projects =
      :ets.tab2list(@table)
      |> Enum.map(fn {_key, entry} -> entry[:project_id] end)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()
      |> length()

    {:reply, %{total_entries: state.count, projects_indexed: projects}, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Math ---

  @doc "Compute cosine similarity between two vectors."
  def cosine_similarity(a, b) when is_list(a) and is_list(b) do
    dot = dot_product(a, b)
    mag_a = magnitude(a)
    mag_b = magnitude(b)

    if mag_a == 0.0 or mag_b == 0.0 do
      0.0
    else
      dot / (mag_a * mag_b)
    end
  end

  def cosine_similarity(_, _), do: 0.0

  defp dot_product(a, b) do
    a
    |> Enum.zip(b)
    |> Enum.reduce(0.0, fn {x, y}, acc -> acc + x * y end)
  end

  defp magnitude(v) do
    v
    |> Enum.reduce(0.0, fn x, acc -> acc + x * x end)
    |> :math.sqrt()
  end

  # --- Persistence ---

  defp load_from_db do
    import Ecto.Query

    # Load proposal embeddings
    proposals =
      Ema.Proposals.Proposal
      |> where([p], not is_nil(p.embedding))
      |> Ema.Repo.all()

    Enum.each(proposals, fn proposal ->
      case deserialize_embedding(proposal.embedding) do
        {:ok, vector} ->
          entry = %{
            key: "proposal:#{proposal.id}",
            kind: :proposal,
            text: "#{proposal.title}\n#{proposal.summary}",
            embedding: vector,
            project_id: proposal.project_id,
            proposal_id: proposal.id
          }

          :ets.insert(@table, {entry.key, entry})

        :error ->
          :ok
      end
    end)

    # Load brain dump item embeddings
    brain_dump_items =
      Ema.BrainDump.Item
      |> where([i], i.embedding_status == "ready" and not is_nil(i.embedding))
      |> Ema.Repo.all()

    Enum.each(brain_dump_items, fn item ->
      case deserialize_embedding(item.embedding) do
        {:ok, vector} ->
          entry = %{
            key: "brain_dump:#{item.id}",
            kind: :brain_dump,
            text: item.content,
            embedding: vector,
            brain_dump_item_id: item.id
          }

          :ets.insert(@table, {entry.key, entry})

        :error ->
          :ok
      end
    end)

    :ets.info(@table, :size)
  end

  defp all_entries(nil) do
    :ets.tab2list(@table) |> Enum.map(fn {_key, entry} -> entry end)
  end

  defp all_entries(project_id) do
    :ets.tab2list(@table)
    |> Enum.map(fn {_key, entry} -> entry end)
    |> Enum.filter(fn entry -> entry[:project_id] == project_id end)
  end

  defp build_key(%{brain_dump_item_id: id}) when is_binary(id), do: "brain_dump:#{id}"
  defp build_key(%{proposal_id: id}) when is_binary(id), do: "proposal:#{id}"
  defp build_key(%{path: path, chunk_index: idx}), do: "chunk:#{path}:#{inspect(idx)}"
  defp build_key(%{key: key}), do: key
  defp build_key(_), do: "unknown:#{System.unique_integer([:positive])}"

  # --- Serialization ---

  @doc "Serialize a vector (list of floats) to binary for SQLite storage."
  def serialize_embedding(vector) when is_list(vector) do
    vector
    |> Enum.map(&<<&1::float-64>>)
    |> IO.iodata_to_binary()
  end

  def serialize_embedding(nil), do: nil

  @doc "Deserialize binary back to a list of floats."
  def deserialize_embedding(binary) when is_binary(binary) and byte_size(binary) > 0 do
    count = div(byte_size(binary), 8)

    vector =
      for i <- 0..(count - 1) do
        <<_::binary-size(i * 8), val::float-64, _::binary>> = binary
        val
      end

    {:ok, vector}
  end

  def deserialize_embedding(_), do: :error
end
