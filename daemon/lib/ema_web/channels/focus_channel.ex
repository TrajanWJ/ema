defmodule EmaWeb.FocusChannel do
  use Phoenix.Channel

  alias Ema.Focus

  @impl true
  def join("focus:timer", _payload, socket) do
    :ok = Phoenix.PubSub.subscribe(Ema.PubSub, "focus:updates")
    :ok = Phoenix.PubSub.subscribe(Ema.PubSub, "focus:timer")

    current = Focus.current_session()
    today = Focus.today_stats()
    timer = Ema.Focus.Timer.status()

    payload = %{
      current_session: maybe_serialize_session(current),
      today_stats: today,
      timer: timer
    }

    {:ok, payload, socket}
  end

  # Timer tick — sent every second during active session
  @impl true
  def handle_info({:focus_tick, payload}, socket) do
    push(socket, "tick", %{
      phase: payload.phase,
      elapsed_ms: payload.elapsed_ms,
      block_elapsed_ms: payload.block_elapsed_ms,
      work_ms: payload.work_ms,
      break_ms: payload.break_ms,
      session: maybe_serialize_session(payload.session)
    })

    {:noreply, socket}
  end

  @impl true
  def handle_info({:phase_change, phase}, socket) do
    push(socket, "phase_change", %{phase: phase})
    {:noreply, socket}
  end

  @impl true
  def handle_info({:session_started, session}, socket) do
    push(socket, "session_started", serialize_session(session))
    {:noreply, socket}
  end

  @impl true
  def handle_info({:session_ended, session}, socket) do
    today = Focus.today_stats()
    push(socket, "session_ended", %{session: serialize_session(session), today_stats: today})
    {:noreply, socket}
  end

  @impl true
  def handle_info({:block_added, block}, socket) do
    push(socket, "block_added", serialize_block(block))
    {:noreply, socket}
  end

  @impl true
  def handle_info({:block_ended, block}, socket) do
    push(socket, "block_ended", serialize_block(block))
    {:noreply, socket}
  end

  defp maybe_serialize_session(nil), do: nil
  defp maybe_serialize_session(session), do: serialize_session(session)

  defp serialize_session(session) do
    blocks =
      case session.blocks do
        %Ecto.Association.NotLoaded{} -> []
        blocks -> Enum.map(blocks, &serialize_block/1)
      end

    %{
      id: session.id,
      started_at: session.started_at,
      ended_at: session.ended_at,
      target_ms: session.target_ms,
      task_id: session.task_id,
      summary: session.summary,
      blocks: blocks,
      created_at: session.inserted_at,
      updated_at: session.updated_at
    }
  end

  defp serialize_block(block) do
    %{
      id: block.id,
      session_id: block.session_id,
      block_type: block.block_type,
      started_at: block.started_at,
      ended_at: block.ended_at,
      elapsed_ms: block.elapsed_ms,
      created_at: block.inserted_at,
      updated_at: block.updated_at
    }
  end
end
