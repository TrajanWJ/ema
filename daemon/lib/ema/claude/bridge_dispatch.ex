defmodule Ema.Claude.BridgeDispatch do
  @moduledoc """
  Async Claude dispatch with request tracking, timeouts, and retries.

  Owns the lifecycle of in-flight AI requests: dispatches them via
  `Ema.Claude.AI.run/2`, tracks progress, enforces timeouts, retries
  on failure with exponential backoff, and delivers standardized
  callback payloads through PubSub.

  ## Usage

      {:ok, request_id} = BridgeDispatch.dispatch_async("summarize this", [
        proposal_id: "prop_123",
        callback_topic: "proposal:prop_123",
        callback_event: :ai_result,
        timeout_ms: 45_000,
        max_retries: 3
      ])

      # Subscribe to per-request updates:
      Phoenix.PubSub.subscribe(Ema.PubSub, "bridge_dispatch:\#{request_id}")

  ## Callback payload

      %{
        request_id: String.t(),
        status: :ok | :error | :timeout | :retrying,
        result: map() | nil,
        error: term() | nil,
        retry_count: non_neg_integer(),
        proposal_id: String.t() | nil,
        execution_id: String.t() | nil,
        session_id: String.t() | nil,
        finished_at: DateTime.t() | nil
      }
  """

  use GenServer
  require Logger

  @default_timeout_ms 30_000
  @default_max_retries 2
  @backoff_schedule [1_000, 3_000]

  # --- Types ---

  @type request_id :: String.t()

  @type request :: %{
          request_id: request_id(),
          prompt: String.t(),
          opts: keyword(),
          callback_topic: String.t() | nil,
          callback_event: atom(),
          proposal_id: String.t() | nil,
          execution_id: String.t() | nil,
          session_id: String.t() | nil,
          inserted_at: DateTime.t(),
          timeout_ms: pos_integer(),
          retry_count: non_neg_integer(),
          max_retries: non_neg_integer(),
          status: :pending | :running | :retrying | :done | :failed | :timed_out,
          timer_ref: reference() | nil,
          task_ref: reference() | nil,
          attempt_id: String.t() | nil
        }

  # --- Public API ---

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Dispatch a prompt asynchronously. Returns `{:ok, request_id}` immediately.

  ## Options

    * `:request_id` - caller-supplied id (generated if absent)
    * `:proposal_id` - associated proposal
    * `:execution_id` - associated execution
    * `:session_id` - session identifier
    * `:callback_topic` - PubSub topic for result delivery (in addition to per-request topic)
    * `:callback_event` - atom used as event key on callback_topic (default `:ai_result`)
    * `:timeout_ms` - per-attempt timeout (default #{@default_timeout_ms})
    * `:max_retries` - retry budget (default #{@default_max_retries})
    * `:model` - passed through to AI backend
    * `:task_type` - passed through to AI backend
  """
  @spec dispatch_async(String.t(), keyword()) :: {:ok, request_id()}
  def dispatch_async(prompt, opts \\ []) when is_binary(prompt) do
    request_id = Keyword.get(opts, :request_id, generate_id())
    GenServer.cast(__MODULE__, {:dispatch, request_id, prompt, opts})
    {:ok, request_id}
  end

  @doc "Get the current state of a tracked request."
  @spec get_request(request_id()) :: {:ok, request()} | :not_found
  def get_request(request_id) do
    GenServer.call(__MODULE__, {:get_request, request_id})
  end

  @doc "Cancel a pending or running request."
  @spec cancel(request_id()) :: :ok | :not_found
  def cancel(request_id) do
    GenServer.call(__MODULE__, {:cancel, request_id})
  end

  @doc "List all in-flight requests (for diagnostics)."
  @spec list_active() :: [request()]
  def list_active do
    GenServer.call(__MODULE__, :list_active)
  end

  # --- Callbacks ---

  @impl true
  def init(_opts) do
    {:ok, %{requests: %{}}}
  end

  @impl true
  def handle_cast({:dispatch, request_id, prompt, opts}, state) do
    request = build_request(request_id, prompt, opts)
    state = put_in(state, [:requests, request_id], request)
    state = launch_attempt(state, request_id)
    {:noreply, state}
  end

  @impl true
  def handle_call({:get_request, request_id}, _from, state) do
    case Map.get(state.requests, request_id) do
      nil -> {:reply, :not_found, state}
      req -> {:reply, {:ok, sanitize_request(req)}, state}
    end
  end

  @impl true
  def handle_call({:cancel, request_id}, _from, state) do
    case Map.get(state.requests, request_id) do
      nil ->
        {:reply, :not_found, state}

      req ->
        cancel_timer(req.timer_ref)
        state = put_in(state, [:requests, request_id, :status], :failed)

        publish_callback(req, %{
          status: :error,
          error: :cancelled,
          finished_at: DateTime.utc_now()
        })

        state = cleanup_request(state, request_id)
        {:reply, :ok, state}
    end
  end

  @impl true
  def handle_call(:list_active, _from, state) do
    active =
      state.requests
      |> Map.values()
      |> Enum.filter(&(&1.status in [:pending, :running, :retrying]))
      |> Enum.map(&sanitize_request/1)

    {:reply, active, state}
  end

  # Task completed successfully
  @impl true
  def handle_info({ref, {:ok, result}}, state) when is_reference(ref) do
    Process.demonitor(ref, [:flush])

    case find_request_by_task_ref(state, ref) do
      nil ->
        {:noreply, state}

      {request_id, req} ->
        # Check this is still the current attempt (idempotency)
        if req.status in [:running, :retrying] do
          cancel_timer(req.timer_ref)

          state =
            put_in(state, [:requests, request_id], %{
              req
              | status: :done,
                timer_ref: nil,
                task_ref: nil
            })

          publish_callback(req, %{
            status: :ok,
            result: result,
            finished_at: DateTime.utc_now()
          })

          state = cleanup_request(state, request_id)
          {:noreply, state}
        else
          # Late completion for superseded attempt -- ignore
          {:noreply, state}
        end
    end
  end

  # Task failed
  @impl true
  def handle_info({ref, {:error, reason}}, state) when is_reference(ref) do
    Process.demonitor(ref, [:flush])

    case find_request_by_task_ref(state, ref) do
      nil ->
        {:noreply, state}

      {request_id, req} ->
        if req.status in [:running, :retrying] do
          cancel_timer(req.timer_ref)
          state = handle_failure(state, request_id, req, reason)
          {:noreply, state}
        else
          {:noreply, state}
        end
    end
  end

  # Task process crashed
  @impl true
  def handle_info({:DOWN, ref, :process, _pid, reason}, state) when reason != :normal do
    case find_request_by_task_ref(state, ref) do
      nil ->
        {:noreply, state}

      {request_id, req} ->
        if req.status in [:running, :retrying] do
          cancel_timer(req.timer_ref)
          state = handle_failure(state, request_id, req, {:crashed, reason})
          {:noreply, state}
        else
          {:noreply, state}
        end
    end
  end

  # Timeout fired
  @impl true
  def handle_info({:timeout, request_id, attempt_id}, state) do
    case Map.get(state.requests, request_id) do
      %{attempt_id: ^attempt_id, status: status} = req when status in [:running, :retrying] ->
        Logger.warning(
          "[BridgeDispatch] Timeout for #{request_id} (attempt #{req.retry_count + 1}/#{req.max_retries + 1})"
        )

        state = handle_failure(state, request_id, req, :timeout)
        {:noreply, state}

      _ ->
        # Stale timer for a superseded attempt
        {:noreply, state}
    end
  end

  # Handle scheduled retry
  @impl true
  def handle_info({:retry, request_id}, state) do
    case Map.get(state.requests, request_id) do
      %{status: status} when status in [:running, :retrying, :pending] ->
        # Still needs retrying -- status was updated in handle_failure
        state = launch_attempt(state, request_id)
        {:noreply, state}

      _ ->
        # Request was cancelled or already completed
        {:noreply, state}
    end
  end

  # Deferred cleanup of finished requests
  @impl true
  def handle_info({:cleanup, request_id}, state) do
    {:noreply, %{state | requests: Map.delete(state.requests, request_id)}}
  end

  # Catch-all for normal :DOWN messages and other info
  @impl true
  def handle_info(_msg, state) do
    {:noreply, state}
  end

  # --- Internal ---

  defp build_request(request_id, prompt, opts) do
    %{
      request_id: request_id,
      prompt: prompt,
      opts:
        Keyword.drop(opts, [
          :request_id,
          :callback_topic,
          :callback_event,
          :timeout_ms,
          :max_retries,
          :proposal_id,
          :execution_id,
          :session_id
        ]),
      callback_topic: Keyword.get(opts, :callback_topic),
      callback_event: Keyword.get(opts, :callback_event, :ai_result),
      proposal_id: Keyword.get(opts, :proposal_id),
      execution_id: Keyword.get(opts, :execution_id),
      session_id: Keyword.get(opts, :session_id),
      inserted_at: DateTime.utc_now(),
      timeout_ms: Keyword.get(opts, :timeout_ms, @default_timeout_ms),
      retry_count: 0,
      max_retries: Keyword.get(opts, :max_retries, @default_max_retries),
      status: :pending,
      timer_ref: nil,
      task_ref: nil,
      attempt_id: nil
    }
  end

  defp launch_attempt(state, request_id) do
    req = Map.fetch!(state.requests, request_id)

    attempt_id = generate_id()

    # Start the AI call in a monitored task
    task =
      Task.Supervisor.async_nolink(Ema.TaskSupervisor, fn ->
        Ema.Claude.AI.run(req.prompt, req.opts)
      end)

    # Schedule timeout
    timer_ref =
      Process.send_after(self(), {:timeout, request_id, attempt_id}, req.timeout_ms)

    status = if req.retry_count > 0, do: :retrying, else: :running

    # Publish progress event
    publish_callback(req, %{
      status: status,
      retry_count: req.retry_count
    })

    put_in(state, [:requests, request_id], %{
      req
      | status: status,
        timer_ref: timer_ref,
        task_ref: task.ref,
        attempt_id: attempt_id
    })
  end

  defp handle_failure(state, request_id, req, reason) do
    if req.retry_count < req.max_retries do
      # Retry with backoff
      backoff_ms = backoff_for(req.retry_count)

      Logger.info(
        "[BridgeDispatch] Retrying #{request_id} in #{backoff_ms}ms " <>
          "(attempt #{req.retry_count + 2}/#{req.max_retries + 1})"
      )

      req = %{req | retry_count: req.retry_count + 1, timer_ref: nil, task_ref: nil}
      state = put_in(state, [:requests, request_id], req)

      # Schedule retry after backoff
      Process.send_after(self(), {:retry, request_id}, backoff_ms)
      state
    else
      # Exhausted retries
      Logger.warning(
        "[BridgeDispatch] #{request_id} failed after #{req.retry_count + 1} attempts: #{inspect(reason)}"
      )

      state =
        put_in(state, [:requests, request_id], %{
          req
          | status: :failed,
            timer_ref: nil,
            task_ref: nil
        })

      publish_callback(req, %{
        status: :error,
        error: reason,
        finished_at: DateTime.utc_now()
      })

      cleanup_request(state, request_id)
    end
  end

  defp backoff_for(retry_index) do
    Enum.at(@backoff_schedule, retry_index, List.last(@backoff_schedule))
  end

  defp find_request_by_task_ref(state, ref) do
    Enum.find(state.requests, fn {_id, req} -> req.task_ref == ref end)
  end

  defp publish_callback(req, payload) do
    base = %{
      request_id: req.request_id,
      status: nil,
      result: nil,
      error: nil,
      retry_count: req.retry_count,
      proposal_id: req.proposal_id,
      execution_id: req.execution_id,
      session_id: req.session_id,
      finished_at: nil
    }

    msg = Map.merge(base, payload)

    # Always publish to the per-request topic
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "bridge_dispatch:#{req.request_id}",
      {req.callback_event, msg}
    )

    # Also publish to the caller-specified topic if provided
    if req.callback_topic do
      Phoenix.PubSub.broadcast(
        Ema.PubSub,
        req.callback_topic,
        {req.callback_event, msg}
      )
    end

    :ok
  end

  defp cancel_timer(nil), do: :ok

  defp cancel_timer(ref) do
    Process.cancel_timer(ref)
    :ok
  end

  defp cleanup_request(state, request_id) do
    # Remove completed/failed requests from state after a short delay
    # to allow late get_request calls. We schedule cleanup rather than
    # removing immediately so callers can still query the final status.
    Process.send_after(self(), {:cleanup, request_id}, 60_000)
    state
  end

  defp sanitize_request(req) do
    Map.drop(req, [:timer_ref, :task_ref, :attempt_id])
  end

  defp generate_id do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "bdsp_#{ts}_#{rand}"
  end
end
