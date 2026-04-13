defmodule EmaWeb.LoopController do
  use EmaWeb, :controller

  alias Ema.Loops
  alias Ema.Loops.Loop

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_put(:status, params["status"])
      |> maybe_put(:actor_id, params["actor_id"])
      |> maybe_put(:project_id, params["project_id"])
      |> maybe_put(:min_level, parse_int(params["min_level"]))

    loops = Loops.list_loops(opts) |> Enum.map(&serialize/1)
    json(conn, %{loops: loops})
  end

  def at_risk(conn, _params) do
    loops = Loops.list_at_risk() |> Enum.map(&serialize/1)
    json(conn, %{loops: loops})
  end

  def stats(conn, _params), do: json(conn, Loops.stats())

  def show(conn, %{"id" => id}) do
    case Loops.get_loop(id) do
      nil -> {:error, :not_found}
      loop -> json(conn, serialize(loop))
    end
  end

  def create(conn, params) do
    attrs = %{
      loop_type: params["loop_type"] || params["type"],
      target: params["target"],
      context: params["context"],
      channel: params["channel"],
      follow_up_text: params["follow_up_text"],
      actor_id: params["actor_id"],
      project_id: params["project_id"],
      task_id: params["task_id"]
    }

    with {:ok, %Loop{} = loop} <- Loops.open_loop(attrs) do
      conn |> put_status(:created) |> json(serialize(loop))
    end
  end

  def touch(conn, %{"id" => id}) do
    case Loops.get_loop(id) do
      nil ->
        {:error, :not_found}

      loop ->
        with {:ok, updated} <- Loops.touch_loop(loop) do
          json(conn, serialize(updated))
        end
    end
  end

  def close(conn, %{"id" => id} = params) do
    case Loops.get_loop(id) do
      nil ->
        {:error, :not_found}

      loop ->
        opts = [
          status: params["status"] || "closed",
          reason: params["reason"],
          closed_by: params["closed_by"] || "human"
        ]

        with {:ok, updated} <- Loops.close_loop(loop, opts) do
          json(conn, serialize(updated))
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case Loops.get_loop(id) do
      nil ->
        {:error, :not_found}

      loop ->
        with {:ok, _} <- Loops.delete_loop(loop) do
          json(conn, %{ok: true})
        end
    end
  end

  defp serialize(%Loop{} = loop) do
    %{
      id: loop.id,
      loop_type: loop.loop_type,
      target: loop.target,
      context: loop.context,
      channel: loop.channel,
      opened_on: loop.opened_on,
      age_days: Loop.age_days(loop),
      touch_count: loop.touch_count,
      escalation_level: loop.escalation_level,
      escalation_label: Loop.level_label(loop.escalation_level || 0),
      last_escalated: loop.last_escalated,
      status: loop.status,
      closed_on: loop.closed_on,
      closed_by: loop.closed_by,
      closed_reason: loop.closed_reason,
      follow_up_text: loop.follow_up_text,
      actor_id: loop.actor_id,
      project_id: loop.project_id,
      task_id: loop.task_id,
      created_at: loop.inserted_at,
      updated_at: loop.updated_at
    }
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, _key, ""), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)

  defp parse_int(nil), do: nil
  defp parse_int(""), do: nil
  defp parse_int(n) when is_integer(n), do: n

  defp parse_int(s) when is_binary(s) do
    case Integer.parse(s) do
      {n, _} -> n
      :error -> nil
    end
  end
end
