defmodule Ema.Claude.CircuitBreaker do
  @moduledoc """
  Citadel-inspired circuit breaker for Claude Code sessions.

  Tracks consecutive tool failures per session:
  - 3 consecutive failures → :soft trip (suggest different approach)
  - 5 trips in a session → :hard trip (force stop, escalate)
  - Resets on successful tool execution

  ## Usage

      case CircuitBreaker.check() do
        :ok -> proceed_with_tool_call()
        {:tripped, :soft} -> suggest_alternative()
        {:tripped, :hard} -> force_stop()
      end

      CircuitBreaker.record_success(session_id)
      CircuitBreaker.record_failure(session_id)
  """

  use GenServer
  require Logger

  @soft_threshold 3
  @hard_threshold 5

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Check if the circuit breaker is tripped for the current global state."
  def check do
    GenServer.call(__MODULE__, :check)
  end

  @doc "Check circuit breaker state for a specific session."
  def check(session_id) do
    GenServer.call(__MODULE__, {:check, session_id})
  end

  @doc "Record a successful tool execution."
  def record_success(session_id) do
    GenServer.cast(__MODULE__, {:success, session_id})
  end

  @doc "Record a failed tool execution."
  def record_failure(session_id) do
    GenServer.cast(__MODULE__, {:failure, session_id})
  end

  @doc "Reset state for a session (e.g., when session ends)."
  def reset(session_id) do
    GenServer.cast(__MODULE__, {:reset, session_id})
  end

  @doc "Get current state for debugging."
  def state do
    GenServer.call(__MODULE__, :state)
  end

  # ── GenServer Callbacks ────────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    # %{session_id => %{consecutive_failures: N, total_trips: N}}
    {:ok, %{sessions: %{}}}
  end

  @impl true
  def handle_call(:check, _from, state) do
    # Global check — tripped if ANY session is hard-tripped
    result =
      state.sessions
      |> Enum.find_value(:ok, fn {_id, s} ->
        cond do
          s.total_trips >= @hard_threshold -> {:tripped, :hard}
          s.consecutive_failures >= @soft_threshold -> {:tripped, :soft}
          true -> nil
        end
      end)

    {:reply, result, state}
  end

  @impl true
  def handle_call({:check, session_id}, _from, state) do
    result =
      case Map.get(state.sessions, session_id) do
        nil ->
          :ok

        s ->
          cond do
            s.total_trips >= @hard_threshold -> {:tripped, :hard}
            s.consecutive_failures >= @soft_threshold -> {:tripped, :soft}
            true -> :ok
          end
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:state, _from, state) do
    {:reply, state, state}
  end

  @impl true
  def handle_cast({:success, session_id}, state) do
    sessions =
      Map.update(state.sessions, session_id, %{consecutive_failures: 0, total_trips: 0}, fn s ->
        %{s | consecutive_failures: 0}
      end)

    {:noreply, %{state | sessions: sessions}}
  end

  @impl true
  def handle_cast({:failure, session_id}, state) do
    sessions =
      Map.update(state.sessions, session_id, %{consecutive_failures: 1, total_trips: 0}, fn s ->
        new_failures = s.consecutive_failures + 1
        new_trips = if new_failures >= @soft_threshold, do: s.total_trips + 1, else: s.total_trips

        if new_failures >= @soft_threshold do
          Logger.warning(
            "[CircuitBreaker] Session #{session_id}: #{new_failures} consecutive failures (trip ##{new_trips})"
          )

          Phoenix.PubSub.broadcast(
            Ema.PubSub,
            "claude:events",
            {:circuit_breaker_tripped,
             %{session_id: session_id, failures: new_failures, trips: new_trips}}
          )
        end

        %{s | consecutive_failures: new_failures, total_trips: new_trips}
      end)

    {:noreply, %{state | sessions: sessions}}
  end

  @impl true
  def handle_cast({:reset, session_id}, state) do
    {:noreply, %{state | sessions: Map.delete(state.sessions, session_id)}}
  end
end
