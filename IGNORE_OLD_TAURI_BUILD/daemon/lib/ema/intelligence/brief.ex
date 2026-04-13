defmodule Ema.Intelligence.Brief do
  @moduledoc """
  EMA Brief Mode — proactive presentation of state, decisions, recommendations.

  The Brief is the "agent comes at you with a brief" pattern: when EMA opens
  (or when the user runs `ema brief`), the system presents a structured snapshot
  answering six questions:

    1. State now             — current focus, active executions, energy
    2. Needs your decision   — proposals queued, blocked tasks, escalated loops
    3. Autonomous work       — running execs, schedules, learning rules
    4. Recommended actions   — top N next actions ranked by impact
    5. Upcoming              — scheduled / cadence items
    6. Recent wins           — last 24h summary

  All data fetches are defensive: if a context module is unavailable the
  section degrades to an empty list rather than crashing the brief.
  """

  alias Ema.{Tasks, Proposals, Executions, Loops, Goals, Intents, Journal}
  alias Ema.Intelligence.CostGovernor

  @default_recommend_limit 3

  @doc """
  Generate a brief snapshot.

  Options:
    * `:actor_id`         — actor scope (default: "human")
    * `:recommend_limit`  — number of recommendations to surface (default: 3)
  """
  def generate(opts \\ []) do
    actor_id = Keyword.get(opts, :actor_id, "human")
    rec_limit = Keyword.get(opts, :recommend_limit, @default_recommend_limit)

    %{
      generated_at: DateTime.utc_now(),
      greeting: greeting_for_time(),
      state: gather_state(actor_id),
      decisions_needed: gather_decisions(),
      autonomous_work: gather_autonomous(),
      recommendations: gather_recommendations(actor_id, rec_limit),
      upcoming: gather_upcoming(),
      recent_wins: gather_recent_wins(),
      cost_status: safe(fn -> CostGovernor.current_tier() end, :unknown),
      energy_check: latest_journal_mood()
    }
  end

  # ── Section: State ─────────────────────────────────────────────

  defp gather_state(_actor_id) do
    focus =
      safe_list(fn -> Intents.list_intents(status: "implementing", limit: 3) end)
      |> Enum.map(&enrich_focus_with_cascade/1)

    %{
      current_focus: focus,
      active_executions: safe_list(fn -> Executions.list_executions(status: "running") end),
      energy: latest_journal_mood()
    }
  end

  # For each focus intent, walk up to its serving goals/vision and down to its
  # spawned tasks. The Brief printer can use either the flat title or — if
  # cascade context is needed — the :goals and :spawned fields.
  defp enrich_focus_with_cascade(intent) do
    ancestors =
      safe_list(fn -> Intents.ancestors(intent.id) end)
      |> Enum.map(&Intents.serialize/1)

    descendants =
      safe_list(fn -> Intents.descendants(intent.id, 3) end)
      |> Enum.map(&Intents.serialize/1)

    intent
    |> Intents.serialize()
    |> Map.put(:goals, ancestors)
    |> Map.put(:spawned, descendants)
  end

  # ── Section: Decisions Needed ──────────────────────────────────

  defp gather_decisions do
    queued =
      safe_list(fn -> Proposals.list_proposals(status: "queued") end)
      |> Enum.take(5)

    escalated = safe_list(fn -> Loops.list_at_risk() end)

    blocked =
      safe_list(fn -> Tasks.list_by_status("blocked") end)

    stuck =
      safe_list(fn -> Executions.list_executions(status: "running") end)
      |> filter_stuck()

    %{
      queued_proposals: queued,
      escalated_loops: escalated,
      blocked_tasks: blocked,
      stuck_executions: stuck,
      total: length(queued) + length(escalated) + length(blocked) + length(stuck)
    }
  end

  defp filter_stuck(executions) do
    threshold = DateTime.add(DateTime.utc_now(), -2 * 3600, :second)

    Enum.filter(executions, fn exec ->
      case Map.get(exec, :inserted_at) || Map.get(exec, :started_at) do
        %DateTime{} = dt -> DateTime.compare(dt, threshold) == :lt
        %NaiveDateTime{} = ndt ->
          case DateTime.from_naive(ndt, "Etc/UTC") do
            {:ok, dt} -> DateTime.compare(dt, threshold) == :lt
            _ -> false
          end
        _ -> false
      end
    end)
  end

  # ── Section: Autonomous Work ───────────────────────────────────

  defp gather_autonomous do
    running = safe_list(fn -> Executions.list_executions(status: "running") end)
    pending = safe_list(fn -> Executions.list_executions(status: "pending") end)

    engine_status =
      safe(fn -> Ema.ProposalEngine.Scheduler.status() end, %{paused: false})

    %{
      running_executions: running,
      pending_executions: pending,
      engine_paused: Map.get(engine_status, :paused, false),
      active_agents: safe_list(fn -> Ema.Agents.list_active_agents() end) |> length()
    }
  end

  # ── Section: Recommendations ───────────────────────────────────

  defp gather_recommendations(actor_id, limit) do
    # Honest fallback: build heuristic recommendations from real signals.
    # If/when an Advisor module ships, swap this for `Advisor.recommend/1`.
    decisions = gather_decisions()
    todo_tasks = safe_list(fn -> Tasks.list_tasks(status: "todo", actor_id: actor_id) end)

    inbox = safe(fn -> Ema.BrainDump.unprocessed_count() end, 0)

    candidates =
      [
        if(length(decisions.stuck_executions) > 0,
          do: %{
            rank: nil,
            label: "Rescue #{length(decisions.stuck_executions)} stuck execution(s)",
            kind: "rescue",
            impact: "unblocks autonomous work",
            estimate: "5–10m"
          }
        ),
        if(length(decisions.queued_proposals) > 0,
          do: %{
            rank: nil,
            label: "Triage #{length(decisions.queued_proposals)} queued proposal(s)",
            kind: "triage",
            impact: "frees backlog, surfaces opportunities",
            estimate: "~#{length(decisions.queued_proposals) * 3}m"
          }
        ),
        if(length(decisions.escalated_loops) > 0,
          do: %{
            rank: nil,
            label: "Close #{length(decisions.escalated_loops)} escalated loop(s)",
            kind: "loop",
            impact: "preserves trust, prevents drift",
            estimate: "varies"
          }
        ),
        if(inbox > 5,
          do: %{
            rank: nil,
            label: "Process #{inbox} brain-dump items",
            kind: "inbox",
            impact: "clears capture queue",
            estimate: "~#{inbox * 1}m"
          }
        ),
        top_task_recommendation(todo_tasks)
      ]
      |> Enum.reject(&is_nil/1)
      |> Enum.take(limit)
      |> Enum.with_index(1)
      |> Enum.map(fn {rec, i} -> Map.put(rec, :rank, i) end)

    candidates
  end

  defp top_task_recommendation([]), do: nil

  defp top_task_recommendation(tasks) do
    top = tasks |> Enum.sort_by(&(&1.priority || 999)) |> List.first()

    if top do
      %{
        rank: nil,
        label: "Work on: #{top.title}",
        kind: "task",
        impact: "P#{top.priority || "-"}",
        estimate: "—"
      }
    end
  end

  # ── Section: Upcoming ──────────────────────────────────────────

  defp gather_upcoming do
    today = Date.utc_today()
    week_end = Date.add(today, 7)

    todo_tasks = safe_list(fn -> Tasks.list_tasks(status: "todo") end)

    due_today = filter_due_by(todo_tasks, today, :on)
    due_this_week = filter_due_by(todo_tasks, week_end, :before)

    %{
      today: due_today,
      this_week: due_this_week,
      goals_active: safe_list(fn -> Goals.list_goals(status: "active") end) |> length()
    }
  end

  defp filter_due_by(tasks, date, mode) do
    Enum.filter(tasks, fn t ->
      case Map.get(t, :due_date) do
        %Date{} = d ->
          case mode do
            :on -> Date.compare(d, date) == :eq
            :before -> Date.compare(d, date) != :gt
          end

        _ ->
          false
      end
    end)
  end

  # ── Section: Recent Wins ───────────────────────────────────────

  defp gather_recent_wins do
    cutoff = DateTime.add(DateTime.utc_now(), -86_400, :second)

    completed_tasks =
      safe_list(fn -> Tasks.list_by_status("done") end)
      |> Enum.filter(&recent?(&1, cutoff))
      |> Enum.take(10)

    completed_execs =
      safe_list(fn -> Executions.list_executions(status: "completed") end)
      |> Enum.filter(&recent?(&1, cutoff))
      |> Enum.take(10)

    %{
      tasks_completed: completed_tasks,
      executions_completed: completed_execs,
      count: length(completed_tasks) + length(completed_execs)
    }
  end

  defp recent?(record, cutoff) do
    case Map.get(record, :updated_at) || Map.get(record, :inserted_at) do
      %DateTime{} = dt ->
        DateTime.compare(dt, cutoff) == :gt

      %NaiveDateTime{} = ndt ->
        case DateTime.from_naive(ndt, "Etc/UTC") do
          {:ok, dt} -> DateTime.compare(dt, cutoff) == :gt
          _ -> false
        end

      _ ->
        false
    end
  end

  # ── Helpers ────────────────────────────────────────────────────

  defp greeting_for_time do
    hour = DateTime.utc_now().hour

    cond do
      hour < 5 -> "Late night"
      hour < 12 -> "Good morning"
      hour < 17 -> "Good afternoon"
      hour < 21 -> "Good evening"
      true -> "Late evening"
    end
  end

  defp latest_journal_mood do
    case safe_list(fn -> Journal.list_entries(1) end) do
      [%{mood: mood, date: date} | _] when not is_nil(mood) ->
        %{mood: mood, date: date}

      _ ->
        nil
    end
  end

  defp safe(fun, default) do
    try do
      fun.()
    rescue
      _ -> default
    catch
      :exit, _ -> default
      _, _ -> default
    end
  end

  defp safe_list(fun) do
    case safe(fun, []) do
      list when is_list(list) -> list
      _ -> []
    end
  end
end
