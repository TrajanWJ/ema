defmodule EmaWeb.FocusController do
  use EmaWeb, :controller

  alias Ema.Focus
  alias Ema.Focus.Timer

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    limit = parse_int(params["limit"], 20)
    sessions = Focus.list_sessions(limit: limit) |> Enum.map(&serialize_session/1)
    json(conn, %{sessions: sessions})
  end

  def show(conn, %{"id" => id}) do
    case Focus.get_session(id) do
      nil -> {:error, :not_found}
      session -> json(conn, serialize_session(session))
    end
  end

  def current(conn, _params) do
    case Focus.current_session() do
      nil -> json(conn, %{session: nil, timer: Timer.status()})
      session -> json(conn, %{session: serialize_session(session), timer: Timer.status()})
    end
  end

  def start(conn, params) do
    opts =
      []
      |> maybe_put(:target_ms, params["target_ms"])
      |> maybe_put(:break_ms, params["break_ms"])
      |> maybe_put(:task_id, params["task_id"])

    case Timer.start_session(opts) do
      {:ok, session} ->
        conn
        |> put_status(:created)
        |> json(serialize_session(session))

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  def stop(conn, _params) do
    case Timer.stop_session() do
      {:ok, session} ->
        json(conn, serialize_session(session))

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  def pause(conn, _params) do
    case Timer.pause() do
      :ok ->
        json(conn, %{status: "paused"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  def resume(conn, _params) do
    case Timer.resume() do
      :ok ->
        json(conn, %{status: "focusing"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  def take_break(conn, _params) do
    case Timer.take_break() do
      :ok ->
        json(conn, %{status: "break"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  def resume_work(conn, _params) do
    case Timer.resume_work() do
      :ok ->
        json(conn, %{status: "focusing"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  def today(conn, _params) do
    stats = Focus.today_stats()
    json(conn, stats)
  end

  def weekly(conn, _params) do
    stats = Focus.weekly_stats()
    json(conn, stats)
  end

  def history(conn, params) do
    limit = parse_int(params["limit"], 20)
    sessions = Focus.list_sessions(limit: limit) |> Enum.map(&serialize_session/1)
    json(conn, %{sessions: sessions})
  end

  def task_sessions(conn, %{"task_id" => task_id}) do
    sessions = Focus.sessions_for_task(task_id) |> Enum.map(&serialize_session/1)
    json(conn, %{sessions: sessions})
  end

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

  defp parse_int(nil, default), do: default

  defp parse_int(val, default) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> default
    end
  end

  defp parse_int(val, _default) when is_integer(val), do: val

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, val), do: Keyword.put(opts, key, val)
end
