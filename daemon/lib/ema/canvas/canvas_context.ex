defmodule Ema.Canvases do
  @moduledoc """
  Context for canvas and element CRUD operations.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Canvas.{Canvas, Element}

  # --- Canvases ---

  def list_canvases do
    Canvas
    |> order_by(desc: :updated_at)
    |> Repo.all()
  end

  def list_by_project(project_id) do
    Canvas
    |> where([c], c.project_id == ^project_id)
    |> order_by(desc: :updated_at)
    |> Repo.all()
  end

  def get_canvas(id) do
    case Repo.get(Canvas, id) do
      nil -> {:error, :not_found}
      canvas -> {:ok, canvas}
    end
  end

  def get_canvas_with_elements(id) do
    case Canvas |> Repo.get(id) |> Repo.preload(elements: from(e in Element, order_by: e.z_index)) do
      nil -> {:error, :not_found}
      canvas -> {:ok, canvas}
    end
  end

  def create_canvas(attrs) do
    id = generate_id("cvs")

    %Canvas{}
    |> Canvas.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_canvas(%Canvas{} = canvas, attrs) do
    canvas
    |> Canvas.changeset(attrs)
    |> Repo.update()
  end

  def delete_canvas(%Canvas{} = canvas) do
    Repo.delete(canvas)
  end

  # --- Elements ---

  def list_elements(canvas_id) do
    Element
    |> where([e], e.canvas_id == ^canvas_id)
    |> order_by(asc: :z_index)
    |> Repo.all()
  end

  def list_data_elements do
    Element
    |> where([e], not is_nil(e.data_source) and e.data_source != "")
    |> Repo.all()
  end

  def get_element(id) do
    case Repo.get(Element, id) do
      nil -> {:error, :not_found}
      element -> {:ok, element}
    end
  end

  def create_element(canvas_id, attrs) do
    id = generate_id("elm")

    attrs =
      attrs
      |> Map.put(:id, id)
      |> Map.put(:canvas_id, canvas_id)

    %Element{}
    |> Element.changeset(attrs)
    |> Repo.insert()
  end

  def update_element(%Element{} = element, attrs) do
    element
    |> Element.changeset(attrs)
    |> Repo.update()
  end

  def delete_element(%Element{} = element) do
    Repo.delete(element)
  end

  def reorder_elements(canvas_id, element_ids) when is_list(element_ids) do
    Repo.transaction(fn ->
      element_ids
      |> Enum.with_index()
      |> Enum.each(fn {element_id, index} ->
        Element
        |> where([e], e.id == ^element_id and e.canvas_id == ^canvas_id)
        |> Repo.update_all(set: [z_index: index])
      end)
    end)
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
