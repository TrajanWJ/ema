defmodule Ema.Canvases do
  @moduledoc """
  Context for canvas and element CRUD operations.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Canvas.{Canvas, CanvasTemplate, Element}

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
    case Canvas
         |> Repo.get(id)
         |> Repo.preload(elements: from(e in Element, order_by: e.z_index)) do
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

  # --- Templates ---

  def list_templates do
    CanvasTemplate
    |> order_by(asc: :category)
    |> Repo.all()
  end

  def list_templates_by_category(category) do
    CanvasTemplate
    |> where([t], t.category == ^category)
    |> order_by(asc: :name)
    |> Repo.all()
  end

  def get_template(id) do
    case Repo.get(CanvasTemplate, id) do
      nil -> {:error, :not_found}
      template -> {:ok, template}
    end
  end

  def create_template(attrs) do
    id = generate_id("tpl")

    %CanvasTemplate{}
    |> CanvasTemplate.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def seed_stock_templates do
    for tpl <- CanvasTemplate.stock_templates() do
      case Repo.get(CanvasTemplate, tpl.id) do
        nil ->
          %CanvasTemplate{}
          |> CanvasTemplate.changeset(tpl)
          |> Repo.insert!()

        _existing ->
          :ok
      end
    end
  end

  @doc """
  Instantiate a template into a new canvas with pre-populated elements.
  Optionally override the canvas name and project_id.
  """
  def instantiate_template(template_id, overrides \\ %{}) do
    with {:ok, template} <- get_template(template_id),
         {:ok, layout} <- Jason.decode(template.layout_json) do
      canvas_attrs =
        %{
          name: overrides[:name] || layout["canvas"]["name"] || template.name,
          canvas_type: layout["canvas"]["canvas_type"] || "freeform",
          description: template.description,
          project_id: overrides[:project_id]
        }

      Repo.transaction(fn ->
        {:ok, canvas} = create_canvas(canvas_attrs)

        elements =
          (layout["elements"] || [])
          |> Enum.with_index()
          |> Enum.map(fn {el_data, idx} ->
            attrs = %{
              element_type: el_data["element_type"],
              x: el_data["x"] || 0,
              y: el_data["y"] || 0,
              width: el_data["width"] || 200,
              height: el_data["height"] || 150,
              text: el_data["text"],
              style: el_data["style"] || %{},
              data_source: el_data["data_source"],
              data_config: el_data["data_config"] || %{},
              chart_config: el_data["chart_config"] || %{},
              refresh_interval: el_data["refresh_interval"],
              z_index: idx
            }

            {:ok, element} = create_element(canvas.id, attrs)
            element
          end)

        %{canvas | elements: elements}
      end)
    end
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
