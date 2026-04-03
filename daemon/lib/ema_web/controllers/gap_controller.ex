defmodule EmaWeb.GapController do
  use EmaWeb, :controller

  alias Ema.Intelligence.GapInbox

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:source, params["source"])
      |> maybe_add(:severity, params["severity"])
      |> maybe_add(:project_id, params["project_id"])
      |> maybe_add(:status, params["status"])

    gaps = GapInbox.list_gaps(opts) |> Enum.map(&serialize/1)
    counts = GapInbox.gap_counts()

    json(conn, %{gaps: gaps, counts: counts})
  end

  def resolve(conn, %{"id" => id}) do
    with {:ok, gap} <- GapInbox.resolve_gap(id) do
      EmaWeb.Endpoint.broadcast("gaps:live", "gap_resolved", serialize(gap))
      json(conn, serialize(gap))
    end
  end

  def create_task(conn, %{"id" => id}) do
    case GapInbox.get_gap(id) do
      nil ->
        {:error, :not_found}

      gap ->
        task_attrs = %{
          title: gap.title,
          description: gap.description || "Created from gap: #{gap.gap_type}",
          status: "todo",
          priority: severity_to_priority(gap.severity),
          project_id: gap.project_id
        }

        with {:ok, task} <- Ema.Tasks.create_task(task_attrs),
             {:ok, _} <- GapInbox.resolve_gap(id) do
          json(conn, %{task_id: task.id, gap_id: gap.id})
        end
    end
  end

  def scan(conn, _params) do
    GapInbox.scan_all()
    counts = GapInbox.gap_counts()
    json(conn, %{ok: true, counts: counts})
  end

  defp serialize(gap) do
    %{
      id: gap.id,
      source: gap.source,
      gap_type: gap.gap_type,
      title: gap.title,
      description: gap.description,
      severity: gap.severity,
      project_id: gap.project_id,
      file_path: gap.file_path,
      line_number: gap.line_number,
      status: gap.status,
      resolved_at: gap.resolved_at,
      created_at: gap.inserted_at
    }
  end

  defp severity_to_priority("critical"), do: "urgent"
  defp severity_to_priority("high"), do: "high"
  defp severity_to_priority("medium"), do: "medium"
  defp severity_to_priority(_), do: "low"

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)
end
