defmodule Ema.Projects.ContextDoc do
  @moduledoc """
  Generates a markdown context document for a project, suitable for injection
  into Claude prompts. Pulls live data from Projects.get_context/1 which
  aggregates tasks, proposals, executions, and vault notes.
  """

  alias Ema.Projects

  @doc """
  Generate a project context document as a markdown string.

  Returns `{:ok, markdown}` or `{:error, reason}`.
  """
  def generate(project_id) when is_binary(project_id) do
    case Projects.get_context(project_id) do
      nil ->
        {:error, {:not_found, project_id}}

      context ->
        {:ok, format(context)}
    end
  rescue
    e -> {:error, {:generate_failed, Exception.message(e)}}
  end

  # ── Formatting ───────────────────────────────────────────────────────────────

  defp format(%{project: project} = ctx) do
    sections = [
      project_header(project),
      tasks_section(ctx.tasks),
      proposals_section(ctx.proposals),
      executions_section(ctx.executions),
      vault_section(ctx.vault),
      last_activity_line(ctx.last_activity)
    ]

    sections
    |> Enum.reject(&(String.trim(&1) == ""))
    |> Enum.join("\n\n")
  end

  defp project_header(project) do
    lines = [
      "## Project Context: #{project.name}",
      "",
      "**Status:** #{project.status}",
      "**ID:** #{project.id}"
    ]

    lines =
      if project.description && project.description != "" do
        lines ++ ["**Description:** #{project.description}"]
      else
        lines
      end

    Enum.join(lines, "\n")
  end

  defp tasks_section(%{total: 0}), do: ""

  defp tasks_section(%{total: total, by_status: by_status, recent: recent}) do
    status_summary =
      by_status
      |> Enum.map(fn {status, count} -> "#{status}: #{count}" end)
      |> Enum.join(", ")

    completed_tasks =
      recent
      |> Enum.filter(&(&1.status in ["done", "completed"]))
      |> Enum.take(5)

    open_tasks =
      recent
      |> Enum.filter(&(&1.status in ["todo", "in_progress", "proposed", "blocked"]))
      |> Enum.sort_by(& &1.status)

    parts = ["### Tasks (#{total} total — #{status_summary})"]

    parts =
      if Enum.empty?(completed_tasks) do
        parts
      else
        items =
          Enum.map(completed_tasks, fn t ->
            "- ✅ #{t.title}"
          end)

        parts ++ ["**Recently completed:**"] ++ items
      end

    parts =
      if Enum.empty?(open_tasks) do
        parts
      else
        items =
          Enum.map(open_tasks, fn t ->
            marker = status_marker(t.status)
            "- #{marker} #{t.title} (#{t.status})"
          end)

        parts ++ ["**Open tasks:**"] ++ items
      end

    Enum.join(parts, "\n")
  end

  defp proposals_section(%{total: 0}), do: ""

  defp proposals_section(%{total: total, by_status: by_status, recent: recent}) do
    active =
      recent
      |> Enum.filter(&(&1.status in ["active", "pending", "draft", "proposed"]))
      |> Enum.take(3)

    if Enum.empty?(active) do
      "### Proposals (#{total} total)"
    else
      status_summary =
        by_status
        |> Enum.map(fn {s, c} -> "#{s}: #{c}" end)
        |> Enum.join(", ")

      items =
        Enum.map(active, fn p ->
          preview = if p.body_preview, do: " — #{String.slice(p.body_preview, 0, 80)}...", else: ""
          "- [#{p.status}]#{preview}"
        end)

      (["### Proposals (#{total} — #{status_summary})", "**Active:"]  ++ items)
      |> Enum.join("\n")
    end
  end

  defp executions_section(%{recent: [], success_rate: _}), do: ""

  defp executions_section(%{recent: recent, success_rate: rate}) do
    rate_pct = Float.round(rate * 100, 0) |> trunc()

    items =
      Enum.map(recent, fn e ->
        ts = format_dt(e.started_at)
        "- [#{e.status}] #{ts}"
      end)

    (["### Recent Executions (success rate: #{rate_pct}%)"] ++ items)
    |> Enum.join("\n")
  end

  defp vault_section(%{note_count: 0}), do: ""

  defp vault_section(%{note_count: count, recent_notes: notes}) do
    items =
      Enum.map(notes, fn n ->
        "- #{n.title || Path.basename(n.file_path || "", ".md")}"
      end)

    (["### Vault Notes (#{count} total)"] ++ items)
    |> Enum.join("\n")
  end

  defp last_activity_line(nil), do: ""

  defp last_activity_line(dt) do
    "_Last activity: #{format_dt(dt)}_"
  end

  defp status_marker("in_progress"), do: "🔄"
  defp status_marker("blocked"), do: "🚫"
  defp status_marker("todo"), do: "📋"
  defp status_marker(_), do: "•"

  defp format_dt(nil), do: "unknown"
  defp format_dt(%DateTime{} = dt), do: Calendar.strftime(dt, "%Y-%m-%d %H:%M UTC")
  defp format_dt(%NaiveDateTime{} = ndt), do: NaiveDateTime.to_string(ndt)
  defp format_dt(other), do: to_string(other)
end
