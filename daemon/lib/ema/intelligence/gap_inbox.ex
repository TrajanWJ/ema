defmodule Ema.Intelligence.GapInbox do
  @moduledoc """
  Gap Inbox — aggregates gaps from multiple sources: TODOs, stale tasks,
  orphan vault notes, incomplete goals, missing docs, and Superman code analysis.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Intelligence.Gap

  # ── CRUD ──

  def list_gaps(opts \\ []) do
    query =
      Gap
      |> where([g], g.status == "open")
      |> order_by([g], [asc: fragment("CASE ? WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END", g.severity), desc: g.inserted_at])

    query =
      case Keyword.get(opts, :source) do
        nil -> query
        src -> where(query, [g], g.source == ^src)
      end

    query =
      case Keyword.get(opts, :severity) do
        nil -> query
        sev -> where(query, [g], g.severity == ^sev)
      end

    query =
      case Keyword.get(opts, :project_id) do
        nil -> query
        pid -> where(query, [g], g.project_id == ^pid)
      end

    query =
      case Keyword.get(opts, :status) do
        nil -> query
        st -> query |> where([g], g.status == ^st)
      end

    Repo.all(query)
  end

  def get_gap(id), do: Repo.get(Gap, id)

  def create_gap(attrs) do
    id = generate_id("gap")

    %Gap{}
    |> Gap.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def resolve_gap(id) do
    case get_gap(id) do
      nil ->
        {:error, :not_found}

      gap ->
        gap
        |> Gap.changeset(%{status: "resolved", resolved_at: DateTime.utc_now()})
        |> Repo.update()
    end
  end

  def gap_counts do
    Gap
    |> where([g], g.status == "open")
    |> group_by(:severity)
    |> select([g], {g.severity, count(g.id)})
    |> Repo.all()
    |> Map.new()
  end

  # ── Scanners ──

  def scan_all do
    scan_stale_tasks()
    scan_orphan_notes()
    scan_incomplete_goals()
    :ok
  end

  def scan_stale_tasks do
    threshold = DateTime.utc_now() |> DateTime.add(-14, :day)

    stale =
      Ema.Tasks.Task
      |> where([t], t.status not in ["done", "cancelled"])
      |> where([t], t.updated_at < ^threshold)
      |> Repo.all()

    for task <- stale do
      unless gap_exists?("tasks", "stale_task", task.id) do
        create_gap(%{
          source: "tasks",
          gap_type: "stale_task",
          title: "Stale task: #{task.title}",
          description: "Task not updated in 14+ days (last: #{task.updated_at})",
          severity: "medium",
          project_id: task.project_id
        })
      end
    end
  end

  def scan_orphan_notes do
    orphans =
      Ema.SecondBrain.Note
      |> where([n], is_nil(n.source_type) or n.source_type == "user")
      |> Repo.all()
      |> Enum.filter(fn note ->
        link_count =
          Ema.SecondBrain.Link
          |> where([l], l.source_note_id == ^note.id or l.target_note_id == ^note.id)
          |> Repo.aggregate(:count)

        link_count == 0
      end)

    for note <- orphans do
      unless gap_exists?("orphans", "orphan_note", note.id) do
        create_gap(%{
          source: "orphans",
          gap_type: "orphan_note",
          title: "Orphan note: #{note.title || note.file_path}",
          description: "Vault note with no connections",
          severity: "low",
          file_path: note.file_path
        })
      end
    end
  end

  def scan_incomplete_goals do
    goals =
      Ema.Goals.Goal
      |> where([g], g.status != "completed")
      |> Repo.all()

    for goal <- goals do
      linked_tasks =
        Ema.Tasks.Task
        |> where([t], t.project_id == ^goal.project_id)
        |> Repo.aggregate(:count)

      if linked_tasks == 0 do
        unless gap_exists?("goals", "incomplete_goal", goal.id) do
          create_gap(%{
            source: "goals",
            gap_type: "incomplete_goal",
            title: "Goal with no tasks: #{goal.title}",
            description: "Goal has no linked tasks for progress tracking",
            severity: "medium"
          })
        end
      end
    end
  rescue
    # Goals module may not have all fields yet
    _ -> :ok
  end

  # ── Helpers ──

  defp gap_exists?(source, gap_type, ref_id) do
    like_pattern = "%#{ref_id}%"

    Gap
    |> where([g], g.source == ^source and g.gap_type == ^gap_type and g.status == "open")
    |> where([g], like(g.title, ^like_pattern) or like(g.description, ^like_pattern))
    |> Repo.exists?()
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
