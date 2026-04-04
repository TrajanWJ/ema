defmodule Ema.Hooks do
  @moduledoc """
  ETS-backed hook registry for EMA's plugin extension system.

  Provides synchronization points in core flows where plugins (and internal
  modules) can register handlers. Multiple handlers can be registered per hook.
  Handlers run synchronously in registration order; a failing handler logs
  an error but does not abort the remaining chain.

  ## Defined Hook Points

  | Hook                       | Fired by                  | Payload keys                    |
  |----------------------------|---------------------------|---------------------------------|
  | `:before_task_dispatch`    | `Ema.Pipes.Executor`      | `action_id, payload, config`    |
  | `:after_task_complete`     | `Ema.Tasks`               | `task, source`                  |
  | `:before_proposal_create`  | `Ema.Proposals`           | `attrs, seed`                   |
  | `:on_brain_dump_created`   | `Ema.BrainDump`           | `item`                          |
  | `:after_pipe_executed`     | `Ema.Pipes.Executor`      | `pipe, result, duration_ms`     |
  | `:on_daemon_boot`          | `Ema.Application`         | `version, env`                  |

  ## Usage (from plugin Application.start/2)

      Ema.Hooks.register(:after_task_complete, :my_plugin_handler, fn payload ->
        MyPlugin.handle_task_complete(payload)
      end)

  ## Usage (from EMA core)

      {:ok, results} = Ema.Hooks.run(:after_task_complete, %{task: task, source: :pipe})

  """

  require Logger

  @table :ema_hooks
  # ETS row: {hook_name, id, handler_fn, registered_at}

  # Known hook atoms — for documentation and introspection
  @known_hooks [
    :before_task_dispatch,
    :after_task_complete,
    :before_proposal_create,
    :on_brain_dump_created,
    :after_pipe_executed,
    :on_daemon_boot
  ]

  # ── Lifecycle ──────────────────────────────────────────────────────────────

  @doc """
  Initialize the ETS table. Call once at application startup.
  Safe to call multiple times (idempotent).
  """
  def init do
    if :ets.whereis(@table) == :undefined do
      # ordered_set so hooks run in insertion order
      :ets.new(@table, [:named_table, :public, :ordered_set, read_concurrency: true])
    end

    :ok
  end

  # ── Registration ───────────────────────────────────────────────────────────

  @doc """
  Register a handler function for a named hook.

  - `hook_name` — atom identifying the hook (e.g., `:after_task_complete`)
  - `id` — unique atom identifier for this handler (used for deregistration)
  - `handler_fn` — `fn payload -> result end` — receives the hook payload

  Re-registering the same `{hook_name, id}` overwrites the previous handler.
  """
  @spec register(atom(), atom(), (map() -> any())) :: :ok
  def register(hook_name, id, handler_fn) when is_atom(hook_name) and is_atom(id) and is_function(handler_fn, 1) do
    ensure_table()
    # Key: {hook_name, registered_at_monotonic, id} for ordering
    key = {hook_name, id}
    :ets.insert(@table, {key, handler_fn, System.monotonic_time()})
    Logger.debug("[Hooks] Registered handler #{inspect(id)} for hook #{inspect(hook_name)}")
    :ok
  end

  @doc """
  Unregister a previously registered handler.
  """
  @spec unregister(atom(), atom()) :: :ok
  def unregister(hook_name, id) when is_atom(hook_name) and is_atom(id) do
    ensure_table()
    :ets.delete(@table, {hook_name, id})
    Logger.debug("[Hooks] Unregistered handler #{inspect(id)} for hook #{inspect(hook_name)}")
    :ok
  end

  @doc """
  Unregister all handlers for a given id (across all hooks).
  Useful for plugin shutdown: `Ema.Hooks.unregister_all(:my_plugin)`.
  """
  @spec unregister_all(atom()) :: :ok
  def unregister_all(id) when is_atom(id) do
    ensure_table()

    :ets.match(@table, {{:_, id}, :_, :_})
    |> Enum.each(fn [{hook_name, ^id}] ->
      :ets.delete(@table, {hook_name, id})
    end)

    :ok
  end

  # ── Execution ──────────────────────────────────────────────────────────────

  @doc """
  Run all registered handlers for `hook_name` with `payload`.

  Handlers execute synchronously in registration order.
  A handler that raises or returns `{:error, _}` is logged but does NOT
  abort remaining handlers.

  Returns `{:ok, results}` where results is a list of handler return values
  (including error tuples from handlers that failed gracefully).

  ## Example

      {:ok, results} = Ema.Hooks.run(:after_task_complete, %{task: task, source: :api})
  """
  @spec run(atom(), map()) :: {:ok, [any()]}
  def run(hook_name, payload) when is_atom(hook_name) do
    ensure_table()

    handlers = list_handlers(hook_name)

    if handlers != [] do
      Logger.debug("[Hooks] Running #{length(handlers)} handler(s) for hook #{inspect(hook_name)}")
    end

    results =
      Enum.map(handlers, fn {id, handler_fn} ->
        run_handler(hook_name, id, handler_fn, payload)
      end)

    {:ok, results}
  end

  @doc """
  Run all handlers for a hook and return only the successful results.

  Like `run/2` but filters out `{:error, _}` entries from the result list.
  """
  @spec run_collecting(atom(), map()) :: {:ok, [any()]}
  def run_collecting(hook_name, payload) do
    {:ok, results} = run(hook_name, payload)

    successes =
      Enum.flat_map(results, fn
        {:ok, value} -> [value]
        _ -> []
      end)

    {:ok, successes}
  end

  # ── Introspection ──────────────────────────────────────────────────────────

  @doc """
  List all known hook names (defined by EMA core).
  """
  @spec known_hooks() :: [atom()]
  def known_hooks, do: @known_hooks

  @doc """
  List all registered handlers for a hook, sorted by registration order.
  Returns `[{id, handler_fn}]`.
  """
  @spec list_handlers(atom()) :: [{atom(), function()}]
  def list_handlers(hook_name) when is_atom(hook_name) do
    ensure_table()

    :ets.match(@table, {{hook_name, :"$1"}, :"$2", :"$3"})
    |> Enum.sort_by(fn [_id, _fn, registered_at] -> registered_at end)
    |> Enum.map(fn [id, handler_fn, _registered_at] -> {id, handler_fn} end)
  end

  @doc """
  Return a summary of all registered hooks and their handler counts.
  """
  @spec summary() :: map()
  def summary do
    ensure_table()

    :ets.tab2list(@table)
    |> Enum.group_by(fn {{hook_name, _id}, _fn, _ts} -> hook_name end)
    |> Enum.map(fn {hook_name, entries} ->
      {hook_name, %{
        handler_count: length(entries),
        handler_ids: Enum.map(entries, fn {{_hook, id}, _fn, _ts} -> id end)
      }}
    end)
    |> Enum.into(%{})
  end

  # ── Private ────────────────────────────────────────────────────────────────

  defp ensure_table do
    if :ets.whereis(@table) == :undefined, do: init()
  end

  defp run_handler(hook_name, id, handler_fn, payload) do
    try do
      case handler_fn.(payload) do
        {:ok, _} = ok ->
          ok

        {:error, reason} = err ->
          Logger.warning("[Hooks] Handler #{inspect(id)} for #{inspect(hook_name)} returned error: #{inspect(reason)}")
          err

        other ->
          {:ok, other}
      end
    rescue
      e ->
        Logger.error(
          "[Hooks] Handler #{inspect(id)} for #{inspect(hook_name)} raised: #{inspect(e)}\n" <>
            Exception.format(:error, e, __STACKTRACE__)
        )
        {:error, {:handler_raised, e}}
    end
  end
end
