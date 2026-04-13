defmodule Ema.Tasks.DependencyGraphTest do
  use Ema.DataCase, async: false

  alias Ema.Tasks
  alias Ema.Tasks.DependencyGraph

  # --- Helpers ---

  defp create_task(title, opts \\ %{}) do
    {:ok, task} = Tasks.create_task(Map.merge(%{title: title, status: "todo"}, opts))
    task
  end

  # --- add_dependency/2 ---

  describe "add_dependency/2" do
    test "adds a dependency between two tasks" do
      a = create_task("Task A")
      b = create_task("Task B")

      assert :ok = DependencyGraph.add_dependency(a.id, b.id)
      assert b.id in DependencyGraph.dependency_ids(a.id)
    end

    test "rejects self-dependency" do
      a = create_task("Task A")
      assert {:error, :self_dependency} = DependencyGraph.add_dependency(a.id, a.id)
    end

    test "rejects circular dependency" do
      a = create_task("Task A")
      b = create_task("Task B")

      :ok = DependencyGraph.add_dependency(a.id, b.id)
      assert {:error, :circular_dependency} = DependencyGraph.add_dependency(b.id, a.id)
    end

    test "rejects transitive circular dependency" do
      a = create_task("A")
      b = create_task("B")
      c = create_task("C")

      :ok = DependencyGraph.add_dependency(a.id, b.id)
      :ok = DependencyGraph.add_dependency(b.id, c.id)
      assert {:error, :circular_dependency} = DependencyGraph.add_dependency(c.id, a.id)
    end

    test "allows diamond dependency (non-circular)" do
      #   A
      #  / \
      # B   C
      #  \ /
      #   D
      a = create_task("A")
      b = create_task("B")
      c = create_task("C")
      d = create_task("D")

      :ok = DependencyGraph.add_dependency(b.id, a.id)
      :ok = DependencyGraph.add_dependency(c.id, a.id)
      :ok = DependencyGraph.add_dependency(d.id, b.id)
      assert :ok = DependencyGraph.add_dependency(d.id, c.id)
    end
  end

  # --- remove_dependency/2 ---

  describe "remove_dependency/2" do
    test "removes an existing dependency" do
      a = create_task("A")
      b = create_task("B")

      :ok = DependencyGraph.add_dependency(a.id, b.id)
      assert b.id in DependencyGraph.dependency_ids(a.id)

      :ok = DependencyGraph.remove_dependency(a.id, b.id)
      refute b.id in DependencyGraph.dependency_ids(a.id)
    end
  end

  # --- dependency_ids/1 and dependent_ids/1 ---

  describe "dependency_ids/1 and dependent_ids/1" do
    test "returns correct forward and reverse edges" do
      a = create_task("A")
      b = create_task("B")
      c = create_task("C")

      # B depends on A, C depends on A
      :ok = DependencyGraph.add_dependency(b.id, a.id)
      :ok = DependencyGraph.add_dependency(c.id, a.id)

      assert DependencyGraph.dependency_ids(b.id) == [a.id]
      assert Enum.sort(DependencyGraph.dependent_ids(a.id)) == Enum.sort([b.id, c.id])
    end

    test "returns empty list when no dependencies" do
      a = create_task("A")
      assert DependencyGraph.dependency_ids(a.id) == []
      assert DependencyGraph.dependent_ids(a.id) == []
    end
  end

  # --- build_blocks_map/1 ---

  describe "build_blocks_map/1" do
    test "returns empty map when no dependencies" do
      tasks = [create_task("A"), create_task("B")]
      assert DependencyGraph.build_blocks_map(tasks) == %{}
    end

    test "returns map of blocker => blocked tasks" do
      a = create_task("A")
      b = create_task("B")
      c = create_task("C")

      # B depends on A, C depends on A
      :ok = DependencyGraph.add_dependency(b.id, a.id)
      :ok = DependencyGraph.add_dependency(c.id, a.id)

      blocks_map = DependencyGraph.build_blocks_map([a, b, c])

      assert Map.has_key?(blocks_map, a.id)
      assert Enum.sort(blocks_map[a.id]) == Enum.sort([b.id, c.id])
      refute Map.has_key?(blocks_map, b.id)
      refute Map.has_key?(blocks_map, c.id)
    end

    test "handles chain dependencies" do
      a = create_task("A")
      b = create_task("B")
      c = create_task("C")

      # C depends on B, B depends on A
      :ok = DependencyGraph.add_dependency(b.id, a.id)
      :ok = DependencyGraph.add_dependency(c.id, b.id)

      blocks_map = DependencyGraph.build_blocks_map([a, b, c])

      assert blocks_map[a.id] == [b.id]
      assert blocks_map[b.id] == [c.id]
    end
  end

  # --- filter_ready/1 ---

  describe "filter_ready/1" do
    test "tasks with no dependencies are ready" do
      a = create_task("A")
      b = create_task("B")

      ready = DependencyGraph.filter_ready([a, b])
      assert length(ready) == 2
    end

    test "task with unsatisfied dependency is not ready" do
      a = create_task("A", %{status: "todo"})
      b = create_task("B")

      :ok = DependencyGraph.add_dependency(b.id, a.id)

      ready = DependencyGraph.filter_ready([a, b])
      ready_ids = Enum.map(ready, & &1.id)

      assert a.id in ready_ids
      refute b.id in ready_ids
    end

    test "task with all dependencies done is ready" do
      a = create_task("A", %{status: "done"})
      b = create_task("B")

      :ok = DependencyGraph.add_dependency(b.id, a.id)

      # Reload a with done status
      a_done = Tasks.get_task(a.id)
      ready = DependencyGraph.filter_ready([a_done, b])
      ready_ids = Enum.map(ready, & &1.id)

      assert a_done.id in ready_ids
      assert b.id in ready_ids
    end

    test "task with cancelled dependency is ready" do
      {:ok, a} = Tasks.create_task(%{title: "A", status: "todo"})
      # Transition to cancelled: todo -> cancelled
      {:ok, a_cancelled} = Tasks.update_task(a, %{status: "cancelled"})
      b = create_task("B")

      :ok = DependencyGraph.add_dependency(b.id, a_cancelled.id)

      ready = DependencyGraph.filter_ready([a_cancelled, b])
      ready_ids = Enum.map(ready, & &1.id)

      assert b.id in ready_ids
    end

    test "task with mixed satisfied and unsatisfied deps is blocked" do
      a = create_task("A", %{status: "done"})
      b = create_task("B", %{status: "todo"})
      c = create_task("C")

      :ok = DependencyGraph.add_dependency(c.id, a.id)
      :ok = DependencyGraph.add_dependency(c.id, b.id)

      a_done = Tasks.get_task(a.id)
      ready = DependencyGraph.filter_ready([a_done, b, c])
      ready_ids = Enum.map(ready, & &1.id)

      assert a_done.id in ready_ids
      refute c.id in ready_ids
    end
  end

  # --- filter_blocked/1 ---

  describe "filter_blocked/1" do
    test "returns inverse of filter_ready" do
      a = create_task("A", %{status: "todo"})
      b = create_task("B")

      :ok = DependencyGraph.add_dependency(b.id, a.id)

      blocked = DependencyGraph.filter_blocked([a, b])
      blocked_ids = Enum.map(blocked, & &1.id)

      assert b.id in blocked_ids
      refute a.id in blocked_ids
    end
  end

  # --- topological_sort/1 ---

  describe "topological_sort/1" do
    test "returns tasks with no deps in sorted order" do
      a = create_task("A")
      b = create_task("B")

      sorted = DependencyGraph.topological_sort([b, a])
      sorted_ids = Enum.map(sorted, & &1.id)

      # Both have no deps, should appear in some stable order
      assert length(sorted_ids) == 2
      assert MapSet.new(sorted_ids) == MapSet.new([a.id, b.id])
    end

    test "dependencies come before dependents" do
      a = create_task("A")
      b = create_task("B")
      c = create_task("C")

      # B depends on A, C depends on B
      :ok = DependencyGraph.add_dependency(b.id, a.id)
      :ok = DependencyGraph.add_dependency(c.id, b.id)

      sorted = DependencyGraph.topological_sort([c, b, a])
      sorted_ids = Enum.map(sorted, & &1.id)

      assert sorted_ids == [a.id, b.id, c.id]
    end

    test "handles diamond dependency correctly" do
      a = create_task("A")
      b = create_task("B")
      c = create_task("C")
      d = create_task("D")

      :ok = DependencyGraph.add_dependency(b.id, a.id)
      :ok = DependencyGraph.add_dependency(c.id, a.id)
      :ok = DependencyGraph.add_dependency(d.id, b.id)
      :ok = DependencyGraph.add_dependency(d.id, c.id)

      sorted = DependencyGraph.topological_sort([d, c, b, a])
      sorted_ids = Enum.map(sorted, & &1.id)

      # A must come before B and C, B and C must come before D
      a_idx = Enum.find_index(sorted_ids, &(&1 == a.id))
      b_idx = Enum.find_index(sorted_ids, &(&1 == b.id))
      c_idx = Enum.find_index(sorted_ids, &(&1 == c.id))
      d_idx = Enum.find_index(sorted_ids, &(&1 == d.id))

      assert a_idx < b_idx
      assert a_idx < c_idx
      assert b_idx < d_idx
      assert c_idx < d_idx
    end

    test "single task returns itself" do
      a = create_task("A")
      assert [result] = DependencyGraph.topological_sort([a])
      assert result.id == a.id
    end

    test "empty list returns empty list" do
      assert DependencyGraph.topological_sort([]) == []
    end
  end

  # --- set_dependencies/2 ---

  describe "set_dependencies/2" do
    test "replaces all dependencies" do
      a = create_task("A")
      b = create_task("B")
      c = create_task("C")

      :ok = DependencyGraph.add_dependency(a.id, b.id)
      assert DependencyGraph.dependency_ids(a.id) == [b.id]

      {:ok, _} = DependencyGraph.set_dependencies(a.id, [c.id])
      deps = DependencyGraph.dependency_ids(a.id)

      assert c.id in deps
      refute b.id in deps
    end

    test "filters out self-dependencies" do
      a = create_task("A")
      b = create_task("B")

      {:ok, _} = DependencyGraph.set_dependencies(a.id, [a.id, b.id])
      deps = DependencyGraph.dependency_ids(a.id)

      assert deps == [b.id]
    end

    test "rolls back on circular dependency" do
      a = create_task("A")
      b = create_task("B")

      :ok = DependencyGraph.add_dependency(a.id, b.id)

      # b depends on a would create cycle
      assert {:error, {:circular_dependency, _}} =
               DependencyGraph.set_dependencies(b.id, [a.id])

      # Original state preserved
      assert DependencyGraph.dependency_ids(b.id) == []
    end
  end
end
