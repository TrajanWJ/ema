defmodule Ema.CLI.Commands.Now do
  @moduledoc "CLI command for 'what should I do now?' — advisor recommendations."

  alias Ema.CLI.Output

  def handle([], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Http ->
        case transport.get("/advisor/now") do
          {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Direct ->
        recommendation = generate_recommendation()
        if opts[:json], do: Output.json(recommendation), else: Output.detail(recommendation)
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown now subcommand: #{inspect(sub)}")
  end

  defp generate_recommendation do
    # Gather context for a basic recommendation
    tasks =
      case Ema.Tasks.list_tasks(status: "todo") do
        tasks when is_list(tasks) -> tasks
        _ -> []
      end

    top_task =
      tasks
      |> Enum.sort_by(fn t -> t.priority || 999 end)
      |> List.first()

    queued_count =
      case Ema.Proposals.list_proposals(status: "queued") do
        proposals when is_list(proposals) -> length(proposals)
        _ -> 0
      end

    inbox_count = Ema.BrainDump.unprocessed_count()

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

    %{
      recommendation: recommendation,
      context: %{
        open_tasks: length(tasks),
        inbox_count: inbox_count,
        queued_proposals: queued_count
      }
    }
  end
end
