defmodule EmaWeb.EntityDataController do
  use EmaWeb, :controller

  alias Ema.Actors

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    rows =
      Actors.list_data(
        params["actor_id"] || "human",
        params["entity_type"],
        params["entity_id"]
      )

    json(conn, %{entity_data: Enum.map(rows, &serialize/1)})
  end

  def create(conn, params) do
    with {:ok, row} <-
           Actors.set_data(
             params["actor_id"] || "human",
             params["entity_type"],
             params["entity_id"],
             params["key"],
             params["value"]
           ) do
      conn
      |> put_status(:created)
      |> json(%{entity_data: serialize(row)})
    end
  end

  def delete(conn, params) do
    {count, _} =
      Actors.delete_data(
        params["actor_id"] || "human",
        params["entity_type"],
        params["entity_id"],
        params["key"]
      )

    json(conn, %{deleted: count})
  end

  defp serialize(row) do
    %{
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      actor_id: row.actor_id,
      key: row.key,
      value: row.value,
      inserted_at: row.inserted_at,
      updated_at: row.updated_at
    }
  end
end
