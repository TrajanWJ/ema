defmodule Ema.Pipes.Executor do
  @moduledoc """
  Subscribes to PubSub for all active pipe trigger patterns.
  On event: finds matching pipes, runs transforms, executes actions.
  Handles errors per-pipe so one failure doesn't affect others.
  Records pipe_runs for monitoring.
  """

  use GenServer
  require Logger

  alias Ema.Pipes
  alias Ema.Pipes.Registry

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def reload do
    GenServer.cast(__MODULE__, :reload)
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    # Subscribe to config changes so we reload when pipes are created/updated/toggled
    Phoenix.PubSub.subscribe(Ema.PubSub, "pipes:config")

    # Defer pipe loading until after the Loader has had a chance to seed
    send(self(), :load_pipes)

    {:ok, %{pipes: [], subscriptions: MapSet.new()}}
  end

  @impl true
  def handle_info(:load_pipes, state) do
    state = reload_pipes(state)
    {:noreply, state}
  end

  def handle_info(:pipes_changed, state) do
    state = reload_pipes(state)
    {:noreply, state}
  end

  def handle_info({:pipe_event, trigger_pattern, payload}, state) do
    matching_pipes =
      Enum.filter(state.pipes, fn pipe ->
        pipe.active && pipe.trigger_pattern == trigger_pattern
      end)

    for pipe <- matching_pipes do
      Task.Supervisor.start_child(Ema.Pipes.TaskSupervisor, fn ->
        execute_pipe(pipe, trigger_pattern, payload)
      end)
    end

    {:noreply, state}
  end

  def handle_info(_msg, state) do
    {:noreply, state}
  end

  @impl true
  def handle_cast(:reload, state) do
    {:noreply, reload_pipes(state)}
  end

  # --- Private ---

  defp reload_pipes(state) do
    pipes = Pipes.list_pipes(active: true)

    # Determine which trigger patterns we need
    needed = MapSet.new(pipes, & &1.trigger_pattern)

    # Unsubscribe from patterns no longer needed
    for pattern <- MapSet.difference(state.subscriptions, needed) do
      Phoenix.PubSub.unsubscribe(Ema.PubSub, "pipe_trigger:#{pattern}")
    end

    # Subscribe to new patterns
    for pattern <- MapSet.difference(needed, state.subscriptions) do
      Phoenix.PubSub.subscribe(Ema.PubSub, "pipe_trigger:#{pattern}")
    end

    Logger.info(
      "Pipes Executor loaded #{length(pipes)} active pipes, subscribed to #{MapSet.size(needed)} triggers"
    )

    %{pipes: pipes, subscriptions: needed}
  end

  defp execute_pipe(pipe, trigger_pattern, payload) do
    started_at = DateTime.utc_now()

    result =
      try do
        # Run transforms in order
        case run_transforms(pipe.pipe_transforms, payload) do
          {:ok, transformed_payload} ->
            # Execute actions in order
            run_actions(pipe.pipe_actions, transformed_payload)

          {:skip, reason} ->
            {:skipped, reason}
        end
      rescue
        e ->
          Logger.error("Pipe #{pipe.name} (#{pipe.id}) failed: #{Exception.message(e)}")
          {:error, Exception.message(e)}
      end

    completed_at = DateTime.utc_now()

    {status, error} =
      case result do
        {:ok, _} -> {"success", nil}
        {:skipped, reason} -> {"skipped", reason}
        {:error, msg} -> {"failed", msg}
      end

    # Record the run
    Pipes.record_run(pipe, %{
      status: status,
      trigger_event: %{pattern: trigger_pattern, payload: payload},
      started_at: started_at,
      completed_at: completed_at,
      error: error
    })

    run_summary = %{
      pipe_id: pipe.id,
      pipe_name: pipe.name,
      trigger: trigger_pattern,
      status: status,
      error: error,
      started_at: started_at,
      completed_at: completed_at
    }

    # Broadcast execution status for the monitor UI
    Phoenix.PubSub.broadcast(Ema.PubSub, "pipes:monitor", {:pipe_executed, run_summary})
    Phoenix.PubSub.broadcast(Ema.PubSub, "pipes:runs", {:pipe_run, :completed, run_summary})
  end

  defp run_transforms(transforms, payload) do
    sorted = Enum.sort_by(transforms, & &1.sort_order)

    Enum.reduce_while(sorted, {:ok, payload}, fn transform, {:ok, current_payload} ->
      case apply_transform(transform, current_payload) do
        {:ok, new_payload} -> {:cont, {:ok, new_payload}}
        {:skip, reason} -> {:halt, {:skip, reason}}
      end
    end)
  end

  defp apply_transform(%{transform_type: "filter"} = transform, payload) do
    config = transform.config || %{}
    field = config["field"]
    op = config["op"] || "eq"
    value = config["value"]

    if field do
      actual = get_in_payload(payload, field)

      if compare(actual, op, value) do
        {:ok, payload}
      else
        {:skip, "filter: #{field} #{op} #{inspect(value)} did not match"}
      end
    else
      # No field specified — pass through
      {:ok, payload}
    end
  end

  defp apply_transform(%{transform_type: "map"} = transform, payload) do
    config = transform.config || %{}
    renamed = config["rename"] || %{}
    added = config["add"] || %{}

    new_payload =
      payload
      |> rename_keys(renamed)
      |> Map.merge(added)

    {:ok, new_payload}
  end

  defp apply_transform(%{transform_type: "delay"}, payload) do
    # Delay/debounce is a simplification — in a full implementation this would
    # use a timer and accumulate events. For now, pass through.
    {:ok, payload}
  end

  defp apply_transform(%{transform_type: "conditional"} = transform, payload) do
    config = transform.config || %{}
    field = config["if_field"]
    op = config["op"] || "eq"
    value = config["value"]
    then_action = config["then"] || "continue"

    if field do
      actual = get_in_payload(payload, field)

      if compare(actual, op, value) do
        if then_action == "continue",
          do: {:ok, payload},
          else: {:skip, "conditional: else branch"}
      else
        if then_action == "continue",
          do: {:skip, "conditional: condition not met"},
          else: {:ok, payload}
      end
    else
      {:ok, payload}
    end
  end

  defp apply_transform(%{transform_type: "claude"} = transform, payload) do
    config = transform.config || %{}
    Ema.Pipes.Actions.ClaudeAction.execute(payload, config)
  end

  defp apply_transform(_transform, payload) do
    {:ok, payload}
  end

  defp run_actions(actions, payload) do
    sorted = Enum.sort_by(actions, & &1.sort_order)

    results =
      Enum.map(sorted, fn action ->
        merged_payload = Map.merge(payload, action.config || %{})

        case Registry.execute_action(action.action_id, merged_payload) do
          {:ok, result} -> {:ok, result}
          {:error, reason} -> {:error, "#{action.action_id}: #{inspect(reason)}"}
        end
      end)

    errors = Enum.filter(results, &match?({:error, _}, &1))

    if Enum.empty?(errors) do
      {:ok, results}
    else
      {:error, Enum.map_join(errors, "; ", fn {:error, msg} -> msg end)}
    end
  end

  defp get_in_payload(payload, field) when is_map(payload) do
    # Support dotted paths like "payload.priority"
    field
    |> String.split(".")
    |> Enum.reduce(payload, fn key, acc ->
      case acc do
        %{} = map -> Map.get(map, key) || Map.get(map, String.to_existing_atom(key))
        _ -> nil
      end
    end)
  rescue
    ArgumentError -> nil
  end

  defp compare(actual, "eq", value), do: to_string(actual) == to_string(value)
  defp compare(actual, "neq", value), do: to_string(actual) != to_string(value)
  defp compare(actual, "gt", value), do: to_number(actual) > to_number(value)
  defp compare(actual, "gte", value), do: to_number(actual) >= to_number(value)
  defp compare(actual, "lt", value), do: to_number(actual) < to_number(value)
  defp compare(actual, "lte", value), do: to_number(actual) <= to_number(value)

  defp compare(actual, "in", value) when is_list(value),
    do: to_string(actual) in Enum.map(value, &to_string/1)

  defp compare(_actual, _op, _value), do: false

  defp to_number(val) when is_number(val), do: val

  defp to_number(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, ""} ->
        n

      _ ->
        case Float.parse(val) do
          {f, ""} -> f
          _ -> 0
        end
    end
  end

  defp to_number(_), do: 0

  defp rename_keys(map, renames) do
    Enum.reduce(renames, map, fn {old_key, new_key}, acc ->
      case Map.pop(acc, old_key) do
        {nil, acc} -> acc
        {val, acc} -> Map.put(acc, new_key, val)
      end
    end)
  end
end
