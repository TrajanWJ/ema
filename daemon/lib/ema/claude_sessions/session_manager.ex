defmodule Ema.ClaudeSessions.SessionManager do
  @moduledoc """
  GenServer managing interactive Claude Bridge sessions with ETS-backed state.

  Tracks per-session metadata (bridge PID, status, project info) and provides
  an API for creating, listing, continuing, and killing sessions.
  """

  use GenServer
  require Logger

  alias Ema.Claude.Bridge

  @table :claude_bridge_sessions
  @pubsub_topic "ema:claude:sessions"

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "List all tracked bridge sessions."
  @spec list() :: [map()]
  def list do
    @table
    |> :ets.tab2list()
    |> Enum.map(fn {_id, session} -> session end)
    |> Enum.sort_by(& &1.started_at, {:desc, DateTime})
  end

  @doc "Find a session by its ID."
  @spec find(String.t()) :: {:ok, map()} | :not_found
  def find(session_id) do
    case :ets.lookup(@table, session_id) do
      [{^session_id, session}] -> {:ok, session}
      [] -> :not_found
    end
  end

  @doc """
  Create a new bridge session.

  Options:
    - project_path (required)
    - model (default: "sonnet")
    - project_id (optional, for linking to an EMA project)
  """
  @spec create(String.t(), String.t(), keyword()) :: {:ok, map()}
  def create(project_path, model \\ "sonnet", opts \\ []) do
    GenServer.call(__MODULE__, {:create, project_path, model, opts})
  end

  @doc "Send a prompt to continue an existing session."
  @spec continue(String.t(), String.t()) :: :ok | {:error, term()}
  def continue(session_id, prompt) do
    GenServer.call(__MODULE__, {:continue, session_id, prompt})
  end

  @doc "Kill a running bridge session."
  @spec kill(String.t()) :: :ok | {:error, :not_found}
  def kill(session_id) do
    GenServer.call(__MODULE__, {:kill, session_id})
  end

  @doc "Get the PubSub topic for session lifecycle events."
  def pubsub_topic, do: @pubsub_topic

  # --- Callbacks ---

  @impl true
  def init(_opts) do
    table = :ets.new(@table, [:named_table, :set, :public, read_concurrency: true])

    # Subscribe to bridge events to track session status
    Phoenix.PubSub.subscribe(Ema.PubSub, Bridge.pubsub_topic())

    {:ok, %{table: table}}
  end

  @impl true
  def handle_call({:create, project_path, model, opts}, _from, state) do
    session_id = generate_session_id()
    project_id = Keyword.get(opts, :project_id)

    {:ok, bridge_pid} =
      Bridge.start_link(
        project_path: project_path,
        model: model,
        session_id: session_id
      )

    # Monitor the bridge process
    Process.monitor(bridge_pid)

    session = %{
      id: session_id,
      bridge_pid: bridge_pid,
      project_path: project_path,
      project_id: project_id,
      model: model,
      status: "idle",
      started_at: DateTime.utc_now(),
      last_active: DateTime.utc_now(),
      output: []
    }

    :ets.insert(@table, {session_id, session})

    broadcast(:session_created, session)

    {:reply, {:ok, session}, state}
  end

  @impl true
  def handle_call({:continue, session_id, prompt}, _from, state) do
    case :ets.lookup(@table, session_id) do
      [{^session_id, %{bridge_pid: pid} = session}] ->
        Bridge.stream(pid, prompt, fn _event -> :ok end)

        update_session(session_id, %{
          session
          | status: "streaming",
            last_active: DateTime.utc_now()
        })

        {:reply, :ok, state}

      [] ->
        {:reply, {:error, :not_found}, state}
    end
  end

  @impl true
  def handle_call({:kill, session_id}, _from, state) do
    case :ets.lookup(@table, session_id) do
      [{^session_id, %{bridge_pid: pid} = session}] ->
        Bridge.stop(pid)
        update_session(session_id, %{session | status: "killed"})
        broadcast(:session_killed, %{id: session_id})
        {:reply, :ok, state}

      [] ->
        {:reply, {:error, :not_found}, state}
    end
  end

  @impl true
  def handle_info({:claude_event, session_id, event}, state) do
    case :ets.lookup(@table, session_id) do
      [{^session_id, session}] ->
        session = handle_bridge_event(session, event)
        update_session(session_id, session)

      [] ->
        :ok
    end

    {:noreply, state}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, reason}, state) do
    # Find and update the session whose bridge process went down
    @table
    |> :ets.tab2list()
    |> Enum.find(fn {_id, s} -> s.bridge_pid == pid end)
    |> case do
      {session_id, session} ->
        new_status = if reason == :normal, do: "completed", else: "crashed"
        update_session(session_id, %{session | status: new_status, bridge_pid: nil})
        broadcast(:session_ended, %{id: session_id, status: new_status})

      nil ->
        :ok
    end

    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state) do
    {:noreply, state}
  end

  # --- Internal ---

  defp handle_bridge_event(session, {:text_delta, text}) do
    %{
      session
      | status: "streaming",
        output: session.output ++ [text],
        last_active: DateTime.utc_now()
    }
  end

  defp handle_bridge_event(session, {:result, _data}) do
    %{session | status: "completed", last_active: DateTime.utc_now()}
  end

  defp handle_bridge_event(session, {:error, _data}) do
    %{session | status: "error", last_active: DateTime.utc_now()}
  end

  defp handle_bridge_event(session, {:exit, _data}) do
    %{session | status: "completed", last_active: DateTime.utc_now()}
  end

  defp handle_bridge_event(session, _event) do
    %{session | last_active: DateTime.utc_now()}
  end

  defp update_session(session_id, session) do
    :ets.insert(@table, {session_id, session})
  end

  defp broadcast(event, data) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      @pubsub_topic,
      {event, serialize(data)}
    )
  end

  defp serialize(%{id: _} = session) do
    Map.take(session, [
      :id,
      :project_path,
      :project_id,
      :model,
      :status,
      :started_at,
      :last_active
    ])
  end

  defp serialize(data), do: data

  defp generate_session_id do
    ts = System.system_time(:second)
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "bridge_#{ts}_#{rand}"
  end
end
