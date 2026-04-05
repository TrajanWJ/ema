defmodule Ema.Vectors.Embedder do
  @moduledoc """
  GenServer that watches project linked_paths, chunks source files
  (AST-aware for .ex/.ts/.tsx, semantic for .md), and calls the
  embedding API to produce vector representations.

  Maintains an in-memory cache of path -> embedding mappings and
  persists them to the vector index.
  """

  use GenServer

  require Logger

  @chunk_max_tokens 512
  @scan_interval :timer.minutes(15)

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Embed a single text string and return the vector."
  def embed_text(text) do
    GenServer.call(__MODULE__, {:embed_text, text}, 30_000)
  end

  @doc "Embed a proposal's combined text (title + summary + body)."
  def embed_proposal(proposal) do
    text = build_proposal_text(proposal)
    embed_text(text)
  end

  @doc """
  Embed a brain dump item asynchronously.
  Persists the vector on the item record and updates embedding_status.
  Meant to be called from Task.Supervisor — does not block the caller.
  """
  def embed_brain_dump_item(%{id: item_id, content: content}) do
    case embed_text(content) do
      {:ok, vector} ->
        binary = Ema.Vectors.Index.serialize_embedding(vector)

        Ema.BrainDump.Item
        |> Ema.Repo.get(item_id)
        |> case do
          nil ->
            Logger.warning("[Embedder] brain dump item #{item_id} vanished before embedding")
            :error

          item ->
            item
            |> Ecto.Changeset.change(%{
              embedding: binary,
              embedding_version: "v1",
              embedding_status: "ready"
            })
            |> Ema.Repo.update()
            |> case do
              {:ok, updated} ->
                # Also insert into the in-memory vector index
                Ema.Vectors.Index.upsert(%{
                  brain_dump_item_id: updated.id,
                  kind: :brain_dump,
                  text: content,
                  embedding: vector
                })

                {:ok, updated}

              {:error, reason} ->
                Logger.warning("[Embedder] failed to persist embedding for item #{item_id}: #{inspect(reason)}")
                :error
            end
        end

      {:error, reason} ->
        Logger.warning("[Embedder] embedding failed for brain dump item #{item_id}: #{inspect(reason)}")

        Ema.BrainDump.Item
        |> Ema.Repo.get(item_id)
        |> case do
          nil -> :ok
          item ->
            item
            |> Ecto.Changeset.change(%{embedding_status: "failed"})
            |> Ema.Repo.update()
        end

        :error
    end
  end

  @doc "Trigger a scan of project linked_paths."
  def scan_project(project_id) do
    GenServer.cast(__MODULE__, {:scan_project, project_id})
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    schedule_scan()
    {:ok, %{embedded_paths: %{}, total_embedded: 0}}
  end

  @impl true
  def handle_call({:embed_text, text}, _from, state) do
    case call_embedding_api(text) do
      {:ok, vector} ->
        {:reply, {:ok, vector}, state}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  @impl true
  def handle_cast({:scan_project, project_id}, state) do
    Task.Supervisor.start_child(Ema.ProposalEngine.TaskSupervisor, fn ->
      do_scan_project(project_id)
    end)

    {:noreply, state}
  end

  @impl true
  def handle_info(:periodic_scan, state) do
    scan_all_projects()
    schedule_scan()
    {:noreply, state}
  end

  @impl true
  def handle_info({:file_embedded, path, _vector}, state) do
    count = state.total_embedded + 1
    paths = Map.put(state.embedded_paths, path, DateTime.utc_now())
    {:noreply, %{state | embedded_paths: paths, total_embedded: count}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Chunking ---

  @doc false
  def chunk_file(path) do
    content = File.read!(path)
    ext = Path.extname(path)

    chunks =
      case ext do
        ext when ext in [".ex", ".exs"] -> chunk_elixir(content, path)
        ext when ext in [".ts", ".tsx"] -> chunk_typescript(content, path)
        ".md" -> chunk_markdown(content, path)
        _ -> chunk_by_lines(content, path)
      end

    Enum.reject(chunks, &(String.trim(&1.text) == ""))
  end

  defp chunk_elixir(content, path) do
    # Split on module/function boundaries
    chunks =
      content
      |> String.split(~r/\n(?=\s*(?:defmodule|def |defp |defmacro ))/, trim: true)
      |> Enum.with_index()
      |> Enum.map(fn {text, idx} ->
        %{text: text, path: path, chunk_index: idx, kind: :elixir_ast}
      end)

    split_oversized(chunks)
  end

  defp chunk_typescript(content, path) do
    # Split on export/function/class/interface boundaries
    chunks =
      content
      |> String.split(
        ~r/\n(?=(?:export |function |class |interface |type |const ))/,
        trim: true
      )
      |> Enum.with_index()
      |> Enum.map(fn {text, idx} ->
        %{text: text, path: path, chunk_index: idx, kind: :ts_ast}
      end)

    split_oversized(chunks)
  end

  defp chunk_markdown(content, path) do
    # Split on headings
    chunks =
      content
      |> String.split(~r/\n(?=\#{1,3}\s)/, trim: true)
      |> Enum.with_index()
      |> Enum.map(fn {text, idx} ->
        %{text: text, path: path, chunk_index: idx, kind: :markdown}
      end)

    split_oversized(chunks)
  end

  defp chunk_by_lines(content, path) do
    content
    |> String.split("\n")
    |> Enum.chunk_every(40)
    |> Enum.with_index()
    |> Enum.map(fn {lines, idx} ->
      %{text: Enum.join(lines, "\n"), path: path, chunk_index: idx, kind: :lines}
    end)
  end

  defp split_oversized(chunks) do
    Enum.flat_map(chunks, fn chunk ->
      if estimated_tokens(chunk.text) > @chunk_max_tokens do
        chunk.text
        |> String.split("\n")
        |> Enum.chunk_every(30)
        |> Enum.with_index()
        |> Enum.map(fn {lines, sub_idx} ->
          %{chunk | text: Enum.join(lines, "\n"), chunk_index: {chunk.chunk_index, sub_idx}}
        end)
      else
        [chunk]
      end
    end)
  end

  defp estimated_tokens(text), do: div(String.length(text), 4)

  # --- Scanning ---

  defp scan_all_projects do
    Ema.Projects.list_projects()
    |> Enum.each(fn project ->
      Task.Supervisor.start_child(Ema.ProposalEngine.TaskSupervisor, fn ->
        do_scan_project(project.id)
      end)
    end)
  end

  defp do_scan_project(project_id) do
    case Ema.Projects.get_project(project_id) do
      nil ->
        Logger.warning("Embedder: project #{project_id} not found")

      project ->
        paths = project.linked_paths || []
        embed_paths(paths, project_id)
    end
  end

  defp embed_paths(paths, project_id) do
    paths
    |> Enum.flat_map(&expand_path/1)
    |> Enum.flat_map(&chunk_file/1)
    |> Enum.each(fn chunk ->
      case call_embedding_api(chunk.text) do
        {:ok, vector} ->
          Ema.Vectors.Index.upsert(%{
            path: chunk.path,
            chunk_index: chunk.chunk_index,
            text: chunk.text,
            kind: chunk.kind,
            embedding: vector,
            project_id: project_id
          })

          send(self(), {:file_embedded, chunk.path, vector})

        {:error, reason} ->
          Logger.warning("Embedder: failed to embed chunk from #{chunk.path}: #{inspect(reason)}")
      end
    end)
  end

  defp expand_path(path) do
    cond do
      File.regular?(path) ->
        [path]

      File.dir?(path) ->
        Path.wildcard(Path.join(path, "**/*.{ex,exs,ts,tsx,md}"))

      true ->
        Path.wildcard(path)
    end
  end

  # --- Embedding API ---

  defp call_embedding_api(text) do
    provider = Application.get_env(:ema, :embedding_provider, :local)

    case provider do
      :local -> local_embedding(text)
      :openai -> openai_embedding(text)
      _ -> local_embedding(text)
    end
  end

  defp local_embedding(text) do
    # Deterministic hash-based embedding for development/offline use.
    # Produces a 384-dim vector from content hashing. Not semantically
    # meaningful but preserves exact-match similarity.
    hash = :crypto.hash(:sha256, text)

    # Expand 32 bytes to 384 dims via repeated hashing
    vector =
      0..11
      |> Enum.flat_map(fn i ->
        seed = :crypto.hash(:sha256, <<i::8, hash::binary>>)
        seed |> :binary.bin_to_list() |> Enum.map(&((&1 - 128) / 128.0))
      end)

    {:ok, vector}
  end

  defp openai_embedding(text) do
    api_key = Application.get_env(:ema, :openai_api_key)
    url = "https://api.openai.com/v1/embeddings"

    body =
      Jason.encode!(%{
        model: "text-embedding-3-small",
        input: String.slice(text, 0, 8000)
      })

    headers = [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"}
    ]

    case :httpc.request(:post, {String.to_charlist(url), headers, ~c"application/json", body}, [], []) do
      {:ok, {{_, 200, _}, _headers, resp_body}} ->
        case Jason.decode(List.to_string(resp_body)) do
          {:ok, %{"data" => [%{"embedding" => vector} | _]}} ->
            {:ok, vector}

          _ ->
            {:error, :invalid_response}
        end

      {:ok, {{_, status, _}, _, _}} ->
        {:error, {:api_error, status}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp build_proposal_text(proposal) do
    [proposal.title, proposal.summary, proposal.body]
    |> Enum.reject(&is_nil/1)
    |> Enum.join("\n\n")
  end

  defp schedule_scan do
    Process.send_after(self(), :periodic_scan, @scan_interval)
  end
end
