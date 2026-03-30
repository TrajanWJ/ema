defmodule EmaWeb.CanvasController do
  use EmaWeb, :controller

  alias Ema.Canvases
  alias Ema.Canvas.DataSource

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    canvases =
      case params["project_id"] do
        nil -> Canvases.list_canvases()
        project_id -> Canvases.list_by_project(project_id)
      end

    json(conn, %{canvases: Enum.map(canvases, &serialize_canvas/1)})
  end

  def show(conn, %{"id" => id}) do
    with {:ok, canvas} <- Canvases.get_canvas_with_elements(id) do
      json(conn, serialize_canvas_with_elements(canvas))
    end
  end

  def create(conn, params) do
    attrs = %{
      name: params["name"],
      description: params["description"],
      canvas_type: params["canvas_type"] || "freeform",
      viewport: params["viewport"],
      settings: params["settings"],
      project_id: params["project_id"]
    }

    with {:ok, canvas} <- Canvases.create_canvas(attrs) do
      conn
      |> put_status(:created)
      |> json(serialize_canvas(canvas))
    end
  end

  def update(conn, %{"id" => id} = params) do
    with {:ok, canvas} <- Canvases.get_canvas(id),
         {:ok, updated} <- Canvases.update_canvas(canvas, Map.drop(params, ["id"])) do
      json(conn, serialize_canvas(updated))
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, canvas} <- Canvases.get_canvas(id),
         {:ok, _} <- Canvases.delete_canvas(canvas) do
      json(conn, %{ok: true})
    end
  end

  def export(conn, %{"id" => id}) do
    with {:ok, canvas} <- Canvases.get_canvas_with_elements(id) do
      json(conn, %{
        export: serialize_canvas_with_elements(canvas),
        exported_at: DateTime.utc_now() |> DateTime.to_iso8601()
      })
    end
  end

  def element_data(conn, %{"id" => _canvas_id, "element_id" => element_id}) do
    with {:ok, element} <- Canvases.get_element(element_id) do
      case DataSource.fetch(element.data_source, element.data_config) do
        {:ok, data} ->
          json(conn, %{element_id: element_id, data: data})

        {:error, reason} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: reason})
      end
    end
  end

  def refresh_data(conn, %{"id" => _canvas_id, "element_id" => element_id}) do
    with {:ok, element} <- Canvases.get_element(element_id) do
      case DataSource.fetch(element.data_source, element.data_config) do
        {:ok, data} ->
          Phoenix.PubSub.broadcast(
            Ema.PubSub,
            "canvas:data:#{element_id}",
            {:data_refresh, element_id, data}
          )

          json(conn, %{element_id: element_id, data: data})

        {:error, reason} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: reason})
      end
    end
  end

  defp serialize_canvas(canvas) do
    %{
      id: canvas.id,
      name: canvas.name,
      description: canvas.description,
      canvas_type: canvas.canvas_type,
      viewport: canvas.viewport,
      settings: canvas.settings,
      project_id: canvas.project_id,
      created_at: canvas.inserted_at,
      updated_at: canvas.updated_at
    }
  end

  defp serialize_canvas_with_elements(canvas) do
    %{
      id: canvas.id,
      name: canvas.name,
      description: canvas.description,
      canvas_type: canvas.canvas_type,
      viewport: canvas.viewport,
      settings: canvas.settings,
      project_id: canvas.project_id,
      created_at: canvas.inserted_at,
      updated_at: canvas.updated_at,
      elements: Enum.map(canvas.elements, &serialize_element/1)
    }
  end

  defp serialize_element(element) do
    %{
      id: element.id,
      element_type: element.element_type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      z_index: element.z_index,
      locked: element.locked,
      style: element.style,
      text: element.text,
      points: element.points,
      image_path: element.image_path,
      data_source: element.data_source,
      data_config: element.data_config,
      chart_config: element.chart_config,
      refresh_interval: element.refresh_interval,
      group_id: element.group_id,
      canvas_id: element.canvas_id,
      created_at: element.inserted_at,
      updated_at: element.updated_at
    }
  end
end
