defmodule Ema.Claude.Bridge do
  @moduledoc """
  GenServer managing a Claude CLI subprocess as a Port with bidirectional streaming.

  Starts Claude CLI with `--output-format stream-json --input-format stream-json`
  and provides APIs for one-shot runs, streaming with callbacks, and multi-turn send.

  Broadcasts parsed events via PubSub to `ema:claude:events`.
  """

  use GenServer
  require Logger

  alias Ema.Claude.StreamParser

  @pubsub_topic "ema:claude:events"
  @default_model "sonnet"

  # --- Public API ---

  @doc """
  Start a Bridge process linked to a Claude CLI subprocess.

  Options:
    - :project_path - working directory for the CLI (required)
    - :model - Claude model to use (default: "sonnet")
    - :session_id - session identifier for PubSub routing
    - :name - GenServer name registration
  """
  def start_link(opts) do
    name = Keyword.get(opts, :name)
    gen_opts = if name, do: [name: name], else: []
    GenServer.start_link(__MODULE__, opts, gen_opts)
  end

  @doc """
  Send a one-shot prompt and collect the full result.
  Blocks until the CLI returns a result or times out.
  """
  def call(pid, prompt, timeout \\ 120_000) do
    GenServer.call(pid, {:call, prompt}, timeout)
  end

  @doc """
  Run a prompt through the Claude bridge with PubSub streaming and telemetry.
  Maintains API compatibility with Ema.Claude.Runner.run/2.

  Options:
    - :model - model to use (default: "sonnet")
    - :timeout - timeout ms (default: 120_000)
    - :proposal_id - broadcasts stage updates to "proposal:<id>"
    - :agent_id - for telemetry (default: "system")
    - :task_type - for telemetry (default: "general")
  """
  @spec run(String.t(), keyword()) :: {:ok, map()} | {:error, map()}
  def run(prompt, opts \\ []) when is_binary(prompt) and is_list(opts) do
    model = Keyword.get(opts, :model, @default_model)
    timeout = Keyword.get(opts, :timeout, 120_000)
    proposal_id = Keyword.get(opts, :proposal_id)
    agent_id = Keyword.get(opts, :agent_id, "system")
    task_type = Keyword.get(opts, :task_type, "general")
    started_at = System.monotonic_time(:millisecond)

    with :ok <- maybe_broadcast_stage(proposal_id, "generating"),
         {:ok, result} <- do_run(prompt, model, timeout),
         :ok <- maybe_broadcast_stage(proposal_id, "complete") do
      elapsed_ms = System.monotonic_time(:millisecond) - started_at
      log_usage_async(agent_id, task_type, model, elapsed_ms)
      {:ok, result}
    else
      {:error, reason} ->
        maybe_broadcast_stage(proposal_id, "error")
        {:error, reason}
    end
  end

  @doc """
  Async version of run/2. Returns {:ok, task_id} immediately.
  Broadcasts result to "claude:task:<task_id>" when done.
  Optional on_complete callback is called with the result.
  """
  @spec spawn_async(String.t(), keyword(), (any() -> any()) | nil) ::
          {:ok, String.t()} | {:error, any()}
  def spawn_async(prompt, opts \\ [], on_complete \\ nil)
      when is_binary(prompt) and is_list(opts) do
    task_id = generate_task_id()

    Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
      result = run(prompt, opts)

      Phoenix.PubSub.broadcast(
        Ema.PubSub,
        "claude:task:#{task_id}",
        {:done, task_id, result}
      )

      if is_function(on_complete, 1), do: on_complete.(result)
    end)

    {:ok, task_id}
  end

  @doc """
  Non-blocking Bridge dispatch with caller_pid OR callback support.

  Canonical async API (Week 7 B3). Returns `{:ok, task_id}` immediately.
  Result is delivered in two ways:
    1. PubSub broadcast to `"claude:task:<task_id>"` as `{:done, task_id, result}`
    2. If `callback_or_pid` is a function/1: called with the result
    3. If `callback_or_pid` is a pid: `send(pid, {:bridge_result, task_id, result})`

  ## Options
    Same as `run/2` — :model, :timeout, :proposal_id, :agent_id, :task_type

  ## Examples

      # Fire-and-forget with PubSub result
      {:ok, task_id} = Bridge.run_async("summarize this", [model: "haiku"])
      Phoenix.PubSub.subscribe(Ema.PubSub, "claude:task:" <> task_id)
      # receive {:done, ^task_id, result} -> ...

      # Callback style
      {:ok, _task_id} = Bridge.run_async("parse this", [], fn
        {:ok, result} -> handle_result(result)
        {:error, reason} -> Logger.error("AI failed: " <> inspect(reason))
      end)

      # Caller PID (message-passing)
      {:ok, task_id} = Bridge.run_async("analyze this", [], self())
      # receive {:bridge_result, ^task_id, {:ok, result}} -> ...
  """
  @spec run_async(String.t(), keyword(), (any() -> any()) | pid() | nil) :: {:ok, String.t()}
  def run_async(prompt, opts \\ [], callback_or_pid \\ nil)
      when is_binary(prompt) and is_list(opts) do
    task_id = generate_task_id()

    Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
      result = run(prompt, opts)

      # 1. Always broadcast via PubSub
      Phoenix.PubSub.broadcast(
        Ema.PubSub,
        "claude:task:#{task_id}",
        {:done, task_id, result}
      )

      # 2. Deliver via callback or pid if provided
      case callback_or_pid do
        nil ->
          :ok

        f when is_function(f, 1) ->
          f.(result)

        pid when is_pid(pid) ->
          send(pid, {:bridge_result, task_id, result})
      end
    end)

    {:ok, task_id}
  end

  @doc """
  Send a prompt and stream events to a callback function.
  The callback receives tagged tuples from StreamParser.
  Returns immediately; events arrive asynchronously.
  """
  def stream(pid, prompt, callback) when is_function(callback, 1) do
    GenServer.cast(pid, {:stream, prompt, callback})
  end

  @doc """
  Send a follow-up message in multi-turn mode.
  """
  def send_message(pid, message) do
    GenServer.cast(pid, {:send, message})
  end

  @doc "Stop the bridge and its CLI subprocess."
  def stop(pid) do
    GenServer.stop(pid, :normal)
  end

  @doc "Get the PubSub topic for claude bridge events."
  def pubsub_topic, do: @pubsub_topic

  # --- Callbacks ---

  @impl true
  def init(opts) do
    project_path = Keyword.fetch!(opts, :project_path)
    model = Keyword.get(opts, :model, @default_model)
    session_id = Keyword.get(opts, :session_id, generate_session_id())

    state = %{
      project_path: project_path,
      model: model,
      session_id: session_id,
      port: nil,
      buffer: "",
      callback: nil,
      collect: nil
    }

    {:ok, state}
  end

  @impl true
  def handle_call({:call, prompt}, from, state) do
    port = open_port(state)

    send_to_port(port, prompt)

    {:noreply, %{state | port: port, collect: %{from: from, events: []}, callback: nil}}
  end

  @impl true
  def handle_cast({:stream, prompt, callback}, state) do
    port = open_port(state)

    send_to_port(port, prompt)

    {:noreply, %{state | port: port, callback: callback, collect: nil}}
  end

  @impl true
  def handle_cast({:send, message}, %{port: port} = state) when port != nil do
    send_to_port(port, message)
    {:noreply, state}
  end

  @impl true
  def handle_cast({:send, _message}, state) do
    Logger.warning("[Bridge] Cannot send message — no active port")
    {:noreply, state}
  end

  @impl true
  def handle_info({port, {:data, data}}, %{port: port} = state) do
    # Port data arrives as charlist or binary depending on options
    chunk = IO.iodata_to_binary(data)
    buffer = state.buffer <> chunk

    # Split on newlines; keep last incomplete line in buffer
    {complete_lines, remainder} = split_buffer(buffer)

    events = StreamParser.parse_chunk(Enum.join(complete_lines, "\n"))

    state = %{state | buffer: remainder}

    # Dispatch events
    Enum.each(events, fn event ->
      broadcast(state.session_id, event)

      if state.callback, do: state.callback.(event)
    end)

    # Collect events for synchronous run/2
    state =
      case state.collect do
        %{events: acc} = collect ->
          %{state | collect: %{collect | events: acc ++ events}}

        nil ->
          state
      end

    {:noreply, state}
  end

  @impl true
  def handle_info({port, {:exit_status, status}}, %{port: port} = state) do
    Logger.info("[Bridge] CLI exited with status #{status} (session: #{state.session_id})")

    broadcast(state.session_id, {:exit, %{status: status}})

    if state.callback, do: state.callback.({:exit, %{status: status}})

    # Reply to synchronous caller if collecting
    state =
      case state.collect do
        %{from: from, events: events} ->
          result = extract_result(events, status)
          GenServer.reply(from, result)
          %{state | collect: nil}

        nil ->
          state
      end

    {:noreply, %{state | port: nil, buffer: "", callback: nil}}
  end

  @impl true
  def handle_info({:EXIT, port, reason}, %{port: port} = state) do
    Logger.info("[Bridge] Port terminated: #{inspect(reason)} (session: #{state.session_id})")
    broadcast(state.session_id, {:exit, %{reason: reason}})

    case state.collect do
      %{from: from} ->
        GenServer.reply(from, {:error, %{reason: :port_exit, detail: reason}})

      nil ->
        :ok
    end

    {:noreply, %{state | port: nil, buffer: "", callback: nil, collect: nil}}
  end

  @impl true
  def handle_info(_msg, state) do
    {:noreply, state}
  end

  @impl true
  def terminate(_reason, %{port: port}) when port != nil do
    Port.close(port)
    :ok
  end

  def terminate(_reason, _state), do: :ok

  defp do_run(prompt, model, timeout) do
    case GenServer.whereis(__MODULE__) do
      nil ->
        Ema.Claude.Runner.run(prompt, model: model, timeout: timeout)

      pid ->
        case __MODULE__.call(pid, prompt, timeout) do
          {:ok, %{text: text}} -> {:ok, %{"result" => text}}
          {:ok, result} -> {:ok, result}
          {:error, _} = error -> error
        end
    end
  end

  defp maybe_broadcast_stage(nil, _stage), do: :ok

  defp maybe_broadcast_stage(proposal_id, stage) when is_binary(proposal_id) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "proposal:#{proposal_id}",
      {:streaming_stage, stage}
    )

    :ok
  end

  defp log_usage_async(agent_id, task_type, model, elapsed_ms) do
    Task.start(fn ->
      attrs = %{
        agent_id: agent_id,
        task_type: task_type,
        model: model,
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: Decimal.new("0.00"),
        metadata: %{elapsed_ms: elapsed_ms}
      }

      case Ema.Repo.insert(
             Ema.Intelligence.UsageRecord.changeset(
               %Ema.Intelligence.UsageRecord{},
               attrs
             )
           ) do
        {:ok, _} ->
          :ok

        {:error, reason} ->
          Logger.debug("[Bridge] Usage log skipped: #{inspect(reason)}")
      end
    end)
  end

  # --- Internal ---

  defp open_port(%{project_path: project_path, model: model}) do
    wrapper_path = "/home/trajan/bin/claude-wrapper.sh"
    claude_path = Ema.Claude.Runner.resolve_claude_path()

    args = [
      claude_path,
      "--print",
      "--verbose",
      "--output-format",
      "stream-json",
      "--input-format",
      "stream-json",
      "--model",
      model,
      "--permission-mode",
      "bypassPermissions"
    ]

    Port.open(
      {:spawn_executable, wrapper_path},
      [
        :binary,
        :exit_status,
        :use_stdio,
        :stderr_to_stdout,
        args: args,
        cd: project_path
      ]
    )
  end

  defp send_to_port(port, message) when is_binary(message) do
    payload = Jason.encode!(%{"type" => "user", "content" => message})
    Port.command(port, payload <> "\n")
  end

  defp split_buffer(buffer) do
    lines = String.split(buffer, "\n")

    case List.last(lines) do
      "" ->
        # Buffer ended with newline — all lines complete
        {Enum.slice(lines, 0..-2//1), ""}

      incomplete ->
        {Enum.slice(lines, 0..-2//1), incomplete}
    end
  end

  defp extract_result(events, exit_status) do
    result_event =
      Enum.find(events, fn
        {:result, _} -> true
        {:error, _} -> true
        _ -> false
      end)

    case result_event do
      {:result, data} -> {:ok, data}
      {:error, data} -> {:error, data}
      nil when exit_status == 0 -> {:ok, %{events: events}}
      nil -> {:error, %{exit_status: exit_status, events: events}}
    end
  end

  defp broadcast(session_id, event) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      @pubsub_topic,
      {:claude_event, session_id, event}
    )
  end

  defp generate_session_id do
    ts = System.system_time(:second)
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "bridge_#{ts}_#{rand}"
  end

  defp generate_task_id do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "ctask_#{ts}_#{rand}"
  end
end
