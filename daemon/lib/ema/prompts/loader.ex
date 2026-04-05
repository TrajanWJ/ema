defmodule Ema.Prompts.Loader do
  @moduledoc """
  Hot-reload capable prompt loader backed by an ETS cache.

  Architecture:
    - ETS table `:prompts_cache` holds {kind, prompt} pairs
    - On start, loads all latest prompts from DB into cache
    - `reload/0` / `reload_kind/1` refresh from DB on demand
    - Daemon (or any process) calls `get/1` for zero-DB-hit reads
    - Hot-reload: any code path that saves/updates a prompt should call
      `Ema.Prompts.Loader.reload_kind(kind)` to invalidate the cache entry

  Usage:
    Ema.Prompts.Loader.get("proposal_generator")
    Ema.Prompts.Loader.get("proposal_generator", execution_id: "exec_123")
    Ema.Prompts.Loader.reload_kind("proposal_generator")
    Ema.Prompts.Loader.reload()
  """

  use GenServer
  require Logger

  alias Ema.Prompts.Store
  alias Ema.Prompts.Prompt

  @table :prompts_cache
  @poll_interval 5_000
  @prompts_dir "priv/prompts"

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Returns the routed prompt for `kind`.

  If an active A/B test exists, routing is delegated to `Ema.Prompts.ABRouter`.
  """
  def get(kind, opts \\ []) do
    case Ema.Prompts.ABRouter.route(kind, opts) do
      {:ok, prompt, _selection} ->
        {:ok, prompt}

      {:error, :not_found} ->
        get_cached(kind)
    end
  end

  def get_with_selection(kind, opts \\ []) do
    Ema.Prompts.ABRouter.route(kind, opts)
  end

  defp get_cached(kind) do
    case :ets.lookup(@table, kind) do
      [{^kind, prompt}] -> {:ok, prompt}
      []                -> fetch_and_cache(kind)
    end
  end

  @doc "Reload all prompts from DB into the ETS cache."
  def reload do
    GenServer.cast(__MODULE__, :reload_all)
  end

  @doc "Reload a single kind from DB into the ETS cache."
  def reload_kind(kind) do
    GenServer.cast(__MODULE__, {:reload_kind, kind})
  end

  @doc "Dump the entire cache — for debugging."
  def dump_cache do
    :ets.tab2list(@table)
  end

  # ---------------------------------------------------------------------------
  # GenServer callbacks
  # ---------------------------------------------------------------------------

  @impl true
  def init(_opts) do
    table = :ets.new(@table, [:named_table, :set, :public, read_concurrency: true])
    load_all_into_cache()
    schedule_file_poll()
    Logger.info("[Prompts.Loader] started — #{:ets.info(table, :size)} prompts cached")
    {:ok, %{table: table, file_mtimes: scan_prompt_files()}}
  end

  @impl true
  def handle_cast(:reload_all, state) do
    load_all_into_cache()
    Logger.info("[Prompts.Loader] full reload done — #{:ets.info(@table, :size)} entries")
    {:noreply, state}
  end

  @impl true
  def handle_cast({:reload_kind, kind}, state) do
    case Store.latest_for_kind(kind) do
      nil    -> :ets.delete(@table, kind)
      prompt -> :ets.insert(@table, {kind, prompt})
    end

    {:noreply, state}
  end

  @impl true
  def handle_info(:poll_files, state) do
    new_mtimes = scan_prompt_files()
    changed = detect_changed_files(state.file_mtimes, new_mtimes)

    Enum.each(changed, fn path ->
      case upsert_from_file(path) do
        {:ok, prompt} ->
          Logger.info("[Prompts.Loader] hot-reloaded #{prompt.kind} v#{prompt.version} from #{Path.basename(path)}")

        {:error, reason} ->
          Logger.warning("[Prompts.Loader] failed to load #{path}: #{inspect(reason)}")
      end
    end)

    schedule_file_poll()
    {:noreply, %{state | file_mtimes: new_mtimes}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp load_all_into_cache do
    prompts = Store.list_latest_per_kind()
    :ets.delete_all_objects(@table)

    Enum.each(prompts, fn %Prompt{kind: kind} = p ->
      :ets.insert(@table, {kind, p})
    end)
  end

  defp fetch_and_cache(kind) do
    case Store.latest_for_kind(kind) do
      nil ->
        {:error, :not_found}

      prompt ->
        :ets.insert(@table, {kind, prompt})
        {:ok, prompt}
    end
  end

  # ---------------------------------------------------------------------------
  # File watcher helpers
  # ---------------------------------------------------------------------------

  defp schedule_file_poll do
    Process.send_after(self(), :poll_files, @poll_interval)
  end

  defp prompts_dir do
    Application.app_dir(:ema, @prompts_dir)
  end

  defp scan_prompt_files do
    dir = prompts_dir()

    if File.dir?(dir) do
      dir
      |> File.ls!()
      |> Enum.filter(&String.ends_with?(&1, ".md"))
      |> Map.new(fn filename ->
        path = Path.join(dir, filename)
        {path, File.stat!(path).mtime}
      end)
    else
      %{}
    end
  end

  defp detect_changed_files(old_mtimes, new_mtimes) do
    Enum.reduce(new_mtimes, [], fn {path, mtime}, acc ->
      if Map.get(old_mtimes, path) != mtime do
        [path | acc]
      else
        acc
      end
    end)
  end

  @doc false
  def upsert_from_file(path) do
    kind = path |> Path.basename(".md") |> String.replace("-", "_")
    content = File.read!(path)

    case Store.latest_for_kind(kind) do
      nil ->
        Store.create_prompt(%{kind: kind, content: content})

      existing ->
        if existing.content != content do
          Store.create_new_version(kind, content)
        else
          {:ok, existing}
        end
    end
  end
end
