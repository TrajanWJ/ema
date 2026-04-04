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
    Ema.Prompts.Loader.reload_kind("proposal_generator")
    Ema.Prompts.Loader.reload()
  """

  use GenServer
  require Logger

  alias Ema.Prompts.Store
  alias Ema.Prompts.Prompt

  @table :prompts_cache

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Returns the latest active prompt for `kind` from the ETS cache.
  Falls back to DB if not found in cache.
  """
  def get(kind) do
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
    Logger.info("[Prompts.Loader] started — #{:ets.info(table, :size)} prompts cached")
    {:ok, %{table: table}}
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
end
