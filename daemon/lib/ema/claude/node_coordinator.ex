defmodule Ema.Claude.NodeCoordinator do
  @moduledoc """
  Distributed coordination GenServer for the EMA mesh.

  Coordinates AI work across multiple EMA instances connected via Erlang
  distribution (libcluster over Tailscale). Handles provider discovery,
  load-balanced routing, and graceful reconnection when laptops sleep/wake.

  ## Architecture

  Each EMA node runs one NodeCoordinator. Coordinators communicate via
  GenServer.call/cast to their counterparts on remote nodes. Service
  discovery uses :pg (process groups) so any node can find any other
  coordinator without knowing the remote PID up front.

  ## Fallback Chain

  1. Try local SmartRouter (zero network cost)
  2. Query :pg for remote NodeCoordinators
  3. Score each remote: available providers + lowest load
  4. Execute on best remote via RPC / GenServer.call
  5. Stream results back to caller via callback
  6. On remote failure: try next remote, then enqueue for retry
  """

  use GenServer
  require Logger

  @pg_scope :ema_cluster
  @pg_group :node_coordinators
  @heartbeat_interval_ms 30_000
  @reconnect_interval_ms 10_000
  # Generous — laptops sleep
  @remote_call_timeout_ms 120_000
  # Allow 3 * heartbeat gap before marking stale
  @stale_threshold_ms 90_000

  # ---------------------------------------------------------------------------
  # Structs
  # ---------------------------------------------------------------------------

  defmodule NodeInfo do
    @moduledoc "Snapshot of a remote node's capabilities and load."
    defstruct [
      :node,
      :providers,
      :load,
      :status,
      :last_heartbeat,
      :monitor_ref
    ]

    @type t :: %__MODULE__{
            node: node(),
            providers: [atom()],
            load: map(),
            status: :connected | :disconnected | :stale,
            last_heartbeat: integer(),
            monitor_ref: reference() | nil
          }
  end

  defmodule State do
    @moduledoc "Internal GenServer state."
    defstruct [
      :local_node,
      :local_providers,
      :local_load,
      :remote_nodes,
      :pending_remote,
      :heartbeat_timer
    ]
  end

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  @doc "Start and link the NodeCoordinator."
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Register the providers available on this local node.
  Providers are atoms like :claude_cli, :openrouter, :ollama, etc.
  """
  def register_local_providers(providers) when is_list(providers) do
    GenServer.call(__MODULE__, {:register_local_providers, providers})
  end

  @doc """
  Find a remote node that can handle the given task_type.
  Returns {:ok, node_name} or {:error, :no_remote_available}.
  """
  def find_remote_provider(task_type, opts \\ []) do
    GenServer.call(__MODULE__, {:find_remote_provider, task_type, opts})
  end

  @doc """
  Execute a prompt on a specific remote node.
  The callback receives streaming chunks: {:chunk, data} | {:done, result} | {:error, reason}.
  """
  def execute_remote(node, prompt, task_type, opts \\ []) do
    GenServer.call(
      __MODULE__,
      {:execute_remote, node, prompt, task_type, opts},
      @remote_call_timeout_ms
    )
  end

  @doc "Returns a summary of all known nodes and their current state."
  def cluster_status do
    GenServer.call(__MODULE__, :cluster_status)
  end

  @doc "Returns this node's current load metrics."
  def load_report do
    GenServer.call(__MODULE__, :load_report)
  end

  # ---------------------------------------------------------------------------
  # Internal: protocol helpers called by remote nodes
  # ---------------------------------------------------------------------------

  @doc false
  def handle_capability_advertisement(node_info) do
    GenServer.cast(__MODULE__, {:capability_advertisement, node_info})
  end

  @doc false
  def handle_work_request(task_id, prompt, task_type, opts) do
    GenServer.cast(__MODULE__, {:work_request, task_id, prompt, task_type, opts})
  end

  @doc false
  def handle_work_result(task_id, result) do
    GenServer.cast(__MODULE__, {:work_result, task_id, result})
  end

  @doc false
  def handle_heartbeat(node_info) do
    GenServer.cast(__MODULE__, {:heartbeat, node_info})
  end

  @doc false
  def handle_load_update(load_info) do
    GenServer.cast(__MODULE__, {:load_update, load_info})
  end

  # ---------------------------------------------------------------------------
  # GenServer callbacks
  # ---------------------------------------------------------------------------

  @impl true
  def init(_opts) do
    # Ensure :pg scope exists
    :pg.start(@pg_scope)

    # Join the coordinator group so remote nodes can find us
    :pg.join(@pg_scope, @pg_group, self())

    # Subscribe to Erlang distribution node up/down events
    :net_kernel.monitor_nodes(true, node_type: :all)

    # Seed local state
    state = %State{
      local_node: Node.self(),
      local_providers: local_task_types_from_config(),
      local_load: %{active_sessions: 0, queue_depth: 0},
      remote_nodes: %{},
      pending_remote: %{},
      heartbeat_timer: nil
    }

    # Schedule first heartbeat immediately (will also broadcast capabilities)
    timer = Process.send_after(self(), :heartbeat_tick, 100)
    state = %{state | heartbeat_timer: timer}

    Logger.info("[NodeCoordinator] Started on #{Node.self()}")
    {:ok, state}
  end

  # ---------------------------------------------------------------------------
  # handle_call
  # ---------------------------------------------------------------------------

  @impl true
  def handle_call({:register_local_providers, providers}, _from, state) do
    state = %{state | local_providers: providers}
    # Broadcast updated capabilities to cluster
    broadcast_capabilities(state)
    {:reply, :ok, state}
  end

  def handle_call({:find_remote_provider, task_type, _opts}, _from, state) do
    result = do_find_remote_provider(task_type, state)
    {:reply, result, state}
  end

  def handle_call({:execute_remote, target_node, prompt, task_type, opts}, from, state) do
    task_id = make_task_id()

    # Store pending so we can route the result back when it arrives
    pending = Map.put(state.pending_remote, task_id, %{from: from, node: target_node})
    state = %{state | pending_remote: pending}

    # Fire the request off to the remote coordinator
    case send_work_request(target_node, task_id, prompt, task_type, opts) do
      :ok ->
        # Reply will come asynchronously via handle_cast {:work_result, ...}
        {:noreply, state}

      {:error, reason} ->
        # Failed immediately — retry fallback
        {reply, state} =
          handle_remote_failure(task_id, target_node, prompt, task_type, opts, reason, state)

        {:reply, reply, state}
    end
  end

  def handle_call(:cluster_status, _from, state) do
    now = System.monotonic_time(:millisecond)

    status =
      Enum.map(state.remote_nodes, fn {node, info} ->
        age_ms = now - info.last_heartbeat
        effective_status = if age_ms > @stale_threshold_ms, do: :stale, else: info.status

        %{
          node: node,
          providers: info.providers,
          load: info.load,
          status: effective_status,
          last_seen_ms_ago: age_ms
        }
      end)

    local = %{
      node: state.local_node,
      providers: state.local_providers,
      load: state.local_load,
      status: :local
    }

    {:reply, [local | status], state}
  end

  def handle_call(:load_report, _from, state) do
    {:reply, state.local_load, state}
  end

  # ---------------------------------------------------------------------------
  # handle_cast — protocol messages from remote coordinators
  # ---------------------------------------------------------------------------

  @impl true
  def handle_cast({:capability_advertisement, node_info}, state) do
    Logger.debug(
      "[NodeCoordinator] Capability advertisement from #{node_info.node}: #{inspect(node_info.providers)}"
    )

    state = upsert_remote_node(state, node_info)
    {:noreply, state}
  end

  def handle_cast({:work_request, task_id, prompt, task_type, opts}, state) do
    # We received a work request from a remote node — execute locally
    caller_node = Keyword.get(opts, :caller_node, :unknown)
    Logger.info("[NodeCoordinator] Work request #{task_id} from #{caller_node}: #{task_type}")

    Task.start(fn ->
      result = execute_locally(prompt, task_type, opts)

      # Send result back to caller's coordinator
      if caller_node != :unknown do
        :rpc.cast(caller_node, __MODULE__, :handle_work_result, [task_id, result])
      end
    end)

    {:noreply, state}
  end

  def handle_cast({:work_result, task_id, result}, state) do
    case Map.pop(state.pending_remote, task_id) do
      {nil, _} ->
        Logger.warning("[NodeCoordinator] Received result for unknown task_id: #{task_id}")
        {:noreply, state}

      {%{from: from}, pending} ->
        GenServer.reply(from, result)
        {:noreply, %{state | pending_remote: pending}}
    end
  end

  def handle_cast({:heartbeat, node_info}, state) do
    state = upsert_remote_node(state, node_info)
    {:noreply, state}
  end

  def handle_cast({:load_update, load_info}, state) do
    node = load_info.node

    state =
      update_in(state.remote_nodes[node], fn
        nil -> nil
        info -> %{info | load: load_info.load}
      end)

    {:noreply, state}
  end

  # ---------------------------------------------------------------------------
  # handle_info
  # ---------------------------------------------------------------------------

  @impl true
  def handle_info(:heartbeat_tick, state) do
    # Cancel old timer defensively
    if state.heartbeat_timer, do: Process.cancel_timer(state.heartbeat_timer)

    # Broadcast our current state to the cluster
    broadcast_capabilities(state)
    broadcast_heartbeat(state)

    # Mark stale nodes
    state = mark_stale_nodes(state)

    # Schedule next heartbeat
    timer = Process.send_after(self(), :heartbeat_tick, @heartbeat_interval_ms)
    {:noreply, %{state | heartbeat_timer: timer}}
  end

  # Node came up (Erlang distribution event)
  def handle_info({:nodeup, node, _info}, state) do
    Logger.info("[NodeCoordinator] Node up: #{node}")

    # Monitor the node for future disconnection
    ref = Node.monitor(node, true)

    # Re-exchange capabilities — the remote might have restarted
    send_capability_advertisement(node, state)

    state =
      case Map.get(state.remote_nodes, node) do
        nil ->
          # Brand new node — add a placeholder until we get their capabilities
          info = %NodeInfo{
            node: node,
            providers: [],
            load: %{},
            status: :connected,
            last_heartbeat: System.monotonic_time(:millisecond),
            monitor_ref: ref
          }

          put_in(state.remote_nodes[node], info)

        existing ->
          # Known node reconnected — restore status, keep capabilities
          info = %{existing | status: :connected, monitor_ref: ref}
          retry_pending_for_node(put_in(state.remote_nodes[node], info), node)
      end

    {:noreply, state}
  end

  # Node went down (Erlang distribution event)
  def handle_info({:nodedown, node, _info}, state) do
    Logger.warning(
      "[NodeCoordinator] Node down: #{node} — marking :disconnected (may be sleeping)"
    )

    # Mark as disconnected, NOT dead — laptops sleep all the time
    state =
      update_in(state.remote_nodes[node], fn
        nil -> nil
        info -> %{info | status: :disconnected}
      end)

    # Retry any pending tasks that were sent to this node
    state = fail_pending_for_node(state, node)

    # Schedule a reconnect probe
    Process.send_after(self(), {:probe_node, node}, @reconnect_interval_ms)

    {:noreply, state}
  end

  # Periodic probe for a disconnected node
  def handle_info({:probe_node, node}, state) do
    case Map.get(state.remote_nodes, node) do
      %{status: :disconnected} ->
        Logger.debug("[NodeCoordinator] Probing disconnected node: #{node}")
        # Attempt to ping — if successful, :nodeup will fire naturally
        # via net_kernel.monitor_nodes. We just log here.
        case :net_adm.ping(node) do
          :pong ->
            Logger.info("[NodeCoordinator] Probe succeeded for #{node} — connection restored")

          :pang ->
            # Still down — schedule next probe (back off slightly)
            Process.send_after(self(), {:probe_node, node}, @reconnect_interval_ms * 2)
        end

      _ ->
        # Status changed (reconnected or removed) — no more probing
        :ok
    end

    {:noreply, state}
  end

  def handle_info(msg, state) do
    Logger.debug("[NodeCoordinator] Unhandled info: #{inspect(msg)}")
    {:noreply, state}
  end

  @impl true
  def terminate(reason, _state) do
    Logger.info("[NodeCoordinator] Terminating: #{inspect(reason)}")
    :pg.leave(@pg_scope, @pg_group, self())
    :ok
  end

  # ---------------------------------------------------------------------------
  # Private helpers
  # ---------------------------------------------------------------------------

  defp make_task_id do
    :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
  end

  defp current_node_info(state) do
    %NodeInfo{
      node: state.local_node,
      providers: state.local_providers,
      load: state.local_load,
      status: :connected,
      last_heartbeat: System.monotonic_time(:millisecond)
    }
  end

  defp broadcast_capabilities(state) do
    info = current_node_info(state)

    for pid <- remote_coordinator_pids() do
      GenServer.cast(pid, {:capability_advertisement, info})
    end
  end

  defp broadcast_heartbeat(state) do
    info = current_node_info(state)

    for pid <- remote_coordinator_pids() do
      GenServer.cast(pid, {:heartbeat, info})
    end
  end

  defp remote_coordinator_pids do
    members = :pg.get_members(@pg_scope, @pg_group)
    Enum.reject(members, &(&1 == self()))
  end

  defp send_capability_advertisement(node, state) do
    info = current_node_info(state)
    :rpc.cast(node, __MODULE__, :handle_capability_advertisement, [info])
  end

  defp send_work_request(target_node, task_id, prompt, task_type, opts) do
    opts_with_caller = Keyword.put(opts, :caller_node, Node.self())

    try do
      :rpc.cast(target_node, __MODULE__, :handle_work_request, [
        task_id,
        prompt,
        task_type,
        opts_with_caller
      ])

      :ok
    catch
      kind, reason ->
        {:error, {kind, reason}}
    end
  end

  defp upsert_remote_node(state, node_info) do
    existing = Map.get(state.remote_nodes, node_info.node, %NodeInfo{})

    updated = %NodeInfo{
      node: node_info.node,
      providers: node_info.providers,
      load: node_info.load,
      status: :connected,
      last_heartbeat: System.monotonic_time(:millisecond),
      # Preserve monitor ref if already set
      monitor_ref: existing.monitor_ref
    }

    put_in(state.remote_nodes[node_info.node], updated)
  end

  defp mark_stale_nodes(state) do
    now = System.monotonic_time(:millisecond)

    updated =
      Enum.map(state.remote_nodes, fn {node, info} ->
        age = now - info.last_heartbeat

        new_status =
          cond do
            info.status == :disconnected -> :disconnected
            age > @stale_threshold_ms -> :stale
            true -> :connected
          end

        {node, %{info | status: new_status}}
      end)
      |> Map.new()

    %{state | remote_nodes: updated}
  end

  defp do_find_remote_provider(task_type, state) do
    now = System.monotonic_time(:millisecond)

    candidates =
      state.remote_nodes
      |> Enum.filter(fn {_node, info} ->
        info.status == :connected and
          task_type in info.providers and
          now - info.last_heartbeat < @stale_threshold_ms
      end)
      |> Enum.sort_by(fn {_node, info} ->
        # Lower score = better candidate
        active = Map.get(info.load, :active_sessions, 0)
        queue = Map.get(info.load, :queue_depth, 0)
        active + queue
      end)

    case candidates do
      [{node, _info} | _] -> {:ok, node}
      [] -> {:error, :no_remote_available}
    end
  end

  defp execute_locally(prompt, task_type, opts) do
    try do
      Ema.Claude.AI.run(
        prompt,
        Keyword.merge(
          opts,
          task_type: task_type,
          provider_id: provider_for_task(task_type),
          allow_fallback: true
        )
      )
    rescue
      e -> {:error, Exception.message(e)}
    end
  end

  defp provider_for_task(task_type) do
    case task_type do
      t when t in [:research, :summarization] -> "openclaw-vm"
      :code_generation -> "codex-local"
      :code_review -> "claude-local"
      _ -> "claude-local"
    end
  end

  defp local_task_types_from_config do
    Application.get_env(:ema, Ema.Claude, [])
    |> Keyword.get(:providers, [])
    |> Enum.flat_map(fn provider ->
      provider
      |> Map.get(:capabilities, %{})
      |> Map.get(:task_types, [])
    end)
    |> Enum.uniq()
  end

  defp handle_remote_failure(task_id, _failed_node, prompt, task_type, opts, reason, state) do
    Logger.warning("[NodeCoordinator] Remote failure for task #{task_id}: #{inspect(reason)}")

    # Remove from pending
    state = %{state | pending_remote: Map.delete(state.pending_remote, task_id)}

    # Try another remote
    case do_find_remote_provider(task_type, state) do
      {:ok, next_node} ->
        Logger.info("[NodeCoordinator] Retrying task #{task_id} on #{next_node}")

        case send_work_request(next_node, task_id, prompt, task_type, opts) do
          :ok -> {{:ok, :retrying_on, next_node}, state}
          {:error, r} -> {{:error, r}, state}
        end

      {:error, _} ->
        {{:error, :no_remote_available}, state}
    end
  end

  defp retry_pending_for_node(state, _node) do
    # When a node reconnects, any tasks that were queued for retry can be resent.
    # For now we log — a real impl would re-dispatch from a retry queue.
    Logger.debug("[NodeCoordinator] Node reconnected — retry queue not yet implemented")
    state
  end

  defp fail_pending_for_node(state, node) do
    {to_fail, remaining} =
      Enum.split_with(state.pending_remote, fn {_id, %{node: n}} -> n == node end)

    for {task_id, %{from: from}} <- to_fail do
      Logger.warning(
        "[NodeCoordinator] Failing pending task #{task_id} — node #{node} disconnected"
      )

      GenServer.reply(from, {:error, :node_disconnected})
    end

    %{state | pending_remote: Map.new(remaining)}
  end
end
