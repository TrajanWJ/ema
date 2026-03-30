defmodule Ema.ProjectsTest do
  use Ema.DataCase, async: false
  alias Ema.Projects

  describe "create_project/1" do
    test "creates a project with valid attrs" do
      assert {:ok, project} = Projects.create_project(%{slug: "ema", name: "EMA"})
      assert project.slug == "ema"
      assert project.name == "EMA"
      assert project.status == "incubating"
      assert String.starts_with?(project.id, "proj_")
    end

    test "fails without required fields" do
      assert {:error, changeset} = Projects.create_project(%{})
      assert %{slug: ["can't be blank"], name: ["can't be blank"]} = errors_on(changeset)
    end

    test "validates slug format" do
      assert {:error, changeset} = Projects.create_project(%{slug: "Bad Slug!", name: "Test"})
      assert %{slug: [_]} = errors_on(changeset)
    end

    test "enforces unique slugs" do
      assert {:ok, _} = Projects.create_project(%{slug: "unique-one", name: "First"})
      assert {:error, changeset} = Projects.create_project(%{slug: "unique-one", name: "Second"})
      assert %{slug: ["has already been taken"]} = errors_on(changeset)
    end

    test "accepts optional fields" do
      attrs = %{
        slug: "full-project",
        name: "Full Project",
        description: "A test project",
        icon: "rocket",
        color: "#ff0000",
        linked_path: "/tmp/test",
        settings: %{"auto_context" => true}
      }

      assert {:ok, project} = Projects.create_project(attrs)
      assert project.description == "A test project"
      assert project.icon == "rocket"
      assert project.color == "#ff0000"
      assert project.linked_path == "/tmp/test"
      assert project.settings == %{"auto_context" => true}
    end
  end

  describe "list_projects/0" do
    test "returns all projects ordered by name" do
      {:ok, _} = Projects.create_project(%{slug: "zebra", name: "Zebra"})
      {:ok, _} = Projects.create_project(%{slug: "alpha", name: "Alpha"})
      projects = Projects.list_projects()
      assert length(projects) == 2
      assert hd(projects).name == "Alpha"
    end
  end

  describe "list_by_status/1" do
    test "filters projects by status" do
      {:ok, _} = Projects.create_project(%{slug: "active-one", name: "Active", status: "active"})
      {:ok, _} = Projects.create_project(%{slug: "paused-one", name: "Paused", status: "paused"})
      {:ok, _} = Projects.create_project(%{slug: "incubating-one", name: "Incubating"})

      active = Projects.list_by_status("active")
      assert length(active) == 1
      assert hd(active).slug == "active-one"
    end
  end

  describe "get_project_by_slug/1" do
    test "returns project by slug" do
      {:ok, created} = Projects.create_project(%{slug: "find-me", name: "Find Me"})
      found = Projects.get_project_by_slug("find-me")
      assert found.id == created.id
    end

    test "returns nil for unknown slug" do
      assert Projects.get_project_by_slug("nope") == nil
    end
  end

  describe "update_project/2" do
    test "updates project fields" do
      {:ok, project} = Projects.create_project(%{slug: "update-me", name: "Original"})
      assert {:ok, updated} = Projects.update_project(project, %{name: "Updated"})
      assert updated.name == "Updated"
      assert updated.slug == "update-me"
    end
  end

  describe "transition_status/2" do
    test "allows valid transitions" do
      {:ok, project} = Projects.create_project(%{slug: "transition-test", name: "Transition"})
      assert project.status == "incubating"

      assert {:ok, active} = Projects.transition_status(project, "active")
      assert active.status == "active"

      assert {:ok, paused} = Projects.transition_status(active, "paused")
      assert paused.status == "paused"

      assert {:ok, reactivated} = Projects.transition_status(paused, "active")
      assert reactivated.status == "active"

      assert {:ok, completed} = Projects.transition_status(reactivated, "completed")
      assert completed.status == "completed"

      assert {:ok, archived} = Projects.transition_status(completed, "archived")
      assert archived.status == "archived"
    end

    test "rejects invalid transitions" do
      {:ok, project} = Projects.create_project(%{slug: "bad-trans", name: "Bad"})
      assert project.status == "incubating"

      assert {:error, :invalid_transition} = Projects.transition_status(project, "completed")
      assert {:error, :invalid_transition} = Projects.transition_status(project, "paused")
    end
  end

  describe "delete_project/1" do
    test "deletes an existing project" do
      {:ok, project} = Projects.create_project(%{slug: "delete-me", name: "Delete"})
      assert {:ok, _} = Projects.delete_project(project)
      assert Projects.get_project(project.id) == nil
    end
  end
end
