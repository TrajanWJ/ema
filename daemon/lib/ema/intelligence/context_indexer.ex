defmodule Ema.Intelligence.ContextIndexer do
  @moduledoc """
  Indexes lightweight code signatures from linked project paths into Postgres.
  """

  use GenServer

  require Logger

  alias Ema.Intelligence.ContextStore

  @extensions ~w(.ex .js .ts .tsx)
  @max_lines 200

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def reindex_project(project) do
    case Process.whereis(__MODULE__) do
      nil -> index_project(project)
      _pid -> GenServer.call(__MODULE__, {:reindex_project, project}, :infinity)
    end
  end

  @impl true
  def init(_opts) do
    send(self(), :initial_index)
    {:ok, %{}}
  end

  @impl true
  def handle_call({:reindex_project, project}, _from, state) do
    {:reply, index_project(project), state}
  end

  @impl true
  def handle_info(:initial_index, state) do
    Ema.Projects.list_projects()
    |> Enum.each(fn project ->
      _ = index_project(project)
    end)

    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp index_project(%Ema.Projects.Project{slug: slug, linked_path: linked_path})
       when is_binary(linked_path) do
    if File.dir?(linked_path) do
      fragments =
        linked_path
        |> collect_source_files()
        |> Enum.map(&build_fragment(linked_path, &1))
        |> Enum.reject(&is_nil/1)

      ContextStore.replace_project_code_fragments(slug, fragments)
    else
      Logger.debug("ContextIndexer: skipping #{slug}, linked_path is not a directory")
      {:ok, []}
    end
  rescue
    error ->
      Logger.warning("ContextIndexer: failed to index #{slug}: #{Exception.message(error)}")
      {:error, error}
  end

  defp index_project(_project), do: {:ok, []}

  defp collect_source_files(linked_path) do
    linked_path
    |> Path.join("**/*")
    |> Path.wildcard(match_dot: false)
    |> Enum.filter(&File.regular?/1)
    |> Enum.filter(fn path -> Path.extname(path) in @extensions end)
  end

  defp build_fragment(root_path, file_path) do
    file_path
    |> read_head()
    |> extract_signatures(file_path)
    |> case do
      [] ->
        nil

      signatures ->
        %{
          content: Enum.join(signatures, "\n"),
          file_path: Path.relative_to(file_path, root_path),
          relevance_score: relevance_score(signatures)
        }
    end
  end

  defp read_head(file_path) do
    file_path
    |> File.stream!([], :line)
    |> Enum.take(@max_lines)
    |> Enum.join("")
  rescue
    _ -> ""
  end

  defp extract_signatures(content, file_path) do
    case Path.extname(file_path) do
      ".ex" -> extract_elixir_signatures(content)
      _ -> extract_js_signatures(content)
    end
  end

  defp extract_elixir_signatures(content) do
    Regex.scan(~r/^\s*(defmodule\s+\S+|defp?\s+[a-zA-Z0-9_!?]+\s*(?:\([^)]*\))?|defmacro\s+\S+)/m, content)
    |> Enum.map(fn [signature] -> String.trim(signature) end)
    |> Enum.uniq()
  end

  defp extract_js_signatures(content) do
    Regex.scan(
      ~r/^\s*(?:export\s+)?(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*\([^)]*\)|^\s*(?:export\s+)?(?:const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|^\s*class\s+[A-Za-z0-9_$]+/m,
      content
    )
    |> Enum.map(fn [signature] -> String.trim(signature) end)
    |> Enum.uniq()
  end

  defp relevance_score(signatures) do
    signatures
    |> length()
    |> Kernel./(20)
    |> Kernel.+(0.2)
    |> min(1.0)
    |> Float.round(3)
  end
end
