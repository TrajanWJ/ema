defmodule Ema.TasksTest do
  use Ema.DataCase, async: false
  alias Ema.Tasks
  alias Ema.Projects

  defp create_project(slug \\ "test-project") do
    {:ok, project} = Projects.create_project(%{slug: slug, name: "Test Project"})
    project
  end

  describe "create_task/1" do
    test "creates a task with valid attrs" do
      assert {:ok, task} = Tasks.create_task(%{title: "Do something"})
      assert task.title == "Do something"
      assert task.status == "proposed"
      assert task.priority == 3
      assert String.starts_with?(task.id, "task_")
    end

    test "fails without title" do
      assert {:error, changeset} = Tasks.create_task(%{})
      assert %{title: ["can't be blank"]} = errors_on(changeset)
    end

    test "validates status" do
      assert {:error, changeset} = Tasks.create_task(%{title: "Bad", status: "invalid"})
      assert %{status: [_]} = errors_on(changeset)
    end

    test "validates priority range" do
      assert {:error, changeset} = Tasks.create_task(%{title: "Bad", priority: 99})
      assert %{priority: [_]} = errors_on(changeset)
    end

    test "validates effort values" do
      assert {:ok, _} = Tasks.create_task(%{title: "Small", effort: "s"})
      assert {:error, changeset} = Tasks.create_task(%{title: "Bad", effort: "huge"})
      assert %{effort: [_]} = errors_on(changeset)
    end

    test "creates task linked to project" do
      project = create_project()
      assert {:ok, task} = Tasks.create_task(%{title: "Project task", project_id: project.id})
      assert task.project_id == project.id
    end

    test "creates task with all fields" do
      project = create_project()

      attrs = %{
        title: "Full task",
        description: "A complete task",
        status: "todo",
        priority: 1,
        source_type: "manual",
        effort: "m",
        due_date: ~D[2026-04-15],
        sort_order: 1,
        metadata: %{"key" => "value"},
        project_id: project.id
      }

      assert {:ok, task} = Tasks.create_task(attrs)
      assert task.title == "Full task"
      assert task.priority == 1
      assert task.source_type == "manual"
      assert task.effort == "m"
      assert task.due_date == ~D[2026-04-15]
      assert task.metadata == %{"key" => "value"}
    end
  end

  describe "list_by_project/1" do
    test "returns tasks for a specific project" do
      p1 = create_project("proj-1")
      p2 = create_project("proj-2")

      {:ok, _} = Tasks.create_task(%{title: "Task A", project_id: p1.id})
      {:ok, _} = Tasks.create_task(%{title: "Task B", project_id: p1.id})
      {:ok, _} = Tasks.create_task(%{title: "Task C", project_id: p2.id})

      tasks = Tasks.list_by_project(p1.id)
      assert length(tasks) == 2
      assert Enum.all?(tasks, &(&1.project_id == p1.id))
    end
  end

  describe "list_by_status/1" do
    test "returns tasks filtered by status" do
      {:ok, _} = Tasks.create_task(%{title: "Proposed", status: "proposed"})
      {:ok, _} = Tasks.create_task(%{title: "Todo", status: "todo"})
      {:ok, _} = Tasks.create_task(%{title: "Also todo", status: "todo"})

      todos = Tasks.list_by_status("todo")
      assert length(todos) == 2
    end
  end

  describe "count_by_status/0" do
    test "returns counts grouped by status" do
      {:ok, _} = Tasks.create_task(%{title: "P1", status: "proposed"})
      {:ok, _} = Tasks.create_task(%{title: "P2", status: "proposed"})
      {:ok, _} = Tasks.create_task(%{title: "T1", status: "todo"})

      counts = Tasks.count_by_status()
      assert counts["proposed"] == 2
      assert counts["todo"] == 1
    end
  end

  describe "transition_status/2" do
    test "allows valid transitions" do
      {:ok, task} = Tasks.create_task(%{title: "Transition test"})
      assert task.status == "proposed"

      assert {:ok, todo} = Tasks.transition_status(task, "todo")
      assert todo.status == "todo"

      assert {:ok, in_progress} = Tasks.transition_status(todo, "in_progress")
      assert in_progress.status == "in_progress"

      assert {:ok, in_review} = Tasks.transition_status(in_progress, "in_review")
      assert in_review.status == "in_review"

      assert {:ok, done} = Tasks.transition_status(in_review, "done")
      assert done.status == "done"
      assert done.completed_at != nil
    end

    test "rejects invalid transitions" do
      {:ok, task} = Tasks.create_task(%{title: "Bad transition"})
      assert task.status == "proposed"

      assert {:error, :invalid_transition} = Tasks.transition_status(task, "done")
      assert {:error, :invalid_transition} = Tasks.transition_status(task, "in_progress")
    end

    test "sets completed_at when transitioning to done" do
      {:ok, task} = Tasks.create_task(%{title: "Complete me", status: "todo"})
      {:ok, in_progress} = Tasks.transition_status(task, "in_progress")
      {:ok, done} = Tasks.transition_status(in_progress, "done")

      assert done.completed_at != nil
    end
  end

  describe "comments" do
    test "add_comment/2 creates a comment on a task" do
      {:ok, task} = Tasks.create_task(%{title: "Commented task"})

      assert {:ok, comment} = Tasks.add_comment(task.id, %{body: "A note"})
      assert comment.body == "A note"
      assert comment.source == "user"
      assert comment.task_id == task.id
      assert String.starts_with?(comment.id, "tc_")
    end

    test "add_comment/2 with agent source" do
      {:ok, task} = Tasks.create_task(%{title: "Agent task"})
      assert {:ok, comment} = Tasks.add_comment(task.id, %{body: "Agent output", source: "agent"})
      assert comment.source == "agent"
    end

    test "list_comments/1 returns comments in order" do
      {:ok, task} = Tasks.create_task(%{title: "Multi-comment"})
      {:ok, _} = Tasks.add_comment(task.id, %{body: "First"})
      {:ok, _} = Tasks.add_comment(task.id, %{body: "Second"})

      comments = Tasks.list_comments(task.id)
      assert length(comments) == 2
      assert hd(comments).body == "First"
    end
  end

  describe "get_with_subtasks/1" do
    test "returns task with preloaded subtasks and comments" do
      {:ok, parent} = Tasks.create_task(%{title: "Parent"})
      {:ok, _child} = Tasks.create_task(%{title: "Child", parent_id: parent.id})
      {:ok, _} = Tasks.add_comment(parent.id, %{body: "A comment"})

      loaded = Tasks.get_with_subtasks(parent.id)
      assert loaded != nil
      assert length(loaded.subtasks) == 1
      assert hd(loaded.subtasks).title == "Child"
      assert length(loaded.comments) == 1
    end

    test "returns nil for nonexistent task" do
      assert Tasks.get_with_subtasks("nonexistent") == nil
    end
  end

  describe "update_task/2" do
    test "updates task fields" do
      {:ok, task} = Tasks.create_task(%{title: "Original"})
      assert {:ok, updated} = Tasks.update_task(task, %{title: "Updated", priority: 1})
      assert updated.title == "Updated"
      assert updated.priority == 1
    end
  end

  describe "delete_task/1" do
    test "deletes a task" do
      {:ok, task} = Tasks.create_task(%{title: "Delete me"})
      assert {:ok, _} = Tasks.delete_task(task)
      assert Tasks.get_task(task.id) == nil
    end
  end
end
