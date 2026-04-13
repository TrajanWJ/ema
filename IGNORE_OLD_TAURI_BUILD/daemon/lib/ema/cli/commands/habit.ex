defmodule Ema.CLI.Commands.Habit do
  @moduledoc "CLI commands for habit tracking."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Cadence", :cadence},
    {"Streak", :current_streak},
    {"Active", :active}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Habits, :list_active, []) do
          {:ok, habits} -> Output.render(habits, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/habits") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "habits"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    name = parsed.args.name
    cadence = parsed.options[:cadence] || "daily"

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Habits, :create_habit, [%{name: name, cadence: cadence}]) do
          {:ok, habit} ->
            Output.success("Created habit: #{habit.name}")
            if opts[:json], do: Output.json(habit)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/habits", %{"habit" => %{"name" => name, "cadence" => cadence}}) do
          {:ok, resp} ->
            habit = Helpers.extract_record(resp, "habit")
            Output.success("Created habit: #{habit["name"]}")
            if opts[:json], do: Output.json(habit)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:toggle], parsed, transport, opts) do
    id = parsed.args.id
    date = parsed.options[:date] || Date.to_string(Date.utc_today())

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Habits, :toggle_log, [id, Date.from_iso8601!(date)]) do
          {:ok, log} ->
            status = if log.completed, do: "done", else: "undone"
            Output.success("Habit #{id} marked #{status} for #{date}")
            if opts[:json], do: Output.json(log)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/habits/#{id}/toggle", %{"date" => date}) do
          {:ok, _} -> Output.success("Toggled habit #{id} for #{date}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:today], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        date = Date.utc_today()

        case transport.call(Ema.Habits, :logs_for_date, [date]) do
          {:ok, logs} ->
            if opts[:json] do
              Output.json(logs)
            else
              Enum.each(logs, fn log ->
                icon = if log.completed, do: "✓", else: "○"
                IO.puts("  #{icon} #{log.habit_id}")
              end)
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/habits/today") do
          {:ok, body} ->
            if opts[:json] do
              Output.json(body)
            else
              logs = Helpers.extract_list(body, "logs")

              Enum.each(logs, fn log ->
                icon = if log["completed"], do: "✓", else: "○"
                name = log["habit_name"] || log["name"] || log["habit_id"]
                IO.puts("  #{icon} #{name}")
              end)
            end

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:archive], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Habits, :archive_habit, [id]) do
          {:ok, _} -> Output.success("Archived habit #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/habits/#{id}/archive") do
          {:ok, _} -> Output.success("Archived habit #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown habit subcommand: #{inspect(sub)}")
  end
end
