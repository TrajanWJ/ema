defmodule Ema.CLI.ActorCommands do
  @moduledoc "Minimal native handlers for actor-registered CLI commands."

  def em_status(actor, [], transport, _opts) do
    actor_id = actor.id

    backlog_count =
      case transport.call(Ema.Tasks, :list_tasks, [[actor_id: actor_id]]) do
        {:ok, tasks} ->
          Enum.count(tasks, &(Map.get(&1, :status) not in ["done", "archived", "cancelled"]))

        _ ->
          0
      end

    transitions =
      case transport.call(Ema.PhaseTransitions, :list_for, [actor_id]) do
        {:ok, rows} -> rows
        _ -> []
      end

    {:ok,
     %{
       actor_id: actor.id,
       slug: actor.slug,
       name: actor.name,
       actor_type: actor.actor_type,
       phase: actor.phase,
       status: actor.status,
       backlog_count: backlog_count,
       velocity: completed_weeks(transitions)
     }}
  end

  def em_status(_actor, args, _transport, _opts) do
    {:error, "status does not accept extra args: #{Enum.join(args, " ")}"}
  end

  defp completed_weeks(rows) do
    rows
    |> Enum.map(&Map.get(&1, :week_number))
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> length()
  end
end
