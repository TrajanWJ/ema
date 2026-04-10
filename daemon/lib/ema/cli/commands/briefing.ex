defmodule Ema.CLI.Commands.Briefing do
  @moduledoc "CLI command for daily briefing — tasks, proposals, habits summary."

  alias Ema.CLI.Output

  def handle([], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Http ->
        case transport.get("/briefing") do
          {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Direct ->
        briefing = generate_briefing()
        if opts[:json], do: Output.json(briefing), else: Output.detail(briefing)
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown briefing subcommand: #{inspect(sub)}")
  end

  defp generate_briefing do
    today = Date.utc_today() |> Date.to_iso8601()

    tasks =
      case Ema.Tasks.list_tasks(status: "todo") do
        tasks when is_list(tasks) -> length(tasks)
        _ -> 0
      end

    queued =
      case Ema.Proposals.list_proposals(status: "queued") do
        proposals when is_list(proposals) -> length(proposals)
        _ -> 0
      end

    habits =
      case Ema.Habits.list_active() do
        habits when is_list(habits) -> length(habits)
        _ -> 0
      end

    %{
      date: today,
      summary: %{
        open_tasks: tasks,
        queued_proposals: queued,
        active_habits: habits
      },
      upcoming: upcoming_section()
    }
  end

  defp upcoming_section do
    next =
      try do
        case Ema.Intelligence.CalendarDriver.next_action() do
          {:ok, action, reason} -> %{action: action, reason: reason}
          {:idle, msg} -> %{action: nil, reason: msg}
        end
      catch
        :exit, _ -> %{action: nil, reason: "calendar driver unavailable"}
      end

    progress =
      try do
        Ema.Intelligence.CalendarDriver.progress_summary()
      catch
        :exit, _ -> %{}
      end

    %{next_action: next, progress: progress}
  end
end
