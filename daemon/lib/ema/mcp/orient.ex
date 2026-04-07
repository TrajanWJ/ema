defmodule Ema.MCP.Orient do
  @moduledoc """
  Lean orientation briefings for MCP agents.

  Returns only what's needed to start working — live state, not static catalogs.
  The MCP tool list already tells agents what tools exist. The intent graph tells
  them what to work on. This module tells them where they are right now.
  """

  alias Ema.{Actors, BrainDump, Focus, Intents, Tasks}

  def briefing(:operator, actor_slug) do
    actor = resolve_actor(actor_slug || "trajan")
    focus = safe_call(fn -> Focus.current_session() end)

    %{
      mode: "operator",
      you: "EMA interface — help user navigate their system",
      actor: compact_actor(actor),
      state: live_state(),
      focus: compact_focus(focus),
      needs_attention: attention_items(),
      top_intents: top_intents(nil)
    }
  end

  def briefing(:workspace, actor_slug) do
    actor = resolve_actor(actor_slug)

    case actor do
      nil ->
        %{mode: "workspace", error: "Actor '#{actor_slug}' not found"}

      actor ->
        transitions = safe_call(fn -> Actors.list_phase_transitions(actor.id) end) || []

        %{
          mode: "workspace",
          you: "Autonomous agent — manage your phase cadence, track work through EMA",
          actor: compact_actor(actor),
          phase: actor.phase,
          phase_minutes: phase_minutes(actor),
          last_transition: List.first(transitions) |> compact_transition(),
          assigned_intents: top_intents(actor.id),
          sprint: sprint_state(actor.id)
        }
    end
  end

  # ── Compact serializers — minimum viable context ──

  defp live_state do
    inbox = safe_call(fn -> BrainDump.unprocessed_count() end) || 0
    tasks = safe_call(fn -> Tasks.count_by_status() end) || %{}
    execs = safe_call(fn -> Ema.Executions.list_executions([]) end) || []
    running = Enum.count(execs, &(&1.status in ~w(running delegated)))
    awaiting = Enum.count(execs, &(&1.status == "awaiting_approval"))

    %{inbox: inbox, tasks: tasks, executions_running: running, executions_awaiting: awaiting}
  end

  defp attention_items do
    items = []

    inbox = safe_call(fn -> BrainDump.unprocessed_count() end) || 0
    items = if inbox > 0, do: [%{t: "inbox", n: inbox} | items], else: items

    blocked = safe_call(fn -> Tasks.list_by_status("blocked") end) || []
    items = if blocked != [], do: [%{t: "blocked_tasks", n: length(blocked)} | items], else: items

    at_risk = safe_call(fn -> Ema.Responsibilities.list_at_risk() end) || []
    items = if at_risk != [], do: [%{t: "at_risk", n: length(at_risk), names: Enum.map(at_risk, & &1.title)} | items], else: items

    awaiting = safe_call(fn -> Ema.Executions.list_executions(status: "awaiting_approval") end) || []
    items = if awaiting != [], do: [%{t: "awaiting_approval", n: length(awaiting)} | items], else: items

    Enum.reverse(items)
  end

  defp top_intents(actor_id) do
    opts = [status: "active", limit: 8]
    opts = if actor_id, do: Keyword.put(opts, :actor_id, actor_id), else: opts

    (safe_call(fn -> Intents.list_intents(opts) end) || [])
    |> Enum.map(fn i -> %{id: i.id, title: i.title, level: i.level, kind: i.kind} end)
  end

  defp sprint_state(actor_id) do
    data = safe_call(fn -> Actors.list_data(actor_id, "cycle", current_cycle_id()) end) || []
    Map.new(data, fn ed -> {ed.key, ed.value} end)
  end

  defp current_cycle_id do
    {year, week} = Date.utc_today() |> Date.to_erl() |> :calendar.iso_week_number()
    "week_#{year}-W#{String.pad_leading(to_string(week), 2, "0")}"
  end

  defp compact_actor(nil), do: nil
  defp compact_actor(a), do: %{id: a.id, slug: a.slug, name: a.name, type: a.actor_type, phase: a.phase}

  defp compact_focus(nil), do: nil
  defp compact_focus(s), do: %{id: s.id, task_id: Map.get(s, :task_id), minutes: Map.get(s, :duration_minutes)}

  defp compact_transition(nil), do: nil
  defp compact_transition(t), do: %{from: t.from_phase, to: t.to_phase, reason: t.reason, at: t.transitioned_at && DateTime.to_iso8601(t.transitioned_at)}

  defp phase_minutes(%{phase_started_at: nil}), do: nil
  defp phase_minutes(%{phase_started_at: at}), do: DateTime.diff(DateTime.utc_now(), at, :second) |> div(60)

  defp resolve_actor(nil), do: nil
  defp resolve_actor(slug) when is_binary(slug), do: safe_call(fn -> Actors.get_actor_by_slug(slug) end)

  defp safe_call(fun) do
    fun.()
  rescue
    _ -> nil
  end
end
