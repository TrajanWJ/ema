defmodule Ema.Claude.ExecutionBridge do
  @moduledoc """
  Per-execution async dispatch supervisor.

  Wraps the existing Ema.Claude.Bridge with an async pattern:
    1. dispatch_async/2 — spawns a Bridge GenServer per execution (max 10 concurrent)
    2. run_sync/2 — backward-compat wrapper: dispatches async, waits for completion

  Each execution gets its own supervised Bridge process so one blocked
  execution cannot starve others. The DynamicSupervisor caps concurrency
  to 10 running at once.

  PubSub event flow:
    - dispatch_async broadcasts "execution_started" to "executions:{id}"
    - Bridge process broadcasts stream events to "executions:{id}:stream"
    - On completion, "execution_done" is broadcast to "executions:{id}"
  """

  require Logger

  @max_concurrent 10
  @supervisor Ema.Claude.ExecutionSupervisor

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  @doc """
  Dispatch a prompt asynchronously for an execution.
  Returns {:ok, execution_id} immediately. Results arrive via PubSub.

  Options:
    - :execution_id — string id for routing (generated if absent)
    - :project_path — working directory for Claude CLI
    - :model — Claude model (default: "sonnet")
    - :proposal_id — broadcasts stage updates to "proposal:<id>"
  """
  def dispatch_async(prompt, opts \\ []) when is_binary(prompt) do
    execution_id = Keyword.get(opts, :execution_id, generate_id("exec"))

    if at_capacity?() do
      Logger.warning("[ExecutionBridge] At capacity (#{@max_concurrent} concurrent). Rejecting #{execution_id}.")
      {:error, :at_capacity}
    else
      bridge_opts = [
        execution_id: execution_id,
        project_path: Keyword.get(opts, :project_path, System.get_env("HOME")),
        model: Keyword.get(opts, :model, "sonnet"),
        proposal_id: Keyword.get(opts, :proposal_id)
      ]

      case DynamicSupervisor.start_child(@supervisor, {__MODULE__.Worker, bridge_opts}) do
        {:ok, pid} ->
          Task.start(fn ->
            __MODULE__.Worker.run(pid, prompt)
          end)

          broadcast(execution_id, :execution_started, %{
            execution_id: execution_id,
            timestamp: DateTime.utc_now()
          })

          {:ok, execution_id}

        {:error, reason} ->
          Logger.error("[ExecutionBridge] Failed to start worker: #{inspect(reason)}")
          {:error, reason}
      end
    end
  end

  @doc """
  Backward-compatible synchronous wrapper.
  Dispatches async and waits for completion (up to timeout_ms).

  Replaces Ema.Claude.Runner.run/2 call sites.
  """
  def run_sync(prompt, opts \\ []) when is_binary(prompt) do
    timeout_ms = Keyword.get(opts, :timeout, 120_000)
    execution_id = Keyword.get(opts, :execution_id, generate_id("sync"))
    opts = Keyword.put(opts, :execution_id, execution_id)

    caller = self()
    Phoenix.PubSub.subscribe(Ema.PubSub, "executions:#{execution_id}")

    case dispatch_async(prompt, opts) do
      {:ok, ^execution_id} ->
        receive do
          {:execution_event, %{type: :done, result: result}} ->
            Phoenix.PubSub.unsubscribe(Ema.PubSub, "executions:#{execution_id}")
            {:ok, result}

          {:execution_event, %{type: :error, error: reason}} ->
            Phoenix.PubSub.unsubscribe(Ema.PubSub, "executions:#{execution_id}")
            {:error, reason}
        after
          timeout_ms ->
            Phoenix.PubSub.unsubscribe(Ema.PubSub, "executions:#{execution_id}")
            {:error, %{reason: :timeout, timeout_ms: timeout_ms}}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc "Return the count of currently running execution bridges."
  def active_count do
    DynamicSupervisor.count_children(@supervisor).active
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp at_capacity? do
    active_count() >= @max_concurrent
  end

  defp broadcast(execution_id, type, payload) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "executions:#{execution_id}",
      {:execution_event, Map.put(payload, :type, type)}
    )
  end

  defp generate_id(prefix) do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{ts}_#{rand}"
  end
end

defmodule Ema.Claude.ExecutionBridge.Worker do
  @moduledoc """
  A single Bridge worker for one execution.
  Spawned by ExecutionBridge.dispatch_async/2, supervised by ExecutionSupervisor.
  """

  use GenServer
  require Logger

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts)
  end

  def run(pid, prompt) do
    GenServer.call(pid, {:run, prompt}, :infinity)
  end

  @impl true
  def init(opts) do
    state = %{
      execution_id: Keyword.fetch!(opts, :execution_id),
      project_path: Keyword.get(opts, :project_path, System.get_env("HOME")),
      model: Keyword.get(opts, :model, "sonnet"),
      proposal_id: Keyword.get(opts, :proposal_id)
    }

    {:ok, state}
  end

  @impl true
  def handle_call({:run, prompt}, _from, state) do
    Logger.info("[ExecutionBridge.Worker] Running #{state.execution_id}")

    result =
      Ema.Claude.Bridge.run(prompt,
        model: state.model,
        proposal_id: state.proposal_id
      )

    event_type = if match?({:ok, _}, result), do: :done, else: :error

    payload =
      case result do
        {:ok, data} -> %{type: event_type, execution_id: state.execution_id, result: data}
        {:error, reason} -> %{type: event_type, execution_id: state.execution_id, error: reason}
      end

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "executions:#{state.execution_id}",
      {:execution_event, payload}
    )

    {:reply, result, state}
  end
end
