defmodule EmaWeb.ContainerConfigController do
  use EmaWeb, :controller

  import Ecto.Query
  alias Ema.Actors
  alias Ema.Repo

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    rows = Actors.list_config(params["container_type"], params["container_id"])
    json(conn, %{container_config: Enum.map(rows, &serialize/1)})
  end

  def create(conn, params) do
    with {:ok, row} <-
           Actors.set_config(
             params["container_type"],
             params["container_id"],
             params["key"],
             params["value"]
           ) do
      conn
      |> put_status(:created)
      |> json(%{container_config: serialize(row)})
    end
  end

  def delete(conn, params) do
    {count, _} =
      Ema.Actors.ContainerConfig
      |> where([c],
        c.container_type == ^params["container_type"] and
          c.container_id == ^params["container_id"] and
          c.key == ^params["key"]
      )
      |> Repo.delete_all()

    json(conn, %{deleted: count})
  end

  defp serialize(row) do
    %{
      container_type: row.container_type,
      container_id: row.container_id,
      key: row.key,
      value: row.value,
      inserted_at: row.inserted_at,
      updated_at: row.updated_at
    }
  end
end
