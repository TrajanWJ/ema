defmodule Ema.MCP.Orient do
  @moduledoc """
  Assembles orientation briefings for MCP agents.

  Two modes:
  - **operator** — agent is helping the user navigate EMA
  - **workspace** — agent is managing its own autonomous work
  """

  alias Ema.{Actors, BrainDump, Focus, Intents, Responsibilities, Tasks}

  @operator_directive """
  You are the user's EMA interface — an intelligent layer between them and their personal operating system. \
  Guide them through projects, tasks, goals, vault, habits, journal, focus, proposals, and brain dumps. \
  Use EMA tools for ALL work management. Never suggest the user manage work outside EMA. \
  When the user asks about their work, query EMA first. When they want to create or change something, \
  use the appropriate ema_ tool. You ARE EMA's voice.
  """

  @workspace_directive """
  You are an autonomous agent operating within EMA. Manage your own phase cadence \
  (plan → execute → review → retro). Use ema_sprint_cycle to frame planning periods. \
  Use ema_workspace_data to persist your sprint backlog and metrics across conversations. \
  Use ema_phase_transition to advance through phases as work completes. \
  ALL work must flow through EMA — create intents, track executions, log outcomes. \
  Your identity is your actor record. Your memory is entity_data. Your schedule is phase cadence.
  """

  def briefing(:operator, actor_slug) do
    actor = resolve_actor(actor_slug || "trajan")
    dashboard = build_dashboard()
    attention = build_attention_items()
    focus = safe_call(fn -> Focus.current_session() end)

    %{
      mode: "operator",
      system_directive: String.trim(@operator_directive),
      actor: serialize_actor(actor),
      dashboard: dashboard,
      attention_items: attention,
      active_focus: serialize_focus(focus),
      capabilities: capabilities()
    }
  end

  def briefing(:workspace, actor_slug) do
    actor = resolve_actor(actor_slug || "claude-dev")

    case actor do
      nil ->
        %{
          mode: "workspace",
          error: "Actor '#{actor_slug}' not found. Create it first or use operator mode.",
          capabilities: capabilities()
        }

      actor ->
        transitions = safe_call(fn -> Actors.list_phase_transitions(actor.id) end) || []
        recent = Enum.take(transitions, 5)
        backlog = safe_call(fn -> Actors.list_data(actor.id, "sprint", "current") end) || []
        assigned = safe_call(fn -> Intents.list_intents(actor_id: actor.id, status: "active") end) || []
        lessons = safe_call(fn -> Ema.Intelligence.ReflexionStore.list_recent(agent: actor.slug, limit: 5) end) || []

        %{
          mode: "workspace",
          system_directive: String.trim(@workspace_directive),
          actor: serialize_actor(actor),
          current_phase: actor.phase,
          phase_duration_minutes: phase_duration_minutes(actor),
          sprint_backlog: Enum.map(backlog, &serialize_entity_data/1),
          assigned_intents: Enum.map(assigned, &serialize_intent/1),
          recent_transitions: Enum.map(recent, &serialize_transition/1),
          reflexion_lessons: Enum.map(lessons, &serialize_reflexion/1),
          capabilities: capabilities()
        }
    end
  end

  # ── Private ──

  defp resolve_actor(slug) when is_binary(slug) do
    safe_call(fn -> Actors.get_actor_by_slug(slug) end)
  end

  defp resolve_actor(_), do: nil

  defp build_dashboard do
    inbox_count = safe_call(fn -> BrainDump.unprocessed_count() end) || 0
    task_counts = safe_call(fn -> Tasks.count_by_status() end) || %{}

    execution_counts =
      safe_call(fn ->
        execs = Ema.Executions.list_executions([])
        %{
          active: Enum.count(execs, &(&1.status in ~w(running delegated))),
          needs_approval: Enum.count(execs, &(&1.status == "awaiting_approval")),
          total: length(execs)
        }
      end) || %{active: 0, needs_approval: 0, total: 0}

    %{
      inbox_count: inbox_count,
      task_counts: task_counts,
      executions: execution_counts
    }
  end

  defp build_attention_items do
    items = []

    # Unprocessed brain dumps
    inbox_count = safe_call(fn -> BrainDump.unprocessed_count() end) || 0

    items =
      if inbox_count > 0,
        do: items ++ [%{type: "inbox", message: "#{inbox_count} unprocessed brain dump(s)", priority: "medium"}],
        else: items

    # At-risk responsibilities
    at_risk = safe_call(fn -> Responsibilities.list_at_risk() end) || []

    items =
      if at_risk != [],
        do:
          items ++
            Enum.map(at_risk, fn r ->
              %{type: "responsibility", message: "At risk: #{r.title}", priority: "high", id: r.id}
            end),
        else: items

    # Blocked tasks
    blocked = safe_call(fn -> Tasks.list_by_status("blocked") end) || []

    items =
      if blocked != [],
        do:
          items ++
            Enum.map(Enum.take(blocked, 5), fn t ->
              %{type: "task_blocked", message: "Blocked: #{t.title}", priority: "high", id: t.id}
            end),
        else: items

    # Executions needing approval
    awaiting = safe_call(fn -> Ema.Executions.list_executions(status: "awaiting_approval") end) || []

    items =
      if awaiting != [],
        do:
          items ++
            Enum.map(awaiting, fn e ->
              %{type: "execution_approval", message: "Awaiting approval: #{e.title}", priority: "high", id: e.id}
            end),
        else: items

    items
  end

  defp phase_duration_minutes(%{phase_started_at: nil}), do: nil

  defp phase_duration_minutes(%{phase_started_at: started_at}) do
    DateTime.diff(DateTime.utc_now(), started_at, :second) |> div(60)
  end

  defp serialize_actor(nil), do: nil

  defp serialize_actor(actor) do
    %{
      id: actor.id,
      slug: actor.slug,
      name: actor.name,
      actor_type: actor.actor_type,
      phase: actor.phase,
      phase_started_at: actor.phase_started_at && DateTime.to_iso8601(actor.phase_started_at),
      status: actor.status
    }
  end

  defp serialize_focus(nil), do: nil

  defp serialize_focus(session) do
    %{
      id: session.id,
      task_id: Map.get(session, :task_id),
      started_at: Map.get(session, :started_at) && DateTime.to_iso8601(session.started_at),
      duration_minutes: Map.get(session, :duration_minutes)
    }
  end

  defp serialize_entity_data(ed) do
    %{key: ed.key, value: ed.value, entity_type: ed.entity_type, entity_id: ed.entity_id}
  end

  defp serialize_intent(intent) do
    %{
      id: intent.id,
      title: intent.title,
      level: intent.level,
      status: intent.status,
      kind: intent.kind,
      project_id: intent.project_id
    }
  end

  defp serialize_transition(t) do
    %{
      from_phase: t.from_phase,
      to_phase: t.to_phase,
      reason: t.reason,
      summary: t.summary,
      week_number: t.week_number,
      transitioned_at: t.transitioned_at && DateTime.to_iso8601(t.transitioned_at)
    }
  end

  defp serialize_reflexion(r) do
    %{
      domain: Map.get(r, :domain),
      lesson: Map.get(r, :lesson),
      outcome: Map.get(r, :outcome),
      agent: Map.get(r, :agent)
    }
  end

  defp safe_call(fun) do
    fun.()
  rescue
    _ -> nil
  end

  defp capabilities do
    [
      %{
        category: "orientation",
        tools: ["ema_orient"],
        description: "Orient yourself — get briefing, mode, capabilities"
      },
      %{
        category: "phase_cadence",
        tools: ["ema_phase_transition", "ema_phase_status", "ema_sprint_cycle"],
        description: "Manage agent phase lifecycle (plan→execute→review→retro) and sprint cycles"
      },
      %{
        category: "workspace",
        tools: ["ema_workspace_data", "ema_workspace_tags", "ema_workspace_config"],
        description: "Actor-scoped persistent state — scratchpad, tags, container config"
      },
      %{
        category: "intelligence",
        tools: ["ema_intelligence_gaps", "ema_intelligence_reflexion", "ema_intelligence_memory"],
        description: "Query operational gaps, lessons from past executions, session memory"
      },
      %{
        category: "codebase",
        tools: ["ema_codebase_ask", "ema_codebase_index"],
        description: "Ask about codebase using local knowledge graph + vault search"
      },
      %{
        category: "tasks",
        tools: ["ema_create_task", "ema_show_task", "ema_transition_task", "ema_delete_task"],
        description: "Create, view, transition, and delete tasks"
      },
      %{
        category: "projects",
        tools: ["ema_get_projects", "ema_create_project", "ema_show_project"],
        description: "List, create, and view projects"
      },
      %{
        category: "intents",
        tools: ["ema_get_intents", "ema_create_intent", "ema_get_intent_tree", "ema_get_intent_context"],
        description: "Semantic intent hierarchy — the truth layer of what you're trying to accomplish"
      },
      %{
        category: "proposals",
        tools: ["ema_get_proposals", "ema_approve_proposal", "ema_kill_proposal", "ema_redirect_proposal"],
        description: "AI-generated ideas queued for review — approve, kill, or redirect"
      },
      %{
        category: "brain_dump",
        tools: ["ema_brain_dump", "ema_list_brain_dumps", "ema_process_brain_dump"],
        description: "Quick capture inbox — dump thoughts, then process to tasks/journal/archive"
      },
      %{
        category: "vault",
        tools: ["ema_vault_tree", "ema_vault_read", "ema_vault_write", "ema_vault_graph", "query_vault"],
        description: "Knowledge vault — read, write, search, and traverse the wiki/note graph"
      },
      %{
        category: "goals",
        tools: ["ema_create_goal", "ema_show_goal", "ema_update_goal", "ema_delete_goal"],
        description: "Hierarchical goal tracking with timeframes"
      },
      %{
        category: "executions",
        tools: ["ema_show_execution", "ema_approve_execution", "ema_cancel_execution", "ema_execution_events"],
        description: "Execution lifecycle — approve, cancel, view events"
      },
      %{
        category: "sessions",
        tools: ["ema_list_sessions", "ema_spawn_session", "ema_check_session", "ema_kill_session"],
        description: "Claude Code session orchestration — spawn, monitor, resume, kill"
      },
      %{
        category: "habits",
        tools: ["ema_get_habits", "ema_create_habit", "ema_toggle_habit", "ema_habits_today"],
        description: "Daily habit tracking with streaks"
      },
      %{
        category: "journal",
        tools: ["ema_journal_read", "ema_journal_write", "ema_journal_search"],
        description: "Daily journal with mood, energy, one thing"
      },
      %{
        category: "focus",
        tools: ["ema_focus_start", "ema_focus_stop", "ema_focus_pause", "ema_focus_resume", "ema_focus_today"],
        description: "Focus timer sessions"
      },
      %{
        category: "responsibilities",
        tools: ["ema_get_responsibilities", "ema_check_in_responsibility", "ema_at_risk_responsibilities"],
        description: "Recurring obligations with health scores"
      },
      %{
        category: "pipes",
        tools: ["ema_get_pipes", "ema_create_pipe", "ema_toggle_pipe", "ema_pipe_catalog"],
        description: "Automation pipes — trigger→transform→action workflows"
      },
      %{
        category: "seeds",
        tools: ["ema_get_seeds", "ema_create_seed", "ema_run_seed"],
        description: "Proposal seeds — scheduled prompts that generate proposals"
      },
      %{
        category: "system",
        tools: ["ema_health", "ema_dashboard_today", "ema_babysitter_state", "ema_engine_status"],
        description: "System health, dashboard, observability, proposal engine status"
      }
    ]
  end
end
