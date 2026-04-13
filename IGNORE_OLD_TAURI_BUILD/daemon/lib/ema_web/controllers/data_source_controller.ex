defmodule EmaWeb.DataSourceController do
  use EmaWeb, :controller

  alias Ema.Canvas.DataSource

  def index(conn, _params) do
    sources =
      DataSource.available_sources()
      |> Enum.map(fn {id, description} ->
        %{id: id, description: description}
      end)

    json(conn, %{sources: sources})
  end

  def preview(conn, %{"id" => id} = params) do
    config = Map.get(params, "config", %{})

    case DataSource.fetch(id, config) do
      {:ok, data} ->
        json(conn, %{source: id, data: data})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: reason})
    end
  end
end
