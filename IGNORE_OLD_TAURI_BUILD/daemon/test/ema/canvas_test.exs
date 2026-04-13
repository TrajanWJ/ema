defmodule Ema.CanvasTest do
  use Ema.DataCase, async: false
  alias Ema.Canvases

  defp create_project(slug) do
    {:ok, project} =
      Ema.Projects.create_project(%{
        name: "Test Project #{slug}",
        slug: slug,
        status: "active"
      })

    project
  end

  describe "create_canvas/1" do
    test "creates a canvas with defaults" do
      assert {:ok, canvas} = Canvases.create_canvas(%{name: "My Board"})
      assert canvas.name == "My Board"
      assert canvas.canvas_type == "freeform"
      assert String.starts_with?(canvas.id, "cvs_")
    end

    test "creates a canvas with all fields" do
      project = create_project("canvas-test")

      attrs = %{
        name: "Dashboard",
        description: "Project dashboard",
        canvas_type: "dashboard",
        project_id: project.id,
        viewport: %{"x" => 100, "y" => 200, "zoom" => 2},
        settings: %{"grid" => false, "snap" => false}
      }

      assert {:ok, canvas} = Canvases.create_canvas(attrs)
      assert canvas.canvas_type == "dashboard"
      assert canvas.project_id == project.id
    end

    test "rejects invalid canvas_type" do
      assert {:error, changeset} = Canvases.create_canvas(%{name: "Bad", canvas_type: "invalid"})
      assert %{canvas_type: _} = errors_on(changeset)
    end

    test "requires name" do
      assert {:error, changeset} = Canvases.create_canvas(%{})
      assert %{name: _} = errors_on(changeset)
    end
  end

  describe "get_canvas/1 and update_canvas/2" do
    test "retrieves and updates a canvas" do
      {:ok, canvas} = Canvases.create_canvas(%{name: "Original"})
      assert {:ok, fetched} = Canvases.get_canvas(canvas.id)
      assert fetched.name == "Original"

      assert {:ok, updated} = Canvases.update_canvas(fetched, %{name: "Updated"})
      assert updated.name == "Updated"
    end

    test "returns error for missing canvas" do
      assert {:error, :not_found} = Canvases.get_canvas("nonexistent")
    end
  end

  describe "delete_canvas/1" do
    test "deletes a canvas" do
      {:ok, canvas} = Canvases.create_canvas(%{name: "To Delete"})
      assert {:ok, _} = Canvases.delete_canvas(canvas)
      assert {:error, :not_found} = Canvases.get_canvas(canvas.id)
    end
  end

  describe "list_canvases/0 and list_by_project/1" do
    test "lists all canvases" do
      {:ok, _} = Canvases.create_canvas(%{name: "One"})
      {:ok, _} = Canvases.create_canvas(%{name: "Two"})
      assert length(Canvases.list_canvases()) == 2
    end

    test "filters by project_id" do
      p1 = create_project("filter-proj-1")
      p2 = create_project("filter-proj-2")

      {:ok, _} = Canvases.create_canvas(%{name: "A", project_id: p1.id})
      {:ok, _} = Canvases.create_canvas(%{name: "B", project_id: p2.id})
      {:ok, _} = Canvases.create_canvas(%{name: "C", project_id: p1.id})

      assert length(Canvases.list_by_project(p1.id)) == 2
      assert length(Canvases.list_by_project(p2.id)) == 1
      assert length(Canvases.list_by_project("proj_none")) == 0
    end
  end

  describe "create_element/2" do
    test "creates an element on a canvas" do
      {:ok, canvas} = Canvases.create_canvas(%{name: "Board"})

      attrs = %{
        element_type: "text",
        x: 10.0,
        y: 20.0,
        width: 200.0,
        height: 50.0,
        text: "Hello"
      }

      assert {:ok, element} = Canvases.create_element(canvas.id, attrs)
      assert element.element_type == "text"
      assert element.canvas_id == canvas.id
      assert element.text == "Hello"
      assert String.starts_with?(element.id, "elm_")
    end

    test "requires element_type" do
      {:ok, canvas} = Canvases.create_canvas(%{name: "Board"})
      assert {:error, changeset} = Canvases.create_element(canvas.id, %{})
      assert %{element_type: _} = errors_on(changeset)
    end
  end

  describe "update_element/2 and delete_element/1" do
    test "updates element fields" do
      {:ok, canvas} = Canvases.create_canvas(%{name: "Board"})
      {:ok, element} = Canvases.create_element(canvas.id, %{element_type: "rect", x: 0.0})

      assert {:ok, updated} = Canvases.update_element(element, %{x: 50.0, locked: true})
      assert updated.x == 50.0
      assert updated.locked == true
    end

    test "deletes an element" do
      {:ok, canvas} = Canvases.create_canvas(%{name: "Board"})
      {:ok, element} = Canvases.create_element(canvas.id, %{element_type: "rect"})

      assert {:ok, _} = Canvases.delete_element(element)
      assert {:error, :not_found} = Canvases.get_element(element.id)
    end
  end

  describe "list_elements/1 and list_data_elements/0" do
    test "lists elements for a canvas ordered by z_index" do
      {:ok, canvas} = Canvases.create_canvas(%{name: "Board"})
      {:ok, _} = Canvases.create_element(canvas.id, %{element_type: "a", z_index: 2})
      {:ok, _} = Canvases.create_element(canvas.id, %{element_type: "b", z_index: 1})

      elements = Canvases.list_elements(canvas.id)
      assert length(elements) == 2
      assert hd(elements).z_index <= List.last(elements).z_index
    end

    test "list_data_elements returns only elements with data_source" do
      {:ok, canvas} = Canvases.create_canvas(%{name: "Board"})
      {:ok, _} = Canvases.create_element(canvas.id, %{element_type: "text"})

      {:ok, _} =
        Canvases.create_element(canvas.id, %{
          element_type: "chart",
          data_source: "tasks:by_status"
        })

      assert length(Canvases.list_data_elements()) == 1
    end
  end

  describe "reorder_elements/2" do
    test "reorders elements by z_index" do
      {:ok, canvas} = Canvases.create_canvas(%{name: "Board"})
      {:ok, e1} = Canvases.create_element(canvas.id, %{element_type: "a", z_index: 0})
      {:ok, e2} = Canvases.create_element(canvas.id, %{element_type: "b", z_index: 1})

      assert {:ok, _} = Canvases.reorder_elements(canvas.id, [e2.id, e1.id])

      elements = Canvases.list_elements(canvas.id)
      ids = Enum.map(elements, & &1.id)
      assert ids == [e2.id, e1.id]
    end
  end
end
