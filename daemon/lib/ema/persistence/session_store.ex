defmodule Ema.Persistence.SessionStore do
  @moduledoc """
  Persistent session store backed by ETS (fast reads) and SQLite (durability).
  Stores DCC primitives for session continuity across restarts.

  ## Architecture

  - ETS table `:ema_session_store` provides sub-microsecond reads
  - Dirty tracking batches SQLite writes every 30s
  - On init, all DCC records are loaded from SQLite into ETS
  - PubSub broadcasts on `"context:sessions"` for crystallization events

  """

  use GenServer
  require Logger

  alias Ema.Core.DccPrimitive
  alias Ema.Persistence.DccRecord
  alias Ema.Repo

  import Ecto.Query

  @table :ema_session_store
  @persist_interval :timer.seconds(30)

  # Client API

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Store a DCC primitive."
  def store(session_id, %DccPrimitive{} = dcc) do
    GenServer.call(__MODULE__, {:store, session_id, dcc})
  end

  @doc "Fetch a DCC by session_id. Reads directly from ETS (no GenServer call)."
  def fetch(session_id) do
    case :ets.lookup(@table, session_id) do
      [{^session_id, dcc}] -> {:ok, dcc}
      [] -> :error
    end
  end

  @doc "List most recent sessions, sorted by crystallized_at desc."
  def list_recent(limit \\ 10) do
    GenServer.call(__MODULE__, {:list_recent, limit})
  end

  @doc "Crystallize a session (mark as finalized with timestamp)."
  def crystallize(session_id) do
    GenServer.call(__MODULE__, {:crystallize, session_id})
  end

  @doc "Delete a session from both ETS and SQLite."
  def delete(session_id) do
    GenServer.call(__MODULE__, {:delete, session_id})
  end

  @doc "Get the current active session DCC."
  def current_session do
    GenServer.call(__MODULE__, :current_session)
  end

  @doc "Set the current active session by ID."
  def set_current(session_id) do
    GenServer.call(__MODULE__, {:set_current, session_id})
  end

  @doc "Force an immediate persist of dirty records. Useful in tests."
  def flush do
    GenServer.call(__MODULE__, :flush)
  end

  @doc "Return the count of sessions in the ETS table."
  def count do
    :ets.info(@table, :size)
  end

  # Server

  @impl true
  def init(_opts) do
    table = :ets.new(@table, [:named_table, :set, :public, read_concurrency: true])
    loaded = load_from_db()
    schedule_persist()
    {:ok, %{table: table, current_session_id: nil, dirty: MapSet.new(), loaded: loaded}}
  end

  @impl true
  def handle_call({:store, session_id, dcc}, _from, state) do
    dcc = %{dcc | session_id: session_id}
    :ets.insert(@table, {session_id, dcc})
    {:reply, :ok, %{state | dirty: MapSet.put(state.dirty, session_id)}}
  end

  @impl true
  def handle_call({:list_recent, limit}, _from, state) do
    sessions =
      :ets.tab2list(@table)
      |> Enum.map(fn {_id, dcc} -> dcc end)
      |> Enum.sort_by(& &1.crystallized_at, {:desc, DateTime})
      |> Enum.take(limit)

    {:reply, sessions, state}
  end

  @impl true
  def handle_call({:crystallize, session_id}, _from, state) do
    case :ets.lookup(@table, session_id) do
      [{^session_id, dcc}] ->
        crystallized = DccPrimitive.crystallize(dcc)
        :ets.insert(@table, {session_id, crystallized})

        Phoenix.PubSub.broadcast(
          Ema.PubSub,
          "context:sessions",
          {:session_crystallized, crystallized}
        )

        {:reply, {:ok, crystallized},
         %{state | dirty: MapSet.put(state.dirty, session_id)}}

      [] ->
        {:reply, {:error, :not_found}, state}
    end
  end

  @impl true
  def handle_call({:delete, session_id}, _from, state) do
    :ets.delete(@table, session_id)

    DccRecord
    |> where([r], r.session_id == ^session_id)
    |> Repo.delete_all()

    {:reply, :ok, %{state | dirty: MapSet.delete(state.dirty, session_id)}}
  end

  @impl true
  def handle_call(:current_session, _from, state) do
    result =
      case state.current_session_id do
        nil ->
          nil

        id ->
          case :ets.lookup(@table, id) do
            [{^id, dcc}] -> dcc
            [] -> nil
          end
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:set_current, session_id}, _from, state) do
    {:reply, :ok, %{state | current_session_id: session_id}}
  end

  @impl true
  def handle_call(:flush, _from, state) do
    persist_dirty(state.dirty)
    {:reply, :ok, %{state | dirty: MapSet.new()}}
  end

  @impl true
  def handle_info(:persist, state) do
    persist_dirty(state.dirty)
    schedule_persist()
    {:noreply, %{state | dirty: MapSet.new()}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # Private

  defp schedule_persist do
    Process.send_after(self(), :persist, @persist_interval)
  end

  defp load_from_db do
    try do
      records = Repo.all(DccRecord)

      Enum.each(records, fn record ->
        case DccRecord.to_dcc(record) do
          {:ok, dcc} ->
            :ets.insert(@table, {record.session_id, dcc})

          {:error, reason} ->
            Logger.warning(
              "[SessionStore] Failed to decode DCC for #{record.session_id}: #{inspect(reason)}"
            )
        end
      end)

      length(records)
    rescue
      e ->
        Logger.info("[SessionStore] Starting fresh: #{inspect(e)}")
        0
    end
  end

  defp persist_dirty(dirty_ids) do
    Enum.each(dirty_ids, fn session_id ->
      case :ets.lookup(@table, session_id) do
        [{^session_id, dcc}] ->
          now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
          record = DccRecord.from_dcc(dcc)

          Repo.insert(
            %DccRecord{
              session_id: record.session_id,
              dcc_data: record.dcc_data,
              crystallized: record.crystallized,
              inserted_at: now,
              updated_at: now
            },
            on_conflict: [
              set: [
                dcc_data: record.dcc_data,
                crystallized: record.crystallized,
                updated_at: now
              ]
            ],
            conflict_target: :session_id
          )

        [] ->
          :ok
      end
    end)
  end
end
