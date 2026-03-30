defmodule Ema.ResponsibilitiesTest do
  use Ema.DataCase, async: false
  alias Ema.Responsibilities
  alias Ema.Projects
  alias Ema.Tasks

  defp create_project(slug \\ "test-project") do
    {:ok, project} = Projects.create_project(%{slug: slug, name: "Test Project"})
    project
  end

  defp create_responsibility(attrs \\ %{}) do
    defaults = %{title: "Code review", role: "developer", cadence: "weekly"}
    {:ok, resp} = Responsibilities.create_responsibility(Map.merge(defaults, attrs))
    resp
  end

  describe "create_responsibility/1" do
    test "creates with valid attrs" do
      assert {:ok, resp} = Responsibilities.create_responsibility(%{title: "Deploy checks"})
      assert resp.title == "Deploy checks"
      assert resp.health == 1.0
      assert resp.active == true
      assert String.starts_with?(resp.id, "resp_")
    end

    test "fails without title" do
      assert {:error, changeset} = Responsibilities.create_responsibility(%{})
      assert %{title: ["can't be blank"]} = errors_on(changeset)
    end

    test "validates role" do
      assert {:error, changeset} =
               Responsibilities.create_responsibility(%{title: "Bad", role: "wizard"})

      assert %{role: [_]} = errors_on(changeset)
    end

    test "validates cadence" do
      assert {:error, changeset} =
               Responsibilities.create_responsibility(%{title: "Bad", cadence: "hourly"})

      assert %{cadence: [_]} = errors_on(changeset)
    end

    test "creates with project association" do
      project = create_project()

      assert {:ok, resp} =
               Responsibilities.create_responsibility(%{
                 title: "Project resp",
                 project_id: project.id
               })

      assert resp.project_id == project.id
    end

    test "creates with all fields" do
      project = create_project()

      attrs = %{
        title: "Full responsibility",
        description: "Complete description",
        role: "maintainer",
        cadence: "monthly",
        recurrence_rule: "FREQ=MONTHLY;BYDAY=MO",
        metadata: %{"priority" => "high"},
        project_id: project.id
      }

      assert {:ok, resp} = Responsibilities.create_responsibility(attrs)
      assert resp.title == "Full responsibility"
      assert resp.role == "maintainer"
      assert resp.cadence == "monthly"
      assert resp.metadata == %{"priority" => "high"}
    end
  end

  describe "list_responsibilities/1" do
    test "returns all responsibilities" do
      create_responsibility(%{title: "A"})
      create_responsibility(%{title: "B"})

      resps = Responsibilities.list_responsibilities()
      assert length(resps) == 2
    end

    test "filters by project_id" do
      p1 = create_project("proj-1")
      p2 = create_project("proj-2")
      create_responsibility(%{title: "A", project_id: p1.id})
      create_responsibility(%{title: "B", project_id: p2.id})

      resps = Responsibilities.list_responsibilities(project_id: p1.id)
      assert length(resps) == 1
      assert hd(resps).title == "A"
    end

    test "filters by role" do
      create_responsibility(%{title: "A", role: "developer"})
      create_responsibility(%{title: "B", role: "self"})

      resps = Responsibilities.list_responsibilities(role: "developer")
      assert length(resps) == 1
      assert hd(resps).role == "developer"
    end

    test "filters by active" do
      resp = create_responsibility(%{title: "Active"})
      {:ok, _} = Responsibilities.toggle_responsibility(resp)
      create_responsibility(%{title: "Still active"})

      active = Responsibilities.list_responsibilities(active: true)
      assert length(active) == 1
      assert hd(active).title == "Still active"
    end
  end

  describe "list_by_role/0" do
    test "returns responsibilities grouped by role" do
      create_responsibility(%{title: "A", role: "developer"})
      create_responsibility(%{title: "B", role: "developer"})
      create_responsibility(%{title: "C", role: "self"})

      grouped = Responsibilities.list_by_role()
      assert length(grouped["developer"]) == 2
      assert length(grouped["self"]) == 1
    end
  end

  describe "list_by_role/1" do
    test "returns responsibilities for a specific role" do
      create_responsibility(%{title: "A", role: "developer"})
      create_responsibility(%{title: "B", role: "self"})

      resps = Responsibilities.list_by_role("developer")
      assert length(resps) == 1
      assert hd(resps).role == "developer"
    end
  end

  describe "update_responsibility/2" do
    test "updates fields" do
      resp = create_responsibility()
      assert {:ok, updated} = Responsibilities.update_responsibility(resp, %{title: "Updated"})
      assert updated.title == "Updated"
    end
  end

  describe "delete_responsibility/1" do
    test "deletes a responsibility" do
      resp = create_responsibility()
      assert {:ok, _} = Responsibilities.delete_responsibility(resp)
      assert Responsibilities.get_responsibility(resp.id) == nil
    end
  end

  describe "toggle_responsibility/1" do
    test "toggles active status" do
      resp = create_responsibility()
      assert resp.active == true

      assert {:ok, toggled} = Responsibilities.toggle_responsibility(resp)
      assert toggled.active == false

      assert {:ok, toggled_back} = Responsibilities.toggle_responsibility(toggled)
      assert toggled_back.active == true
    end
  end

  describe "check_in/2" do
    test "creates a check-in and updates health" do
      resp = create_responsibility()

      assert {:ok, {updated_resp, check_in}} =
               Responsibilities.check_in(resp, %{status: "at_risk", note: "Falling behind"})

      assert updated_resp.health == 0.5
      assert updated_resp.last_checked_at != nil
      assert check_in.status == "at_risk"
      assert check_in.note == "Falling behind"
      assert String.starts_with?(check_in.id, "rci_")
    end

    test "rejects invalid check-in status" do
      resp = create_responsibility()

      assert {:error, changeset} =
               Responsibilities.check_in(resp, %{status: "unknown"})

      assert %{status: [_]} = errors_on(changeset)
    end
  end

  describe "list_check_ins/1" do
    test "returns check-ins for a responsibility" do
      resp = create_responsibility()
      {:ok, _} = Responsibilities.check_in(resp, %{status: "healthy", note: "All good"})
      {:ok, _} = Responsibilities.check_in(resp, %{status: "at_risk", note: "Slipping"})

      check_ins = Responsibilities.list_check_ins(resp.id)
      assert length(check_ins) == 2
      notes = Enum.map(check_ins, & &1.note)
      assert "All good" in notes
      assert "Slipping" in notes
    end
  end

  describe "recalculate_health/1" do
    test "returns healthy when no tasks" do
      resp = create_responsibility()
      assert {:ok, updated} = Responsibilities.recalculate_health(resp)
      assert updated.health == 1.0
    end

    test "returns healthy when most tasks are done" do
      project = create_project("health-proj")
      resp = create_responsibility(%{title: "Health test", project_id: project.id})

      # Create tasks linked to this responsibility
      {:ok, t1} =
        Tasks.create_task(%{
          title: "Task 1",
          responsibility_id: resp.id,
          status: "todo"
        })

      {:ok, t2} =
        Tasks.create_task(%{
          title: "Task 2",
          responsibility_id: resp.id,
          status: "todo"
        })

      {:ok, t3} =
        Tasks.create_task(%{
          title: "Task 3",
          responsibility_id: resp.id,
          status: "todo"
        })

      # Complete most tasks
      {:ok, _} = Tasks.transition_status(t1, "in_progress")
      t1 = Tasks.get_task!(t1.id)
      {:ok, _} = Tasks.transition_status(t1, "done")

      {:ok, _} = Tasks.transition_status(t2, "in_progress")
      t2 = Tasks.get_task!(t2.id)
      {:ok, _} = Tasks.transition_status(t2, "done")

      {:ok, _} = Tasks.transition_status(t3, "in_progress")
      t3 = Tasks.get_task!(t3.id)
      {:ok, _} = Tasks.transition_status(t3, "done")

      # Reload responsibility to get fresh state
      resp = Responsibilities.get_responsibility!(resp.id)
      assert {:ok, updated} = Responsibilities.recalculate_health(resp)
      assert updated.health == 1.0
    end
  end

  describe "list_at_risk/0" do
    test "returns responsibilities with at_risk or failing health" do
      _resp1 = create_responsibility(%{title: "Healthy"})
      resp2 = create_responsibility(%{title: "At risk"})
      resp3 = create_responsibility(%{title: "Failing"})

      {:ok, _} = Responsibilities.update_responsibility(resp2, %{health: 0.5})
      {:ok, _} = Responsibilities.update_responsibility(resp3, %{health: 0.2})

      at_risk = Responsibilities.list_at_risk()
      assert length(at_risk) == 2
      titles = Enum.map(at_risk, & &1.title) |> Enum.sort()
      assert titles == ["At risk", "Failing"]
    end

    test "excludes inactive responsibilities" do
      resp = create_responsibility(%{title: "Inactive risk"})
      {:ok, resp} = Responsibilities.update_responsibility(resp, %{health: 0.5})
      {:ok, _} = Responsibilities.toggle_responsibility(resp)

      at_risk = Responsibilities.list_at_risk()
      assert length(at_risk) == 0
    end
  end

  describe "generate_due_tasks/0" do
    test "generates tasks for responsibilities with no last_checked_at" do
      create_responsibility(%{title: "Never checked", cadence: "daily"})

      results = Responsibilities.generate_due_tasks()
      assert length(results) == 1
      assert {:ok, task} = hd(results)
      assert task.source_type == "responsibility"
      assert task.status == "todo"
    end

    test "skips ongoing cadence" do
      create_responsibility(%{title: "Ongoing", cadence: "ongoing"})

      results = Responsibilities.generate_due_tasks()
      assert length(results) == 0
    end

    test "skips inactive responsibilities" do
      resp = create_responsibility(%{title: "Inactive", cadence: "daily"})
      {:ok, _} = Responsibilities.toggle_responsibility(resp)

      results = Responsibilities.generate_due_tasks()
      assert length(results) == 0
    end

    test "skips responsibilities without cadence" do
      create_responsibility(%{title: "No cadence", cadence: nil})

      results = Responsibilities.generate_due_tasks()
      assert length(results) == 0
    end
  end
end
