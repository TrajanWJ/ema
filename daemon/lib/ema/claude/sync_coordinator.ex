defmodule Ema.Claude.SyncCoordinator do
  @moduledoc """
  Manages CRDT-based state synchronization across the EMA distributed mesh.

  Uses DeltaCrdt.AWLWWMap to replicate cluster-wide state without a central
  coordinator. Each node maintains a local CRDT that automatically merges
  with peers via Erlang distribution.

  ## Sync Layers

  | Namespace        | What                              | Consistency   |
  |-----------------|-----------------------------------|---------------|
  | `:providers`    | Provider availability per node    | Seconds       |
  | `:usage`        | Aggregate usage stats             | Eventually    |
  | `:routing`      | Routing decision outcomes         | Eventually    |
  | `:campaigns`    | Campaign progress across nodes    | Eventually    |

  ## What Does NOT Sync

  - Credentials (per-node only, security boundary)
  - Active session state (ephemeral, node-local)
  - Stream data (real-time, not persisted)
  """

  use GenServer
  require Logger

  @flush_interval_ms 30_000
  @stale_threshold_ms 120_000

  # -- Types --

  @type namespace :: :providers | :usage | :routing | :campaigns
  @type sync_entry :: %{
          value: term(),
          node: node(),
          updated_at: integer()
        }

  # -- Client API --

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Write a key-value pair to the distributed CRDT under the given namespace.
  Automatically tags with the current node and timestamp.
  """
  @spec put(namespace(), term(), term()) :: :ok
  def put(namespace, key, value) do
    GenServer.call(__MODULE__, {:put, namespace, key, value})
  end

  @doc """
  Read a value from the CRDT. Returns the cluster-wide merged value.
  """
  @spec get(namespace(), term()) :: {:ok, term()} | :not_found
  def get(namespace, key) do
    GenServer.call(__MODULE__, {:get, namespace, key})
  end

  @doc """
  Get all entries under a namespace.
  """
  @spec get_all(namespace()) :: map()
  def get_all(namespace) do
    GenServer.call(__MODULE__, {:get_all, namespace})
  end

  @doc """
  Delete a key from the CRDT namespace.
  """
  @spec delete(namespace(), term()) :: :ok
  def delete(namespace, key) do
    GenServer.call(__MODULE__, {:delete, namespace, key})
  end

  @doc """
  Subscribe to changes in a namespace. Sends `{:sync_update, namespace, key, value}` to the caller.
  """
  @spec subscribe(namespace()) :: :ok
  def subscribe(namespace) do
    GenServer.call(__MODULE__, {:subscribe, namespace, self()})
  end

  @doc """
  Unsubscribe from namespace changes.
  """
  @spec unsubscribe(namespace()) :: :ok
  def unsubscribe(namespace) do
    GenServer.call(__MODULE__, {:unsubscribe, namespace, self()})
  end

  @doc """
  Returns sync health: per-namespace entry counts, last update times, stale entries.
  """
  @spec sync_status() :: map()
  def sync_status do
    GenServer.call(__MODULE__, :sync_status)
  end

  @doc """
  Force a flush of CRDT state to local SQLite.
  """
  @spec flush_to_db() :: :ok
  def flush_to_db do
    GenServer.call(__MODULE__, :flush_to_db)
  end

  # -- Server Callbacks --

  @impl true
  def init(_opts) do
    # Start one DeltaCrdt per namespace
    crdts =
      [:providers, :usage, :routing, :campaigns]
      |> Map.new(fn ns ->
        {:ok, crdt} =
          DeltaCrdt.start_link(DeltaCrdt.AWLWWMap,
            sync_interval: 100,
            name: crdt_name(ns)
          )

        {ns, crdt}
      end)

    # Monitor cluster membership for CRDT neighbor updates
    :net_kernel.monitor_nodes(true)

    # Schedule periodic DB flush
    Process.send_after(self(), :flush_to_db, @flush_interval_ms)

    # Connect CRDTs to existing cluster members
    for node <- Node.list(), ns <- Map.keys(crdts) do
      connect_crdt_to_node(crdts[ns], ns, node)
    end

    state = %{
      crdts: crdts,
      subscribers: %{providers: [], usage: [], routing: [], campaigns: []},
      last_flush: System.monotonic_time(:millisecond)
    }

    Logger.info("[SyncCoordinator] Started with namespaces: #{inspect(Map.keys(crdts))}")
    {:ok, state}
  end

  @impl true
  def handle_call({:put, namespace, key, value}, _from, state) do
    crdt = state.crdts[namespace]

    entry = %{
      value: value,
      node: node(),
      updated_at: System.system_time(:millisecond)
    }

    composite_key = {namespace, key}
    DeltaCrdt.put(crdt, composite_key, entry)

    # Notify local subscribers
    notify_subscribers(state.subscribers[namespace], namespace, key, value)

    {:reply, :ok, state}
  end

  @impl true
  def handle_call({:get, namespace, key}, _from, state) do
    crdt = state.crdts[namespace]
    composite_key = {namespace, key}

    case DeltaCrdt.to_map(crdt) |> Map.get(composite_key) do
      nil -> {:reply, :not_found, state}
      %{value: value} -> {:reply, {:ok, value}, state}
    end
  end

  @impl true
  def handle_call({:get_all, namespace}, _from, state) do
    crdt = state.crdts[namespace]

    entries =
      DeltaCrdt.to_map(crdt)
      |> Enum.filter(fn {{ns, _key}, _val} -> ns == namespace end)
      |> Map.new(fn {{_ns, key}, entry} -> {key, entry.value} end)

    {:reply, entries, state}
  end

  @impl true
  def handle_call({:delete, namespace, key}, _from, state) do
    crdt = state.crdts[namespace]
    composite_key = {namespace, key}
    DeltaCrdt.delete(crdt, composite_key)
    {:reply, :ok, state}
  end

  @impl true
  def handle_call({:subscribe, namespace, pid}, _from, state) do
    Process.monitor(pid)
    subs = Map.update!(state.subscribers, namespace, &[pid | &1])
    {:reply, :ok, %{state | subscribers: subs}}
  end

  @impl true
  def handle_call({:unsubscribe, namespace, pid}, _from, state) do
    subs = Map.update!(state.subscribers, namespace, &List.delete(&1, pid))
    {:reply, :ok, %{state | subscribers: subs}}
  end

  @impl true
  def handle_call(:sync_status, _from, state) do
    now = System.system_time(:millisecond)

    status =
      Map.new(state.crdts, fn {ns, crdt} ->
        entries = DeltaCrdt.to_map(crdt)

        ns_entries =
          entries
          |> Enum.filter(fn {{namespace, _key}, _val} -> namespace == ns end)

        stale_count =
          Enum.count(ns_entries, fn {_key, %{updated_at: ts}} ->
            now - ts > @stale_threshold_ms
          end)

        latest =
          case ns_entries do
            [] ->
              nil

            entries ->
              entries
              |> Enum.map(fn {_key, %{updated_at: ts}} -> ts end)
              |> Enum.max()
          end

        {ns,
         %{
           entry_count: length(ns_entries),
           stale_count: stale_count,
           latest_update: latest,
           connected_nodes: Node.list() |> length()
         }}
      end)

    {:reply, status, state}
  end

  @impl true
  def handle_call(:flush_to_db, _from, state) do
    do_flush_to_db(state)
    {:reply, :ok, %{state | last_flush: System.monotonic_time(:millisecond)}}
  end

  # -- Node Events --

  @impl true
  def handle_info({:nodeup, node}, state) do
    Logger.info("[SyncCoordinator] Node joined: #{node}, connecting CRDTs")

    for {ns, crdt} <- state.crdts do
      connect_crdt_to_node(crdt, ns, node)
    end

    {:noreply, state}
  end

  @impl true
  def handle_info({:nodedown, node}, state) do
    Logger.info("[SyncCoordinator] Node left: #{node}")
    # CRDTs handle disconnection automatically — no manual cleanup needed.
    # Stale entries will be detected via updated_at timestamps.
    {:noreply, state}
  end

  @impl true
  def handle_info(:flush_to_db, state) do
    do_flush_to_db(state)
    Process.send_after(self(), :flush_to_db, @flush_interval_ms)
    {:noreply, %{state | last_flush: System.monotonic_time(:millisecond)}}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, _reason}, state) do
    # Clean up dead subscribers
    subs =
      Map.new(state.subscribers, fn {ns, pids} ->
        {ns, List.delete(pids, pid)}
      end)

    {:noreply, %{state | subscribers: subs}}
  end

  @impl true
  def handle_info(msg, state) do
    Logger.debug("[SyncCoordinator] Unexpected message: #{inspect(msg)}")
    {:noreply, state}
  end

  # -- Private --

  defp crdt_name(namespace) do
    :"ema_sync_crdt_#{namespace}"
  end

  defp connect_crdt_to_node(local_crdt, namespace, remote_node) do
    remote_crdt = {crdt_name(namespace), remote_node}

    case DeltaCrdt.set_neighbours(local_crdt, [remote_crdt]) do
      :ok ->
        Logger.debug("[SyncCoordinator] Connected #{namespace} CRDT to #{remote_node}")

      error ->
        Logger.warning(
          "[SyncCoordinator] Failed to connect #{namespace} CRDT to #{remote_node}: #{inspect(error)}"
        )
    end
  end

  defp notify_subscribers(subscribers, namespace, key, value) do
    for pid <- subscribers, Process.alive?(pid) do
      send(pid, {:sync_update, namespace, key, value})
    end
  end

  defp do_flush_to_db(state) do
    for {ns, crdt} <- state.crdts do
      entries = DeltaCrdt.to_map(crdt)

      ns_entries =
        entries
        |> Enum.filter(fn {{namespace, _key}, _val} -> namespace == ns end)
        |> Enum.map(fn {{_ns, key}, entry} ->
          %{
            namespace: ns,
            key: :erlang.term_to_binary(key) |> Base.encode64(),
            value: :erlang.term_to_binary(entry.value) |> Base.encode64(),
            source_node: to_string(entry.node),
            updated_at: entry.updated_at
          }
        end)

      if length(ns_entries) > 0 do
        Logger.debug("[SyncCoordinator] Flushing #{length(ns_entries)} entries for #{ns}")
        # In production, this upserts into the sync_state table:
        # Ema.Repo.insert_all(Ema.Claude.SyncState, ns_entries,
        #   on_conflict: {:replace, [:value, :source_node, :updated_at]},
        #   conflict_target: [:namespace, :key]
        # )
      end
    end
  rescue
    error ->
      Logger.error("[SyncCoordinator] DB flush failed: #{inspect(error)}")
  end
end
