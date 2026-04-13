defmodule Ema.Focus do
  @moduledoc """
  Focus — timed focus sessions with work/break blocks for deep work tracking.
  Pomodoro-style: start a session with a target duration, add work/break blocks,
  end the session when done.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Focus.{Session, Block}

  @default_target_ms 45 * 60 * 1000

  def list_sessions(opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)

    Session
    |> order_by(desc: :started_at)
    |> limit(^limit)
    |> preload(:blocks)
    |> Repo.all()
  end

  def get_session(id) do
    Session
    |> preload(:blocks)
    |> Repo.get(id)
  end

  def get_session!(id) do
    Session
    |> preload(:blocks)
    |> Repo.get!(id)
  end

  def current_session do
    Session
    |> where([s], is_nil(s.ended_at))
    |> order_by(desc: :started_at)
    |> limit(1)
    |> preload(:blocks)
    |> Repo.one()
  end

  def start_session(attrs \\ %{}) do
    # End any existing active session first
    case current_session() do
      nil -> :ok
      active -> end_session(active.id)
    end

    id = generate_id("focus")
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    merged =
      Map.merge(
        %{target_ms: @default_target_ms},
        attrs
      )
      |> Map.merge(%{id: id, started_at: now})

    %Session{}
    |> Session.changeset(merged)
    |> Repo.insert()
    |> tap_broadcast(:session_started)
  end

  def end_session(id) do
    case get_session(id) do
      nil ->
        {:error, :not_found}

      %{ended_at: ended} when not is_nil(ended) ->
        {:error, :already_ended}

      session ->
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        # End any active block
        end_active_block(session)

        session
        |> Session.changeset(%{ended_at: now})
        |> Repo.update()
        |> case do
          {:ok, updated} ->
            loaded = get_session!(updated.id)
            Phoenix.PubSub.broadcast(Ema.PubSub, "focus:updates", {:session_ended, loaded})
            {:ok, loaded}

          error ->
            error
        end
    end
  end

  def add_block(session_id, block_type \\ "work") when block_type in ~w(work break) do
    case get_session(session_id) do
      nil ->
        {:error, :not_found}

      %{ended_at: ended} when not is_nil(ended) ->
        {:error, :session_ended}

      session ->
        # End any active block first
        end_active_block(session)

        id = generate_id("blk")
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        %Block{}
        |> Block.changeset(%{
          id: id,
          session_id: session_id,
          block_type: block_type,
          started_at: now
        })
        |> Repo.insert()
        |> tap_broadcast(:block_added)
    end
  end

  def end_block(block_id) do
    case Repo.get(Block, block_id) do
      nil ->
        {:error, :not_found}

      %{ended_at: ended} when not is_nil(ended) ->
        {:error, :already_ended}

      block ->
        now = DateTime.utc_now() |> DateTime.truncate(:second)
        elapsed = DateTime.diff(now, block.started_at, :millisecond)

        block
        |> Block.changeset(%{ended_at: now, elapsed_ms: elapsed})
        |> Repo.update()
        |> tap_broadcast(:block_ended)
    end
  end

  def session_elapsed_ms(%Session{} = session) do
    session.blocks
    |> Enum.filter(&(&1.block_type == "work"))
    |> Enum.reduce(0, fn block, acc ->
      case block.elapsed_ms do
        nil ->
          now = DateTime.utc_now() |> DateTime.truncate(:second)
          acc + DateTime.diff(now, block.started_at, :millisecond)

        ms ->
          acc + ms
      end
    end)
  end

  def today_stats do
    today_start =
      Date.utc_today()
      |> DateTime.new!(~T[00:00:00], "Etc/UTC")

    sessions =
      Session
      |> where([s], s.started_at >= ^today_start)
      |> preload(:blocks)
      |> Repo.all()

    total_work_ms =
      sessions
      |> Enum.flat_map(& &1.blocks)
      |> Enum.filter(&(&1.block_type == "work" && &1.elapsed_ms))
      |> Enum.reduce(0, &(&1.elapsed_ms + &2))

    %{
      sessions_count: length(sessions),
      completed_count: Enum.count(sessions, &(not is_nil(&1.ended_at))),
      total_work_ms: total_work_ms
    }
  end

  defp end_active_block(%Session{blocks: blocks}) when is_list(blocks) do
    blocks
    |> Enum.find(&is_nil(&1.ended_at))
    |> case do
      nil -> :ok
      block -> end_block(block.id)
    end
  end

  defp end_active_block(_), do: :ok

  defp tap_broadcast(result, event) do
    case result do
      {:ok, record} ->
        Phoenix.PubSub.broadcast(Ema.PubSub, "focus:updates", {event, record})
        {:ok, record}

      error ->
        error
    end
  end

  def sessions_for_task(task_id) do
    Session
    |> where([s], s.task_id == ^task_id)
    |> order_by(desc: :started_at)
    |> preload(:blocks)
    |> Repo.all()
  end

  def weekly_stats do
    week_start =
      Date.utc_today()
      |> Date.add(-6)
      |> DateTime.new!(~T[00:00:00], "Etc/UTC")

    sessions =
      Session
      |> where([s], s.started_at >= ^week_start)
      |> preload(:blocks)
      |> Repo.all()

    completed = Enum.filter(sessions, &(not is_nil(&1.ended_at)))

    total_work_ms =
      completed
      |> Enum.flat_map(& &1.blocks)
      |> Enum.filter(&(&1.block_type == "work" && &1.elapsed_ms))
      |> Enum.reduce(0, &(&1.elapsed_ms + &2))

    # Count distinct days with completed sessions
    streak_days =
      completed
      |> Enum.map(&DateTime.to_date(&1.started_at))
      |> Enum.uniq()
      |> length()

    %{
      sessions_count: length(completed),
      total_work_ms: total_work_ms,
      streak_days: streak_days
    }
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
