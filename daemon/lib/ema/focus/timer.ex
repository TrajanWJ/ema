defmodule Ema.Focus.Timer do
  @moduledoc """
  GenServer managing a single focus timer with work/break phases.

  States: :idle → :focusing → :break → :idle
  Ticks every second, broadcasting elapsed time over PubSub.
  Default: 45 min work, 15 min break.
  """

  use GenServer
  require Logger

  alias Ema.Focus

  @tick_interval 1_000
  @default_work_ms 45 * 60 * 1000
  @default_break_ms 15 * 60 * 1000

  # ── Client API ──

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Start a focus session. Options: :target_ms, :break_ms, :task_id"
  def start_session(opts \\ []) do
    GenServer.call(__MODULE__, {:start_session, opts})
  end

  @doc "Pause the current work/break block (stops ticking)."
  def pause do
    GenServer.call(__MODULE__, :pause)
  end

  @doc "Resume after a pause."
  def resume do
    GenServer.call(__MODULE__, :resume)
  end

  @doc "Switch to break phase."
  def take_break do
    GenServer.call(__MODULE__, :take_break)
  end

  @doc "Resume work after break."
  def resume_work do
    GenServer.call(__MODULE__, :resume_work)
  end

  @doc "End the session. Returns the completed session."
  def stop_session do
    GenServer.call(__MODULE__, :stop_session)
  end

  @doc "Get current timer state snapshot."
  def status do
    GenServer.call(__MODULE__, :status)
  end

  # ── Server Callbacks ──

  @impl true
  def init(_opts) do
    # Check for an active DB session on startup (crash recovery)
    state =
      case Focus.current_session() do
        nil ->
          idle_state()

        session ->
          Logger.info("Focus.Timer: recovering active session #{session.id}")
          recover_session(session)
      end

    {:ok, state}
  end

  @impl true
  def handle_call({:start_session, opts}, _from, %{phase: :idle} = _state) do
    work_ms = Keyword.get(opts, :target_ms, @default_work_ms)
    break_ms = Keyword.get(opts, :break_ms, @default_break_ms)
    task_id = Keyword.get(opts, :task_id)

    case Focus.start_session(%{target_ms: work_ms, task_id: task_id}) do
      {:ok, session} ->
        # Start the first work block
        {:ok, _block} = Focus.add_block(session.id, "work")
        session = Focus.get_session!(session.id)
        ref = schedule_tick()

        state = %{
          phase: :focusing,
          session_id: session.id,
          task_id: task_id,
          work_ms: work_ms,
          break_ms: break_ms,
          elapsed_ms: 0,
          block_elapsed_ms: 0,
          tick_ref: ref,
          last_tick: System.monotonic_time(:millisecond)
        }

        broadcast_tick(state, session)
        {:reply, {:ok, session}, state}

      error ->
        {:reply, error, idle_state()}
    end
  end

  def handle_call({:start_session, _opts}, _from, state) do
    {:reply, {:error, :session_active}, state}
  end

  def handle_call(:pause, _from, %{phase: phase} = state) when phase in [:focusing, :break] do
    cancel_tick(state.tick_ref)

    # End the active block in DB
    session = Focus.get_session!(state.session_id)
    end_active_block(session)

    new_state = %{state | phase: :paused, tick_ref: nil}
    broadcast_phase_change(new_state)
    {:reply, :ok, new_state}
  end

  def handle_call(:pause, _from, state) do
    {:reply, {:error, :not_active}, state}
  end

  def handle_call(:resume, _from, %{phase: :paused} = state) do
    # Start a new work block
    {:ok, _block} = Focus.add_block(state.session_id, "work")
    ref = schedule_tick()

    new_state = %{
      state
      | phase: :focusing,
        tick_ref: ref,
        block_elapsed_ms: 0,
        last_tick: System.monotonic_time(:millisecond)
    }

    broadcast_phase_change(new_state)
    {:reply, :ok, new_state}
  end

  def handle_call(:resume, _from, state) do
    {:reply, {:error, :not_paused}, state}
  end

  def handle_call(:take_break, _from, %{phase: :focusing} = state) do
    cancel_tick(state.tick_ref)

    # End current work block, start break block
    session = Focus.get_session!(state.session_id)
    end_active_block(session)
    {:ok, _block} = Focus.add_block(state.session_id, "break")

    ref = schedule_tick()

    new_state = %{
      state
      | phase: :break,
        tick_ref: ref,
        block_elapsed_ms: 0,
        last_tick: System.monotonic_time(:millisecond)
    }

    broadcast_phase_change(new_state)
    {:reply, :ok, new_state}
  end

  def handle_call(:take_break, _from, state) do
    {:reply, {:error, :not_focusing}, state}
  end

  def handle_call(:resume_work, _from, %{phase: :break} = state) do
    cancel_tick(state.tick_ref)

    # End break block, start work block
    session = Focus.get_session!(state.session_id)
    end_active_block(session)
    {:ok, _block} = Focus.add_block(state.session_id, "work")

    ref = schedule_tick()

    new_state = %{
      state
      | phase: :focusing,
        tick_ref: ref,
        block_elapsed_ms: 0,
        last_tick: System.monotonic_time(:millisecond)
    }

    broadcast_phase_change(new_state)
    {:reply, :ok, new_state}
  end

  def handle_call(:resume_work, _from, state) do
    {:reply, {:error, :not_on_break}, state}
  end

  def handle_call(:stop_session, _from, %{phase: :idle} = state) do
    {:reply, {:error, :no_session}, state}
  end

  def handle_call(:stop_session, _from, state) do
    cancel_tick(state.tick_ref)

    case Focus.end_session(state.session_id) do
      {:ok, session} ->
        # Fire post-session hooks asynchronously
        fire_session_complete(session, state.task_id)
        {:reply, {:ok, session}, idle_state()}

      error ->
        {:reply, error, idle_state()}
    end
  end

  def handle_call(:status, _from, state) do
    snapshot = %{
      phase: state.phase,
      session_id: state[:session_id],
      task_id: state[:task_id],
      work_ms: state[:work_ms],
      break_ms: state[:break_ms],
      elapsed_ms: state[:elapsed_ms] || 0,
      block_elapsed_ms: state[:block_elapsed_ms] || 0
    }

    {:reply, snapshot, state}
  end

  @impl true
  def handle_info(:tick, %{phase: phase} = state) when phase in [:focusing, :break] do
    now = System.monotonic_time(:millisecond)
    delta = now - state.last_tick
    new_block_elapsed = state.block_elapsed_ms + delta

    new_elapsed =
      if phase == :focusing do
        state.elapsed_ms + delta
      else
        state.elapsed_ms
      end

    new_state = %{
      state
      | elapsed_ms: new_elapsed,
        block_elapsed_ms: new_block_elapsed,
        last_tick: now
    }

    # Check if work target reached
    if phase == :focusing and new_elapsed >= state.work_ms do
      # Auto-transition to break
      cancel_tick(state.tick_ref)
      session = Focus.get_session!(state.session_id)
      end_active_block(session)
      {:ok, _block} = Focus.add_block(state.session_id, "break")

      ref = schedule_tick()

      break_state = %{
        new_state
        | phase: :break,
          tick_ref: ref,
          block_elapsed_ms: 0,
          last_tick: System.monotonic_time(:millisecond)
      }

      broadcast_phase_change(break_state)
      session = Focus.get_session!(state.session_id)
      broadcast_tick(break_state, session)
      {:noreply, break_state}
    else
      # Check if break target reached
      if phase == :break and new_block_elapsed >= state.break_ms do
        # Auto-transition back to work
        cancel_tick(state.tick_ref)
        session = Focus.get_session!(state.session_id)
        end_active_block(session)
        {:ok, _block} = Focus.add_block(state.session_id, "work")

        ref = schedule_tick()

        work_state = %{
          new_state
          | phase: :focusing,
            tick_ref: ref,
            block_elapsed_ms: 0,
            last_tick: System.monotonic_time(:millisecond)
        }

        broadcast_phase_change(work_state)
        session = Focus.get_session!(state.session_id)
        broadcast_tick(work_state, session)
        {:noreply, work_state}
      else
        ref = schedule_tick()
        new_state = %{new_state | tick_ref: ref}
        session = Focus.get_session!(state.session_id)
        broadcast_tick(new_state, session)
        {:noreply, new_state}
      end
    end
  end

  def handle_info(:tick, state) do
    # Tick arrived in idle/paused — ignore
    {:noreply, state}
  end

  # ── Private ──

  defp idle_state do
    %{
      phase: :idle,
      session_id: nil,
      task_id: nil,
      work_ms: @default_work_ms,
      break_ms: @default_break_ms,
      elapsed_ms: 0,
      block_elapsed_ms: 0,
      tick_ref: nil,
      last_tick: nil
    }
  end

  defp recover_session(session) do
    active_block = Enum.find(session.blocks, &is_nil(&1.ended_at))
    work_elapsed = Focus.session_elapsed_ms(session)

    phase =
      case active_block do
        nil -> :paused
        %{block_type: "work"} -> :focusing
        %{block_type: "break"} -> :break
      end

    block_elapsed =
      case active_block do
        nil ->
          0

        block ->
          DateTime.diff(DateTime.utc_now() |> DateTime.truncate(:second), block.started_at, :millisecond)
      end

    ref = if phase in [:focusing, :break], do: schedule_tick(), else: nil

    %{
      phase: phase,
      session_id: session.id,
      task_id: session.task_id,
      work_ms: session.target_ms,
      break_ms: @default_break_ms,
      elapsed_ms: work_elapsed,
      block_elapsed_ms: block_elapsed,
      tick_ref: ref,
      last_tick: System.monotonic_time(:millisecond)
    }
  end

  defp schedule_tick do
    Process.send_after(self(), :tick, @tick_interval)
  end

  defp cancel_tick(nil), do: :ok
  defp cancel_tick(ref), do: Process.cancel_timer(ref)

  defp end_active_block(%{blocks: blocks}) when is_list(blocks) do
    case Enum.find(blocks, &is_nil(&1.ended_at)) do
      nil -> :ok
      block -> Focus.end_block(block.id)
    end
  end

  defp end_active_block(_), do: :ok

  defp broadcast_tick(state, session) do
    payload = %{
      phase: state.phase,
      session_id: state.session_id,
      task_id: state.task_id,
      elapsed_ms: state.elapsed_ms,
      block_elapsed_ms: state.block_elapsed_ms,
      work_ms: state.work_ms,
      break_ms: state.break_ms,
      session: session
    }

    Phoenix.PubSub.broadcast(Ema.PubSub, "focus:timer", {:focus_tick, payload})
  end

  defp broadcast_phase_change(state) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "focus:timer", {:phase_change, state.phase})
  end

  defp fire_session_complete(session, task_id) do
    Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
      # 1. Auto-log habit
      Ema.Focus.Hooks.log_focus_habit(session)

      # 2. Log time on task
      if task_id, do: Ema.Focus.Hooks.log_task_time(session, task_id)

      # 3. AI summary → journal entry
      Ema.Focus.Summary.maybe_generate(session, task_id)
    end)
  end
end
