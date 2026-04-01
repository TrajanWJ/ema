defmodule Ema.Claude.Bridge do
  @moduledoc """
  OTP-managed bridge to AI backends via the SmartRouter.

  Acts as the main entry point for all AI interactions in EMA. Routes
  requests through SmartRouter for intelligent provider/account/model
  selection, then executes via the appropriate adapter.

  Backward-compatible with the original single-backend Bridge API:
  `run/2`, `stream/2`, `start_session/1`, `send_message/3`, `end_session/1`

  ## Architecture

  1. Prompt comes in via `run/2` or `stream/2`
  2. Task type is classified (or accepted via opts)
  3. SmartRouter picks the best provider + account + model
  4. The provider's adapter executes the request
  5. StreamParser normalizes events across all adapters
  6. Events are broadcast via Phoenix.PubSub on "claude:events"
  7. CircuitBreaker and CostTracker record the outcome

  ## Usage

      # Blocking one-shot (backward-compatible with Runner)
      {:ok, result} = Bridge.run("analyze this", model: "sonnet")

      # With explicit task type for better routing
      {:ok, result} = Bridge.run("implement a parser",
        task_type: :code_generation, strategy: :best)

      # Streaming with real-time events
      Bridge.stream("generate proposal", model: "opus",
        on_event: fn event -> broadcast(event) end)

      # Multi-turn session
      {:ok, sid} = Bridge.start_session(model: "opus", project_dir: "/path")
      Bridge.send_message(sid, "generate a proposal")
      Bridge.send_message(sid, "now refine it")
      Bridge.end_session(sid)

      # Force a specific provider
      {:ok, result} = Bridge.run("quick task",
        provider_id: "ollama-local", model: "llama3.3")

      # Cost estimation before running
      {:ok, estimates} = Bridge.estimate_cost("big prompt", :code_generation)
  """

  use GenServer
  require Logger

  alias Ema.Claude.{
    StreamParser,
    CircuitBreaker,
    CostTracker,
    Governance,
    SmartRouter,
    ProviderRegistry,
    AccountManager
  }

  @default_model "sonnet"
  @default_timeout 300_000

  defstruct [
    :port,
    :session_id,
    :model,
    :provider_id,
    :account_id,
    :adapter_module,
    :project_dir,
    :started_at,
    :caller,
    :on_event,
    :status,
    :task_type,
    buffer: "",
    text_acc: "",
    tool_calls: [],
    cost: nil,
    input_tokens: 0,
    output_tokens: 0
  ]

  # ── Client API ─────────────────────────────────────────────────────────────

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Run a one-shot prompt through the best available AI backend.

  Uses SmartRouter to select the optimal provider, account, and model.
  Blocks until completion.

  ## Options
    - `:model`         — force a specific model
    - `:provider_id`   — force a specific provider
    - `:task_type`     — override auto-detected task type
    - `:strategy`      — override default routing strategy
    - `:timeout`       — execution timeout in ms (default: 300_000)
    - `:on_event`      — streaming callback fn/1
    - `:project_dir`   — working directory for code-aware models
  """
  def run(prompt, opts \\ []) do
    timeout = Keyword.get(opts, :timeout, @default_timeout)

    case CircuitBreaker.check() do
      :ok ->
        GenServer.call(__MODULE__, {:run, prompt, opts}, timeout)

      {:tripped, severity} ->
        {:error,
         %{
           code: :circuit_breaker,
           severity: severity,
           message: "Circuit breaker tripped (#{severity})"
         }}
    end
  end

  @doc """
  Run a prompt with streaming — calls on_event for each event.
  Functionally identical to `run/2` but ensures on_event is set.
  """
  def stream(prompt, opts \\ []) do
    timeout = Keyword.get(opts, :timeout, @default_timeout)
    GenServer.call(__MODULE__, {:stream, prompt, opts}, timeout)
  end

  @doc """
  Start a persistent multi-turn session. Returns session_id.

  The session maintains context across `send_message/3` calls
  using the adapter's native session mechanism (e.g. --session-id
  for Claude CLI).
  """
  def start_session(opts \\ []) do
    GenServer.call(__MODULE__, {:start_session, opts})
  end

  @doc """
  Send a message to an active session.
  """
  def send_message(session_id, message, opts \\ []) do
    timeout = Keyword.get(opts, :timeout, @default_timeout)
    GenServer.call(__MODULE__, {:send_message, session_id, message, opts}, timeout)
  end

  @doc """
  End a session gracefully.
  """
  def end_session(session_id) do
    GenServer.cast(__MODULE__, {:end_session, session_id})
  end

  @doc """
  Estimate cost for a prompt across all available providers.
  Delegates to SmartRouter.estimate_cost/2.
  """
  def estimate_cost(prompt, task_type \\ :general) do
    SmartRouter.estimate_cost(prompt, task_type)
  end

  @doc """
  Classify a prompt's task type.
  Delegates to SmartRouter.classify_task/1.
  """
  def classify_task(prompt) do
    SmartRouter.classify_task(prompt)
  end

  @doc "Get status of all active sessions."
  def status do
    GenServer.call(__MODULE__, :status)
  end

  @doc "Get current routing statistics."
  def routing_stats do
    SmartRouter.stats()
  end

  # ── Backward compatibility ────────────────────────────────────────────────

  @doc "Check if any backend is available."
  def available? do
    case ProviderRegistry.list_available() do
      [] -> false
      _ -> true
    end
  end

  @doc """
  Switch backend mode — legacy compatibility.
  Deprecated: use provider_id option in run/2 instead.
  """
  def set_backend(mode) when mode in [:claude_cli, :openclaw] do
    Logger.warning("[Bridge] set_backend/1 is deprecated. Use provider_id option in run/2.")
    Ema.Claude.Backend.set_mode(mode)
  end

  @doc "Get current backend mode — legacy compatibility."
  def backend do
    Ema.Claude.Backend.mode()
  end

  # ── GenServer Callbacks ────────────────────────────────────────────────────

  @impl true
  def init(opts) do
    state = %{
      sessions: %{},
      config: %{
        default_model: Keyword.get(opts, :default_model, @default_model),
        plugin_dir: Keyword.get(opts, :plugin_dir),
        mcp_config: Keyword.get(opts, :mcp_config),
        permission_mode: Keyword.get(opts, :permission_mode, "bypassPermissions")
      },
      stats: %{total_runs: 0, total_tokens: 0, sessions_created: 0}
    }

    Logger.info("[Bridge] Multi-backend bridge started")
    {:ok, state}
  end

  @impl true
  def handle_call({:run, prompt, opts}, from, state) do
    session_id = Ecto.UUID.generate()
    task_type = Keyword.get(opts, :task_type) || SmartRouter.classify_task(prompt)
    on_event = Keyword.get(opts, :on_event)

    # Route through SmartRouter
    route_opts =
      [
        strategy: Keyword.get(opts, :strategy),
        model: Keyword.get(opts, :model),
        provider_id: Keyword.get(opts, :provider_id),
        exclude_providers: Keyword.get(opts, :exclude_providers, [])
      ]
      |> Enum.reject(fn {_, v} -> is_nil(v) end)

    case SmartRouter.route(prompt, task_type, route_opts) do
      {:ok, target} ->
        # Execute via the selected adapter
        adapter = target.adapter_module
        project_dir = Keyword.get(opts, :project_dir)

        adapter_opts = [
          account_id: target.account_id,
          project_dir: project_dir,
          on_event: on_event,
          caller: self(),
          permission_mode: state.config.permission_mode,
          plugin_dir: state.config.plugin_dir,
          mcp_config: state.config.mcp_config
        ]

        case adapter.start_session(prompt, session_id, target.model, adapter_opts) do
          {:ok, adapter_session} ->
            session = %__MODULE__{
              port: Map.get(adapter_session, :port),
              session_id: session_id,
              model: target.model,
              provider_id: target.provider_id,
              account_id: target.account_id,
              adapter_module: adapter,
              project_dir: project_dir,
              started_at: DateTime.utc_now(),
              caller: from,
              on_event: on_event,
              status: :running,
              task_type: task_type
            }

            Governance.log_session_start(session_id, target.model, project_dir)

            broadcast("claude:session_started", %{
              session_id: session_id,
              model: target.model,
              provider_id: target.provider_id,
              task_type: task_type,
              routing_reason: target.routing_reason
            })

            sessions = Map.put(state.sessions, session_id, session)
            stats = %{state.stats | total_runs: state.stats.total_runs + 1}
            {:noreply, %{state | sessions: sessions, stats: stats}}

          {:error, reason} ->
            {:reply,
             {:error,
              %{
                code: :adapter_spawn_failed,
                reason: inspect(reason),
                provider_id: target.provider_id
              }}, state}
        end

      {:error, reason} ->
        {:reply, {:error, %{code: :routing_failed, reason: reason}}, state}
    end
  end

  @impl true
  def handle_call({:stream, prompt, opts}, from, state) do
    on_event = Keyword.get(opts, :on_event, fn _e -> :ok end)
    opts = Keyword.put(opts, :on_event, on_event)
    handle_call({:run, prompt, opts}, from, state)
  end

  @impl true
  def handle_call({:start_session, opts}, _from, state) do
    session_id = Keyword.get_lazy(opts, :session_id, &Ecto.UUID.generate/0)
    model = Keyword.get(opts, :model, state.config.default_model)
    task_type = Keyword.get(opts, :task_type, :general)

    # Route to pick provider for the session
    route_opts =
      [
        model: model,
        provider_id: Keyword.get(opts, :provider_id)
      ]
      |> Enum.reject(fn {_, v} -> is_nil(v) end)

    case SmartRouter.route("", task_type, route_opts) do
      {:ok, target} ->
        session = %__MODULE__{
          session_id: session_id,
          model: target.model,
          provider_id: target.provider_id,
          account_id: target.account_id,
          adapter_module: target.adapter_module,
          project_dir: Keyword.get(opts, :project_dir),
          started_at: DateTime.utc_now(),
          status: :idle,
          task_type: task_type
        }

        sessions = Map.put(state.sessions, session_id, session)
        stats = %{state.stats | sessions_created: state.stats.sessions_created + 1}
        {:reply, {:ok, session_id}, %{state | sessions: sessions, stats: stats}}

      {:error, reason} ->
        {:reply, {:error, %{code: :routing_failed, reason: reason}}, state}
    end
  end

  @impl true
  def handle_call({:send_message, session_id, message, opts}, from, state) do
    case Map.get(state.sessions, session_id) do
      nil ->
        {:reply, {:error, :session_not_found}, state}

      %{status: :running} ->
        {:reply, {:error, :session_busy}, state}

      session ->
        adapter = session.adapter_module
        on_event = Keyword.get(opts, :on_event, session.on_event)

        adapter_opts = [
          account_id: session.account_id,
          project_dir: session.project_dir,
          on_event: on_event,
          caller: self(),
          permission_mode: state.config.permission_mode
        ]

        case adapter.start_session(message, session_id, session.model, adapter_opts) do
          {:ok, adapter_session} ->
            updated = %{
              session
              | port: Map.get(adapter_session, :port),
                caller: from,
                on_event: on_event,
                status: :running,
                buffer: "",
                text_acc: "",
                tool_calls: []
            }

            {:noreply, %{state | sessions: Map.put(state.sessions, session_id, updated)}}

          {:error, reason} ->
            {:reply, {:error, %{code: :adapter_spawn_failed, reason: inspect(reason)}}, state}
        end
    end
  end

  @impl true
  def handle_call(:status, _from, state) do
    session_summaries =
      state.sessions
      |> Enum.map(fn {id, s} ->
        %{
          id: id,
          model: s.model,
          status: s.status,
          provider_id: s.provider_id,
          task_type: s.task_type,
          started_at: s.started_at
        }
      end)

    {:reply, %{sessions: session_summaries, stats: state.stats}, state}
  end

  @impl true
  def handle_cast({:end_session, session_id}, state) do
    case Map.get(state.sessions, session_id) do
      %{adapter_module: adapter} = session when adapter != nil ->
        adapter.stop_session(session)
        {:noreply, %{state | sessions: Map.delete(state.sessions, session_id)}}

      _ ->
        {:noreply, %{state | sessions: Map.delete(state.sessions, session_id)}}
    end
  end

  # Handle adapter events forwarded from the read loop
  @impl true
  def handle_info({:adapter_event, event}, state) do
    # Find which session this event belongs to (from the calling context)
    # Adapter events come to self() because we pass caller: self()
    state = handle_adapter_event_for_sessions(event, state)
    {:noreply, state}
  end

  @impl true
  def handle_info({:adapter_done, result}, state) do
    session_id = Map.get(result, :session_id)
    exit_code = Map.get(result, :exit_code, 0)

    case find_running_session(state.sessions, session_id) do
      nil ->
        {:noreply, state}

      session ->
        final_result = %{
          session_id: session.session_id,
          text: session.text_acc,
          tool_calls: session.tool_calls,
          cost: session.cost,
          input_tokens: session.input_tokens,
          output_tokens: session.output_tokens,
          exit_code: exit_code,
          provider_id: session.provider_id,
          model: session.model,
          task_type: session.task_type
        }

        CostTracker.record(session.session_id, session.model, final_result)

        AccountManager.record_usage(session.account_id, %{
          input_tokens: session.input_tokens,
          output_tokens: session.output_tokens,
          cost_usd: session.cost || 0.0
        })

        broadcast("claude:session_ended", final_result)

        if session.caller do
          if exit_code == 0 do
            GenServer.reply(session.caller, {:ok, final_result})
            CircuitBreaker.record_success(session.session_id)
            AccountManager.record_success(session.account_id)
          else
            GenServer.reply(session.caller, {:error, %{code: exit_code, result: final_result}})
            CircuitBreaker.record_failure(session.session_id)
            AccountManager.record_error(session.account_id, {:exit_code, exit_code})
          end
        end

        updated = %{session | port: nil, status: :completed, caller: nil}
        {:noreply, %{state | sessions: Map.put(state.sessions, session.session_id, updated)}}
    end
  end

  @impl true
  def handle_info({:adapter_error, reason}, state) do
    # Find the most recent running session to attribute the error to
    case find_any_running_session(state.sessions) do
      nil ->
        Logger.error("[Bridge] Adapter error with no running session: #{inspect(reason)}")
        {:noreply, state}

      session ->
        AccountManager.record_error(session.account_id, reason)
        CircuitBreaker.record_failure(session.session_id)

        if session.caller do
          GenServer.reply(session.caller, {:error, %{code: :adapter_error, reason: reason}})
        end

        updated = %{session | status: :error, caller: nil}
        {:noreply, %{state | sessions: Map.put(state.sessions, session.session_id, updated)}}
    end
  end

  # Legacy Port output handler (for backward compat with direct Port spawns)
  @impl true
  def handle_info({port, {:data, data}}, state) when is_port(port) do
    session = find_session_by_port(state.sessions, port)

    if session do
      {events, remaining_buffer} = StreamParser.parse_chunk(session.buffer <> data)
      session = %{session | buffer: remaining_buffer}

      session =
        Enum.reduce(events, session, fn event, acc ->
          handle_stream_event(event, acc)
        end)

      sessions = Map.put(state.sessions, session.session_id, session)
      {:noreply, %{state | sessions: sessions}}
    else
      {:noreply, state}
    end
  end

  @impl true
  def handle_info({port, {:exit_status, exit_code}}, state) when is_port(port) do
    session = find_session_by_port(state.sessions, port)

    if session do
      send(self(), {:adapter_done, %{session_id: session.session_id, exit_code: exit_code}})
    end

    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # ── Private ────────────────────────────────────────────────────────────────

  defp handle_adapter_event_for_sessions(event, state) do
    # Find any running session to attribute this event to
    case find_any_running_session(state.sessions) do
      nil ->
        state

      session ->
        if session.on_event, do: session.on_event.(event)
        broadcast("claude:event", %{session_id: session.session_id, event: event})

        updated = apply_event_to_session(event, session)
        %{state | sessions: Map.put(state.sessions, session.session_id, updated)}
    end
  end

  defp apply_event_to_session(%{type: "text", content: text}, session) when is_binary(text) do
    %{session | text_acc: session.text_acc <> text}
  end

  defp apply_event_to_session(%{type: "tool_use", name: name, input: input}, session) do
    Governance.log_tool_call(session.session_id, name, input)
    %{session | tool_calls: session.tool_calls ++ [%{name: name, input: input}]}
  end

  defp apply_event_to_session(
         %{type: "usage", input_tokens: it, output_tokens: ot} = data,
         session
       ) do
    %{
      session
      | input_tokens: it || session.input_tokens,
        output_tokens: ot || session.output_tokens,
        cost: Map.get(data, :cost_usd, session.cost)
    }
  end

  defp apply_event_to_session(_event, session), do: session

  # Legacy handler for direct Port-based streaming
  defp handle_stream_event(event, session) do
    if session.on_event, do: session.on_event.(event)
    broadcast("claude:event", %{session_id: session.session_id, event: event})

    case event do
      %{type: "assistant", text: text} when is_binary(text) ->
        %{session | text_acc: session.text_acc <> text}

      %{type: "tool_use", name: name, input: input} ->
        Governance.log_tool_call(session.session_id, name, input)
        %{session | tool_calls: session.tool_calls ++ [%{name: name, input: input}]}

      %{type: "result", cost: cost, input_tokens: it, output_tokens: ot} ->
        %{session | cost: cost, input_tokens: it || 0, output_tokens: ot || 0}

      _ ->
        session
    end
  end

  defp find_session_by_port(sessions, port) do
    sessions
    |> Enum.find_value(fn {_id, session} ->
      if session.port == port, do: session
    end)
  end

  defp find_running_session(sessions, session_id) when is_binary(session_id) do
    case Map.get(sessions, session_id) do
      %{status: :running} = s -> s
      _ -> nil
    end
  end

  defp find_running_session(sessions, _) do
    find_any_running_session(sessions)
  end

  defp find_any_running_session(sessions) do
    sessions
    |> Enum.find_value(fn {_id, session} ->
      if session.status == :running, do: session
    end)
  end

  defp broadcast(topic, payload) do
    Phoenix.PubSub.broadcast(Ema.PubSub, topic, {String.to_atom(topic), payload})
  rescue
    _ -> :ok
  end
end
