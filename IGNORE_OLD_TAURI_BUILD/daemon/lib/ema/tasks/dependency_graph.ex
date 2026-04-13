defmodule Ema.Tasks.DependencyGraph do
  @moduledoc """
  Dependency graph operations for tasks.

  Uses the existing `task_dependencies` join table where:
  - `task_id` = the task that depends on something
  - `dependency_id` = the task it depends on (must finish first)

  A task is "ready" when all its dependencies are in a terminal status.
  A task is "blocked" when at least one dependency is not terminal.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Tasks.Task

  @terminal_statuses ~w(done cancelled archived)

  @doc "Add a dependency: `task_id` depends on `dependency_id`."
  def add_dependency(task_id, dependency_id) when task_id == dependency_id do
    {:error, :self_dependency}
  end

  def add_dependency(task_id, dependency_id) do
    # Check for circular dependency before inserting
    if creates_cycle?(task_id, dependency_id) do
      {:error, :circular_dependency}
    else
      Repo.query(
        "INSERT OR IGNORE INTO task_dependencies (task_id, dependency_id) VALUES (?1, ?2)",
        [task_id, dependency_id]
      )
      |> case do
        {:ok, _} -> :ok
        {:error, reason} -> {:error, reason}
      end
    end
  end

  @doc "Remove a dependency."
  def remove_dependency(task_id, dependency_id) do
    Repo.query(
      "DELETE FROM task_dependencies WHERE task_id = ?1 AND dependency_id = ?2",
      [task_id, dependency_id]
    )
    |> case do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Set the full dependency list for a task (replaces existing)."
  def set_dependencies(task_id, dependency_ids) when is_list(dependency_ids) do
    filtered = Enum.reject(dependency_ids, &(&1 == task_id))

    Repo.transaction(fn ->
      Repo.query!("DELETE FROM task_dependencies WHERE task_id = ?1", [task_id])

      Enum.each(filtered, fn dep_id ->
        if creates_cycle?(task_id, dep_id) do
          Repo.rollback({:circular_dependency, dep_id})
        end

        Repo.query!(
          "INSERT OR IGNORE INTO task_dependencies (task_id, dependency_id) VALUES (?1, ?2)",
          [task_id, dep_id]
        )
      end)
    end)
  end

  @doc "List dependency IDs for a task."
  def dependency_ids(task_id) do
    from("task_dependencies", where: [task_id: ^task_id], select: [:dependency_id])
    |> Repo.all()
    |> Enum.map(& &1.dependency_id)
  end

  @doc "List IDs of tasks that depend on `task_id`."
  def dependent_ids(task_id) do
    from("task_dependencies", where: [dependency_id: ^task_id], select: [:task_id])
    |> Repo.all()
    |> Enum.map(& &1.task_id)
  end

  @doc """
  Build a map of task_id => list of task_ids it blocks.
  Inverted view: for each dependency edge (A depends on B), B blocks A.
  """
  def build_blocks_map(tasks) do
    task_ids = Enum.map(tasks, & &1.id)

    edges =
      from("task_dependencies",
        where: [task_id: ^task_ids],
        select: [:task_id, :dependency_id]
      )
      |> Repo.all()

    Enum.reduce(edges, %{}, fn edge, acc ->
      Map.update(acc, edge.dependency_id, [edge.task_id], &[edge.task_id | &1])
    end)
  end

  @doc "Return tasks whose dependencies are ALL in a terminal status (or have no deps)."
  def filter_ready(tasks) do
    task_map = Map.new(tasks, &{&1.id, &1})
    task_ids = Map.keys(task_map)

    # Load all dependency edges for these tasks
    dep_edges =
      from("task_dependencies",
        where: [task_id: ^task_ids],
        select: [:task_id, :dependency_id]
      )
      |> Repo.all()

    # Group by task_id
    deps_by_task =
      Enum.group_by(dep_edges, & &1.task_id, & &1.dependency_id)

    # For deps not in our task list, load their statuses
    all_dep_ids =
      dep_edges
      |> Enum.map(& &1.dependency_id)
      |> Enum.uniq()

    external_dep_ids = Enum.reject(all_dep_ids, &Map.has_key?(task_map, &1))

    external_statuses =
      if external_dep_ids == [] do
        %{}
      else
        Task
        |> where([t], t.id in ^external_dep_ids)
        |> select([t], {t.id, t.status})
        |> Repo.all()
        |> Map.new()
      end

    status_for = fn id ->
      case Map.get(task_map, id) do
        nil -> Map.get(external_statuses, id, "unknown")
        task -> task.status
      end
    end

    Enum.filter(tasks, fn task ->
      dep_ids = Map.get(deps_by_task, task.id, [])
      Enum.all?(dep_ids, fn dep_id -> status_for.(dep_id) in @terminal_statuses end)
    end)
  end

  @doc "Return tasks that have at least one non-terminal dependency."
  def filter_blocked(tasks) do
    ready_ids = filter_ready(tasks) |> MapSet.new(& &1.id)

    Enum.reject(tasks, fn task ->
      MapSet.member?(ready_ids, task.id)
    end)
  end

  @doc """
  Topological sort of tasks by dependency order.
  Tasks with no dependencies come first.
  Falls back to insertion order for tasks at the same depth.
  """
  def topological_sort(tasks) do
    task_ids = Enum.map(tasks, & &1.id)

    dep_edges =
      from("task_dependencies",
        where: [task_id: ^task_ids],
        select: [:task_id, :dependency_id]
      )
      |> Repo.all()

    task_map = Map.new(tasks, &{&1.id, &1})

    # Kahn's algorithm
    in_degree =
      Enum.reduce(tasks, %{}, fn t, acc -> Map.put(acc, t.id, 0) end)
      |> then(fn degrees ->
        Enum.reduce(dep_edges, degrees, fn edge, acc ->
          if Map.has_key?(acc, edge.task_id) and Map.has_key?(acc, edge.dependency_id) do
            Map.update(acc, edge.task_id, 1, &(&1 + 1))
          else
            acc
          end
        end)
      end)

    # Build adjacency list (dependency_id -> list of task_ids it unblocks)
    adj =
      Enum.reduce(dep_edges, %{}, fn edge, acc ->
        if Map.has_key?(task_map, edge.task_id) and Map.has_key?(task_map, edge.dependency_id) do
          Map.update(acc, edge.dependency_id, [edge.task_id], &[edge.task_id | &1])
        else
          acc
        end
      end)

    queue =
      in_degree
      |> Enum.filter(fn {_id, deg} -> deg == 0 end)
      |> Enum.map(fn {id, _} -> id end)
      |> Enum.sort()

    do_topo_sort(queue, adj, in_degree, task_map, [])
  end

  defp do_topo_sort([], _adj, _in_degree, _task_map, acc) do
    Enum.reverse(acc)
  end

  defp do_topo_sort([id | rest], adj, in_degree, task_map, acc) do
    task = Map.get(task_map, id)
    neighbors = Map.get(adj, id, [])

    {new_queue_items, new_in_degree} =
      Enum.reduce(neighbors, {[], in_degree}, fn n_id, {q, deg} ->
        new_deg = Map.update!(deg, n_id, &(&1 - 1))

        if new_deg[n_id] == 0 do
          {[n_id | q], new_deg}
        else
          {q, new_deg}
        end
      end)

    next_queue = rest ++ Enum.sort(new_queue_items)
    do_topo_sort(next_queue, adj, new_in_degree, task_map, [task | acc])
  end

  # Check if adding edge (task_id depends on dependency_id) creates a cycle.
  # A cycle exists if dependency_id can already reach task_id through existing edges.
  defp creates_cycle?(task_id, dependency_id) do
    # BFS from dependency_id's own dependencies to see if we reach task_id
    reachable?(dependency_id, task_id, MapSet.new())
  end

  defp reachable?(from_id, target_id, visited) do
    if from_id == target_id do
      true
    else
      if MapSet.member?(visited, from_id) do
        false
      else
        visited = MapSet.put(visited, from_id)
        deps = dependency_ids(from_id)

        Enum.any?(deps, fn dep_id ->
          reachable?(dep_id, target_id, visited)
        end)
      end
    end
  end
end
