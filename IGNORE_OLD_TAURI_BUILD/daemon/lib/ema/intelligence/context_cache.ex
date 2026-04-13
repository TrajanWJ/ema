defmodule Ema.Intelligence.ContextCache do
  @moduledoc """
  ETS-backed cache for compressed context representations.

  Used by the relevance pipeline to avoid re-fetching + re-scoring the same
  pool of tasks/proposals/wiki pages on every prompt build. Entries are keyed
  by `{entity_type, entity_id, version}` and carry both the compressed value
  and an `inserted_at` for TTL eviction.

  Invalidation:
    - Manual:    `invalidate(entity_type, entity_id)` removes any version
    - Versioned: callers may bump the version when source data changes
    - PubSub:    callers can subscribe to topics like `"context_cache:invalidate"`
                 and call `invalidate/2` from their own handlers
    - TTL:       entries older than `@default_ttl_ms` are evicted on read

  This is intentionally a thin wrapper. The cache is not write-through,
  not distributed, and not persisted across restarts.
  """

  use GenServer

  @table __MODULE__
  @default_ttl_ms 5 * 60 * 1_000
  @sweep_interval 60_000

  # ── Public API ─────────────────────────────────────────────────────────────

  def start_link(_opts \\ []) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @doc """
  Fetch a cached value or run `fun` and store the result.

  Always returns the value (cached or freshly computed). Falls back to
  running `fun` directly when the ETS table is unavailable (e.g. tests
  that don't start the cache).
  """
  def fetch(entity_type, entity_id, version \\ 1, fun) when is_function(fun, 0) do
    key = {entity_type, entity_id, version}

    case lookup(key) do
      {:ok, value} ->
        value

      :miss ->
        value = fun.()
        put(key, value)
        value
    end
  end

  @doc "Invalidate every cached version for an entity."
  def invalidate(entity_type, entity_id) do
    if table?() do
      :ets.match_delete(@table, {{entity_type, entity_id, :_}, :_, :_})
    end

    :ok
  end

  @doc "Drop all cached values."
  def clear do
    if table?(), do: :ets.delete_all_objects(@table)
    :ok
  end

  @doc "Return cache statistics for debugging."
  def stats do
    if table?() do
      %{
        size: :ets.info(@table, :size),
        memory_words: :ets.info(@table, :memory)
      }
    else
      %{size: 0, memory_words: 0, status: :not_started}
    end
  end

  # ── GenServer ──────────────────────────────────────────────────────────────

  @impl true
  def init(_) do
    :ets.new(@table, [:set, :public, :named_table, read_concurrency: true])
    schedule_sweep()
    {:ok, %{}}
  end

  @impl true
  def handle_info(:sweep, state) do
    sweep_expired()
    schedule_sweep()
    {:noreply, state}
  end

  def handle_info(_, state), do: {:noreply, state}

  # ── Private ────────────────────────────────────────────────────────────────

  defp lookup(key) do
    if table?() do
      case :ets.lookup(@table, key) do
        [{^key, value, inserted_at}] ->
          if fresh?(inserted_at) do
            {:ok, value}
          else
            :ets.delete(@table, key)
            :miss
          end

        _ ->
          :miss
      end
    else
      :miss
    end
  end

  defp put(key, value) do
    if table?() do
      :ets.insert(@table, {key, value, System.monotonic_time(:millisecond)})
    end

    :ok
  end

  defp fresh?(inserted_at) do
    System.monotonic_time(:millisecond) - inserted_at < @default_ttl_ms
  end

  defp sweep_expired do
    if table?() do
      now = System.monotonic_time(:millisecond)

      :ets.foldl(
        fn {key, _value, inserted_at}, acc ->
          if now - inserted_at >= @default_ttl_ms, do: :ets.delete(@table, key)
          acc
        end,
        :ok,
        @table
      )
    end
  end

  defp schedule_sweep do
    Process.send_after(self(), :sweep, @sweep_interval)
  end

  defp table? do
    :ets.whereis(@table) != :undefined
  end
end
