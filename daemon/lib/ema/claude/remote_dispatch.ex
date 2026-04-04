defmodule Ema.Claude.RemoteDispatch do
  @moduledoc """
  Handles dispatching AI tasks to remote EMA nodes and streaming results back.

  When SmartRouter decides to route to a remote node, RemoteDispatch:
  1. Registers a local callback PID in ETS keyed by task_id
  2. Casts to the remote node's Bridge.run_remote/3 via :rpc.cast
  3. The remote node streams events back via Node.send({:ema_remote_event, task_id, event})
  4. This node receives the messages and forwards them to the callback_pid

  ## ETS Schema
  Table: :ema_remote_callbacks
  Row:   {task_id, callback_pid, remote_node, timeout_ms, started_at_monotonic}

  ## Event Shape (forwarded to callback_pid)
  {:remote_event, task_id, event}
  where event is one of:
    {:chunk, %{type: "text", content: binary()}}
    {:tool_use, map()}
    {:usage, map()}
    {:done, map()}
    {:error, term()}
    {:exit, map()}
  """

  require Logger

  @ets_table :ema_remote_callbacks
  @default_timeout_ms 120_000

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  @doc """
  Initialize the ETS callbacks table.

  Must be called during application startup, before any remote dispatch calls.
  Typically invoked from your Application.start/2:

      Ema.Claude.RemoteDispatch.init_ets()
  """
  @spec init_ets() :: :ok
  def init_ets do
    case :ets.info(@ets_table) do
      :undefined ->
        :ets.new(@ets_table, [:named_table, :public, :set, read_concurrency: true])
        :ok

      _ ->
        # Already exists — idempotent
        :ok
    end
  end

  @doc """
  Dispatch a task to a remote node and stream results back to callback_pid.

  ## Options
    - `:callback_pid` — PID that receives {:remote_event, task_id, event} messages.
      Defaults to self().
    - `:timeout_ms` — Maximum time to wait for the remote task. Default: 120_000 ms.
      A {:remote_task_timeout, task_id} is sent to callback_pid on expiry.
    - `:task_id` — Override auto-generated task ID (useful for idempotent retries).

  ## Return value
  `{:dispatched, task_id}` — fire-and-forget. Results arrive as messages to callback_pid.

  ## Example

      {:dispatched, tid} = RemoteDispatch.run(
        :"ema@laptop.local",
        "explain quantum entanglement",
        callback_pid: self(),
        timeout_ms: 60_000
      )
  """
  @spec run(node(), term(), keyword()) :: {:dispatched, binary()}
  def run(remote_node, task, opts \\ []) do
    callback_pid = Keyword.get(opts, :callback_pid, self())
    timeout_ms = Keyword.get(opts, :timeout_ms, @default_timeout_ms)
    task_id = Keyword.get(opts, :task_id, generate_task_id())
    started_at = System.monotonic_time(:millisecond)

    # Register callback so we can route incoming events back
    :ets.insert(@ets_table, {task_id, callback_pid, remote_node, timeout_ms, started_at})

    # Schedule timeout notification to callback_pid
    Process.send_after(callback_pid, {:remote_task_timeout, task_id}, timeout_ms)

    # Fire-and-forget to remote node
    :rpc.cast(remote_node, Ema.Claude.Bridge, :run_remote, [task, task_id, Node.self()])

    Logger.info("[RemoteDispatch] Dispatched task #{task_id} → #{remote_node}")

    {:dispatched, task_id}
  end

  @doc """
  Route an incoming remote event to the registered callback_pid.

  Call this from a handle_info clause that matches {:ema_remote_event, task_id, event}:

      def handle_info({:ema_remote_event, task_id, event}, state) do
        Ema.Claude.RemoteDispatch.handle_remote_event(task_id, event)
        {:noreply, state}
      end

  On :done or :error events the ETS entry is automatically deleted.
  """
  @spec handle_remote_event(binary(), term()) :: :ok
  def handle_remote_event(task_id, event) do
    case :ets.lookup(@ets_table, task_id) do
      [{^task_id, callback_pid, _remote_node, _timeout_ms, _started_at}] ->
        send(callback_pid, {:remote_event, task_id, event})
        maybe_cleanup(task_id, event)

      [] ->
        Logger.warning("[RemoteDispatch] Event for unknown task #{task_id}: #{inspect(event)}")
    end

    :ok
  end

  @doc """
  Cancel a dispatched task.

  Sends a :cancel RPC to the remote node and removes the ETS entry.
  The remote Bridge will stop streaming. No further events are delivered.
  """
  @spec cancel(binary()) :: :ok | {:error, :not_found}
  def cancel(task_id) do
    case :ets.lookup(@ets_table, task_id) do
      [{^task_id, _callback_pid, remote_node, _timeout_ms, _started_at}] ->
        :rpc.cast(remote_node, Ema.Claude.Bridge, :cancel_remote, [task_id])
        :ets.delete(@ets_table, task_id)
        Logger.debug("[RemoteDispatch] Cancelled task #{task_id} on #{remote_node}")
        :ok

      [] ->
        {:error, :not_found}
    end
  end

  @doc "List all active remote tasks (for diagnostics/debugging)."
  @spec active_tasks() :: [map()]
  def active_tasks do
    now = System.monotonic_time(:millisecond)

    :ets.tab2list(@ets_table)
    |> Enum.map(fn {task_id, pid, remote_node, timeout_ms, started_at} ->
      %{
        task_id: task_id,
        callback_pid: pid,
        remote_node: remote_node,
        timeout_ms: timeout_ms,
        age_ms: now - started_at
      }
    end)
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp maybe_cleanup(task_id, event) do
    terminal? =
      case event do
        {:done, _} -> true
        :done -> true
        {:error, _} -> true
        :error -> true
        {:exit, _} -> true
        _ -> false
      end

    if terminal? do
      Logger.debug("[RemoteDispatch] Task #{task_id} terminal — removing from ETS")
      :ets.delete(@ets_table, task_id)
    end
  end

  defp generate_task_id do
    :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
  end
end
