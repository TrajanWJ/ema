defmodule Ema.PluginRegistry do
  @moduledoc """
  ETS-backed registry for plugin-contributed pipe actions.

  Plugins register their actions here at startup; `Ema.Pipes.Registry`
  falls through to this module when a built-in action_id is not found.

  ## Usage (from plugin Application.start/2)

      Ema.PluginRegistry.register_action("ema_github", "github:create_issue", EmaGithub.Actions.CreateIssue)

  ## Dispatch (from Pipes.Registry.execute_action/2)

      case Ema.PluginRegistry.dispatch_action(action_id, payload, config) do
        {:ok, result} -> result
        {:error, :not_found} -> {:error, :unknown_action}
        {:error, reason} -> {:error, reason}
      end
  """

  require Logger

  @table :ema_plugin_actions
  @plugins_table :ema_plugins

  # ── Lifecycle ──────────────────────────────────────────────────────────────

  @doc """
  Initialize the ETS tables. Call once during application startup,
  before any plugins start. Safe to call multiple times (idempotent).
  """
  def init do
    if :ets.whereis(@table) == :undefined do
      :ets.new(@table, [:named_table, :public, :set, read_concurrency: true])
    end

    if :ets.whereis(@plugins_table) == :undefined do
      :ets.new(@plugins_table, [:named_table, :public, :set, read_concurrency: true])
    end

    :ok
  end

  # ── Registration ───────────────────────────────────────────────────────────

  @doc """
  Register a plugin action module under a plugin_id and action_id.

  `module` must implement the `Ema.PluginAction` behaviour:
    - `execute(payload, config) :: {:ok, any()} | {:error, any()}`
    - `schema() :: map()`

  ## Example

      Ema.PluginRegistry.register_action("ema_github", "github:create_issue", EmaGithub.Actions.CreateIssue)
  """
  @spec register_action(String.t(), String.t(), module()) :: :ok
  def register_action(plugin_id, action_id, module) do
    ensure_tables()
    :ets.insert(@table, {action_id, plugin_id, module})
    # Track plugin metadata
    :ets.insert(@plugins_table, {plugin_id, %{registered_at: DateTime.utc_now()}})
    Logger.debug("[PluginRegistry] Registered action #{action_id} from plugin #{plugin_id} (#{inspect(module)})")
    :ok
  end

  @doc """
  Register multiple actions from a plugin in one call.

  `actions` is a list of `{action_id, module}` tuples.
  """
  @spec register_actions(String.t(), [{String.t(), module()}]) :: :ok
  def register_actions(plugin_id, actions) when is_list(actions) do
    Enum.each(actions, fn {action_id, module} ->
      register_action(plugin_id, action_id, module)
    end)
  end

  @doc """
  Unregister all actions for a plugin (e.g., on hot-reload or shutdown).
  """
  @spec unregister_plugin(String.t()) :: :ok
  def unregister_plugin(plugin_id) do
    ensure_tables()

    actions_for_plugin = :ets.match(@table, {:"$1", plugin_id, :_})
    Enum.each(actions_for_plugin, fn [action_id] ->
      :ets.delete(@table, action_id)
    end)

    :ets.delete(@plugins_table, plugin_id)
    Logger.info("[PluginRegistry] Unregistered all actions for plugin #{plugin_id}")
    :ok
  end

  # ── Lookup ──────────────────────────────────────────────────────────────────

  @doc """
  Look up a plugin action by action_id. Returns nil if not found.
  """
  @spec lookup_action(String.t()) :: map() | nil
  def lookup_action(action_id) do
    ensure_tables()

    case :ets.lookup(@table, action_id) do
      [{^action_id, plugin_id, module}] ->
        %{
          action_id: action_id,
          plugin_id: plugin_id,
          module: module,
          source: :plugin
        }

      [] ->
        nil
    end
  end

  # ── Dispatch ───────────────────────────────────────────────────────────────

  @doc """
  Dispatch a plugin action by action_id.

  Finds the registered module and calls `module.execute(payload, config)`.
  Wraps execution in try/rescue so a crashing plugin action doesn't
  propagate to the calling pipe executor.

  Returns:
    - `{:ok, result}` — action succeeded
    - `{:error, :not_found}` — no plugin registered this action_id
    - `{:error, reason}` — action returned an error or raised
  """
  @spec dispatch_action(String.t(), map(), map()) :: {:ok, any()} | {:error, any()}
  def dispatch_action(action_id, payload, config \\ %{}) do
    case lookup_action(action_id) do
      nil ->
        {:error, :not_found}

      %{module: module, plugin_id: plugin_id} ->
        Logger.debug("[PluginRegistry] Dispatching #{action_id} via plugin #{plugin_id}")

        try do
          case module.execute(payload, config) do
            {:ok, _} = ok -> ok
            {:error, _} = err -> err
            other -> {:ok, other}
          end
        rescue
          e ->
            Logger.error("[PluginRegistry] Plugin action #{action_id} raised: #{inspect(e)}\n#{Exception.format(:error, e, __STACKTRACE__)}")
            {:error, {:plugin_action_raised, e}}
        end
    end
  end

  # ── Introspection ──────────────────────────────────────────────────────────

  @doc """
  List all registered plugins with their metadata.

  Returns a list of `%{plugin_id: String.t(), meta: map(), action_ids: [String.t()]}`.
  """
  @spec list_plugins() :: [map()]
  def list_plugins do
    ensure_tables()

    :ets.tab2list(@plugins_table)
    |> Enum.map(fn {plugin_id, meta} ->
      action_ids =
        :ets.match(@table, {:"$1", plugin_id, :_})
        |> Enum.map(fn [action_id] -> action_id end)

      %{
        plugin_id: plugin_id,
        meta: meta,
        action_ids: action_ids
      }
    end)
  end

  @doc """
  List all registered plugin actions (for Pipes editor catalog).

  Returns a list of action maps compatible with `Ema.Pipes.Registry.Action` shape.
  """
  @spec list_actions() :: [map()]
  def list_actions do
    ensure_tables()

    :ets.tab2list(@table)
    |> Enum.map(fn {action_id, plugin_id, module} ->
      schema = safe_schema(module)

      %{
        id: action_id,
        action_id: action_id,
        plugin_id: plugin_id,
        module: module,
        label: humanize_action_id(action_id),
        schema: schema,
        source: :plugin,
        execute: fn payload ->
          dispatch_action(action_id, payload, %{})
        end
      }
    end)
  end

  # ── Private ────────────────────────────────────────────────────────────────

  defp ensure_tables do
    if :ets.whereis(@table) == :undefined, do: init()
  end

  defp safe_schema(module) do
    if function_exported?(module, :schema, 0) do
      try do
        module.schema()
      rescue
        _ -> %{}
      end
    else
      %{}
    end
  end

  defp humanize_action_id(action_id) do
    action_id
    |> String.split(":")
    |> Enum.map(&String.replace(&1, "_", " "))
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" / ")
  end
end
