defmodule EmaWeb.AdvisorController do
  use EmaWeb, :controller

  alias Ema.{BrainDump, Tasks, Proposals}

  def now(conn, _params) do
    tasks =
      case Tasks.list_tasks(status: "todo") do
        tasks when is_list(tasks) -> tasks
        _ -> []
      end

    top_task =
      tasks
      |> Enum.sort_by(fn t -> t.priority || 999 end)
      |> List.first()

    queued_count =
      case Proposals.list_proposals(status: "queued") do
        proposals when is_list(proposals) -> length(proposals)
        _ -> 0
      end

    inbox_count = BrainDump.unprocessed_count()

    recommendation =
      cond do
        inbox_count > 5 ->
          "Process your inbox — #{inbox_count} unprocessed items waiting."

        top_task != nil ->
          "Work on: #{top_task.title} (P#{top_task.priority || "-"})"

        queued_count > 0 ->
          "Review #{queued_count} queued proposals."

        true ->
          "All clear. Consider journaling or planning ahead."
      end

    json(conn, %{
      recommendation: recommendation,
      context: %{
        open_tasks: length(tasks),
        inbox_count: inbox_count,
        queued_proposals: queued_count
      }
    })
  end
end
