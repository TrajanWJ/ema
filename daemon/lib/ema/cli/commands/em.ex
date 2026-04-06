defmodule Ema.CLI.Commands.Em do
  @moduledoc "CLI commands for executive-management actor views."

  alias Ema.CLI.{Helpers, Output}

  @status_columns [
    {"ID", :id},
    {"Name", :name},
    {"Type", :actor_type},
    {"Phase", :phase},
    {"Status", :status},
    {"Backlog", :backlog_count},
    {"Velocity", :velocity}
  ]

  @phase_columns [
    {"At", :transitioned_at},
    {"From", :from_phase},
    {"To", :to_phase},
    {"Week", :week_number},
    {"Reason", :reason}
  ]

  def handle([:status], parsed, transport, opts) do
    actor_ref = Map.get(parsed.args, :actor)

    case actor_ref do
      nil ->
        list_actor_statuses(parsed, transport, opts)

      _ ->
        with {:ok, actor} <- resolve_actor(actor_ref, transport) do
          status = actor_status(actor, transport)
          if opts[:json], do: Output.json(status), else: Output.detail(status)
        else
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:phases], parsed, transport, opts) do
    with {:ok, actor} <- resolve_actor(parsed.args.actor, transport) do
      case list_phases(actor.id, transport) do
        {:ok, rows} -> Output.render(rows, @phase_columns, json: opts[:json])
        {:error, reason} -> Output.error(inspect(reason))
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:velocity], parsed, transport, opts) do
    with {:ok, actor} <- resolve_actor(parsed.args.actor, transport),
         {:ok, rows} <- list_phases(actor.id, transport) do
      summary = velocity_summary(actor, rows)
      if opts[:json], do: Output.json(summary), else: Output.detail(summary)
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:advance], parsed, transport, opts) do
    with {:ok, actor} <- resolve_actor(parsed.args.actor, transport) do
      actor_id = Map.get(actor, :id) || actor["id"]
      phase = Map.get(parsed.args, :phase) || next_phase(actor)
      reason = Map.get(parsed.options, :reason, "manual")
      week = Map.get(parsed.options, :week)

      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.Actors, :transition_phase, [actor, phase, [reason: reason, week_number: week]]) do
            {:ok, updated} ->
              Output.success("#{actor_name(actor)} → #{phase}")
              if opts[:json], do: Output.json(%{phase: Map.get(updated, :phase)})
            {:error, reason} ->
              Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          body = %{"to_phase" => phase, "reason" => reason}
          body = if week, do: Map.put(body, "week_number", week), else: body

          case transport.post("/actors/#{actor_id}/transition", body) do
            {:ok, body} ->
              Output.success("Advanced to #{phase}")
              if opts[:json], do: Output.json(body)
            {:error, reason} ->
              Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:retro], parsed, transport, opts) do
    with {:ok, actor} <- resolve_actor(parsed.args.actor, transport),
         {:ok, transitions} <- list_phases(Map.get(actor, :id) || actor["id"], transport) do
      week = Map.get(parsed.options, :week)

      filtered =
        if week do
          Enum.filter(transitions, fn t ->
            wn = Map.get(t, :week_number) || Map.get(t, "week_number")
            wn != nil and to_string(wn) == to_string(week)
          end)
        else
          transitions
        end

      retro_columns = @phase_columns ++ [{"Summary", :summary}]

      if filtered == [] do
        Output.error("No transitions#{if week, do: " for week #{week}", else: ""}")
      else
        Output.render(filtered, retro_columns, json: opts[:json])
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown em subcommand: #{inspect(sub)}")
  end

  defp list_actor_statuses(parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter =
          Helpers.compact_keyword(
            space_id: parsed.options[:space],
            type: parsed.options[:type]
          )

        case transport.call(Ema.Actors, :list_actors, [filter]) do
          {:ok, actors} ->
            rows = Enum.map(actors, &actor_status(&1, transport))
            Output.render(rows, @status_columns, json: opts[:json])

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        params =
          Helpers.compact_keyword(
            space_id: parsed.options[:space],
            type: parsed.options[:type]
          )

        case transport.get("/actors", params: params) do
          {:ok, body} ->
            rows =
              body
              |> Helpers.extract_list("actors")
              |> Enum.map(&actor_status(&1, transport))

            Output.render(rows, @status_columns, json: opts[:json])

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  defp resolve_actor(ref, transport) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Actors, :get_actor, [ref]) do
          {:ok, nil} ->
            case transport.call(Ema.Actors, :get_actor_by_slug, [ref]) do
              {:ok, nil} -> {:error, "Actor #{ref} not found"}
              {:ok, actor} -> {:ok, actor}
              {:error, reason} -> {:error, inspect(reason)}
            end

          {:ok, actor} -> {:ok, actor}
          {:error, reason} -> {:error, inspect(reason)}
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/actors/#{ref}") do
          {:ok, body} -> {:ok, Helpers.extract_record(body, "actor")}
          {:error, :not_found} -> {:error, "Actor #{ref} not found"}
          {:error, reason} -> {:error, inspect(reason)}
        end
    end
  end

  defp actor_status(actor, transport) do
    actor_id = Map.get(actor, :id) || actor["id"]

    backlog_count =
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.Tasks, :list_tasks, [[actor_id: actor_id]]) do
            {:ok, tasks} -> Enum.count(tasks, &(Map.get(&1, :status) not in ["done", "archived", "cancelled"]))
            _ -> 0
          end

        Ema.CLI.Transport.Http ->
          case transport.get("/tasks", params: [actor_id: actor_id]) do
            {:ok, body} ->
              body
              |> Helpers.extract_list("tasks")
              |> Enum.count(&(Map.get(&1, "status") not in ["done", "archived", "cancelled"]))

            _ ->
              0
          end
      end

    transitions =
      case list_phases(actor_id, transport) do
        {:ok, rows} -> rows
        _ -> []
      end

    %{
      id: actor_id,
      name: Map.get(actor, :name) || actor["name"],
      actor_type: Map.get(actor, :actor_type) || actor["actor_type"] || Map.get(actor, :type) || actor["type"],
      phase: Map.get(actor, :phase) || actor["phase"],
      status: Map.get(actor, :status) || actor["status"],
      backlog_count: backlog_count,
      velocity: completed_weeks(transitions)
    }
  end

  defp list_phases(actor_id, transport) do
    case transport do
      Ema.CLI.Transport.Direct ->
        transport.call(Ema.Actors, :list_phase_transitions, [actor_id])

      Ema.CLI.Transport.Http ->
        case transport.get("/actors/#{actor_id}/phases") do
          {:ok, body} -> {:ok, Helpers.extract_list(body, "phase_transitions")}
          error -> error
        end
    end
  end

  defp velocity_summary(actor, rows) do
    %{
      actor_id: Map.get(actor, :id) || actor["id"],
      weeks_completed: completed_weeks(rows),
      average_transitions_per_week: average_transitions(rows),
      transitions: length(rows)
    }
  end

  defp completed_weeks(rows) do
    rows
    |> Enum.map(&(Map.get(&1, :week_number) || Map.get(&1, "week_number")))
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> length()
  end

  defp average_transitions(rows) do
    weeks = completed_weeks(rows)
    if weeks == 0, do: length(rows), else: Float.round(length(rows) / weeks, 2)
  end

  @phase_order ~w(idle plan execute review retro)

  defp next_phase(actor) do
    current = Map.get(actor, :phase) || Map.get(actor, "phase") || "idle"
    idx = Enum.find_index(@phase_order, &(&1 == current)) || 0
    Enum.at(@phase_order, rem(idx + 1, length(@phase_order)))
  end

  defp actor_name(actor) do
    Map.get(actor, :name) || Map.get(actor, "name") || Map.get(actor, :id) || actor["id"]
  end
end
