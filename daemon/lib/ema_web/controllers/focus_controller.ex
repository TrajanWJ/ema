defmodule EmaWeb.FocusController do
  use EmaWeb, :controller

  alias Ema.Focus

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
      nil -> json(conn, %{session: nil})
      session -> json(conn, %{session: serialize_session(session)})
    end
  end

  def start(conn, params) do
    attrs =
      case params["target_ms"] do
        nil -> %{}
        ms -> %{target_ms: ms}
      end

    with {:ok, session} <- Focus.start_session(attrs) do
      conn
      |> put_status(:created)
      |> json(serialize_session(session))
    end
  end

  def stop(conn, %{"id" => id}) do
    with {:ok, session} <- Focus.end_session(id) do
      json(conn, serialize_session(session))
    end
  end

  def add_block(conn, %{"id" => id} = params) do
    block_type = params["block_type"] || "work"

    with {:ok, block} <- Focus.add_block(id, block_type) do
      conn
      |> put_status(:created)
      |> json(serialize_block(block))
    end
  end

  def end_block(conn, %{"block_id" => block_id}) do
    with {:ok, block} <- Focus.end_block(block_id) do
      json(conn, serialize_block(block))
    end
  end

  def today(conn, _params) do
    stats = Focus.today_stats()
    json(conn, stats)
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
end
