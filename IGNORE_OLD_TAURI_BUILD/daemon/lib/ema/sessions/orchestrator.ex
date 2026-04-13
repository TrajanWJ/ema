defmodule Ema.Sessions.Orchestrator do
  @moduledoc """
  Session orchestration — spawn, monitor, follow-up, and manipulate
  Claude Code sessions with EMA context injection.

  Wraps CliManager (spawning), ClaudeSessions (tracking), and
  SessionMonitor (live detection) into a single operator surface.
  """

  require Logger

  alias Ema.{CliManager, ClaudeSessions, Projects, Tasks, Goals}

  @default_model "sonnet"

  # -- List & Inspect --

  @doc "List all sessions: orchestrator-spawned + detected Claude sessions"
  def list_all(opts \\ []) do
    limit = Keyword.get(opts, :limit, 30)

    orchestrator_sessions =
      orchestrator_table()
      |> :ets.tab2list()
      |> Enum.map(fn {id, state} ->
        %{
          id: id,
          type: :orchestrator,
          status: state.status,
          project_path: state.project_path,
          project_slug: state.project_slug,
          prompt: state.prompt,
          model: state.model,
          started_at: state.started_at,
          exit_code: state.exit_code,
          live:
            state.status == "running" and is_pid(state.task_pid) and
              Process.alive?(state.task_pid)
        }
      end)

    detected =
      case ClaudeSessions.list_sessions(limit: limit) do
        {:ok, sessions} -> Enum.map(sessions, &normalize_detected_session/1)
        _ -> []
      end

    all =
      (orchestrator_sessions ++ detected)
      |> Enum.uniq_by(& &1.id)

    {:ok, Enum.take(all, limit)}
  end

  @doc "List only currently active/running sessions"
  def list_active do
    running =
      orchestrator_table()
      |> :ets.tab2list()
      |> Enum.filter(fn {_id, state} ->
        state.status == "running" and is_pid(state.task_pid) and Process.alive?(state.task_pid)
      end)
      |> Enum.map(fn {id, state} ->
        %{
          id: id,
          type: :orchestrator,
          status: "running",
          project_path: state.project_path,
          project_slug: state.project_slug,
          prompt: state.prompt,
          model: state.model,
          started_at: state.started_at,
          live: true
        }
      end)

    {:ok, running}
  end

  @doc "Get detailed session info with EMA context overlay"
  def get_session_detail(session_id) do
    with {:ok, session} <- find_session(session_id) do
      context = build_session_context(session)
      {:ok, Map.put(session, :ema_context, context)}
    end
  end

  # -- Spawn --

  @doc """
  Spawn a new Claude Code session with EMA context injected.

  Options:
    - project_slug: EMA project to associate
    - task_id: task to link
    - model: Claude model (default: sonnet)
    - resume_session_id: resume an existing Claude session
    - inject_context: true/false (default: true)
    - args: additional CLI args
  """
  def spawn(prompt, opts \\ []) do
    project_slug = Keyword.get(opts, :project_slug)
    task_id = Keyword.get(opts, :task_id)
    model = Keyword.get(opts, :model, @default_model)
    inject_context? = Keyword.get(opts, :inject_context, true)
    _resume_id = Keyword.get(opts, :resume_session_id)

    # Resolve project path
    {project_path, project} = resolve_project(project_slug)

    # Build enriched prompt with EMA context
    full_prompt =
      if inject_context? do
        enrich_prompt(prompt, project, task_id)
      else
        prompt
      end

    claude_path = resolve_claude_binary()

    if claude_path == nil do
      {:error, "claude binary not found in PATH or ~/.local/bin/claude"}
    else
      session_id =
        "orch_#{System.system_time(:millisecond)}_#{:rand.uniform(0xFFFF) |> Integer.to_string(16)}"

      # Spawn Claude Code as a background port process
      task =
        Task.Supervisor.async_nolink(Ema.TaskSupervisor, fn ->
          run_claude_session(claude_path, project_path, full_prompt, model, session_id)
        end)

      Logger.info("[Orchestrator] Spawned session #{session_id} in #{project_path}")

      Phoenix.PubSub.broadcast(
        Ema.PubSub,
        "sessions:orchestrator",
        {:session_spawned, %{id: session_id, project_path: project_path, prompt: prompt}}
      )

      # Track in ETS for check_session lookups
      :ets.insert(
        orchestrator_table(),
        {session_id,
         %{
           task_ref: task.ref,
           task_pid: task.pid,
           project_path: project_path,
           project_slug: project_slug,
           prompt: String.slice(prompt, 0, 500),
           model: model,
           status: "running",
           started_at: DateTime.utc_now(),
           linked_task_id: task_id,
           output: nil,
           exit_code: nil
         }}
      )

      {:ok,
       %{
         session_id: session_id,
         project_path: project_path,
         project_slug: project_slug,
         model: model,
         prompt: String.slice(prompt, 0, 200),
         status: "running",
         linked_task_id: task_id
       }}
    end
  end

  @doc "Resume an existing session by spawning a follow-up in the same project"
  def resume(session_id, prompt, opts \\ []) do
    case :ets.lookup(orchestrator_table(), session_id) do
      [{^session_id, state}] ->
        spawn(prompt,
          project_slug: state.project_slug,
          task_id: Keyword.get(opts, :task_id) || state.linked_task_id,
          inject_context: true
        )

      [] ->
        {:error, "Session #{session_id} not found"}
    end
  end

  @doc "Kill a running CLI session"
  def kill(session_id) do
    case :ets.lookup(orchestrator_table(), session_id) do
      [{^session_id, %{task_pid: pid} = state}] when is_pid(pid) ->
        if Process.alive?(pid) do
          Process.exit(pid, :kill)
          update_session_state(session_id, %{status: "killed"})
          {:ok, %{session_id: session_id, status: "killed"}}
        else
          {:error, "Session #{session_id} is not running (status: #{state.status})"}
        end

      _ ->
        {:error, "Session #{session_id} not found"}
    end
  end

  # -- Context --

  @doc "Build EMA context bundle for a session (project, tasks, goals, recent proposals)"
  def build_context(opts \\ []) do
    project_slug = Keyword.get(opts, :project_slug)
    {_path, project} = resolve_project(project_slug)

    context = %{
      project: summarize_project(project),
      tasks: list_project_tasks(project),
      goals: list_active_goals(project),
      active_sessions: count_active_sessions(),
      generated_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }

    {:ok, context}
  end

  @doc "Generate a CLAUDE.md-style context injection string"
  def context_prompt(opts \\ []) do
    {:ok, context} = build_context(opts)

    sections =
      [
        "# EMA Context (auto-injected)",
        "",
        if(context.project,
          do: "## Project: #{context.project.name}\n#{context.project.description || ""}",
          else: nil
        ),
        if(context.tasks != [],
          do: "## Active Tasks\n#{format_task_list(context.tasks)}",
          else: nil
        ),
        if(context.goals != [], do: "## Goals\n#{format_goal_list(context.goals)}", else: nil),
        "",
        "---",
        "EMA daemon: localhost:4488 | #{context.active_sessions} active sessions"
      ]
      |> Enum.reject(&is_nil/1)
      |> Enum.join("\n")

    {:ok, sections}
  end

  # -- Follow-up --

  @doc "Check session output and decide if follow-up is needed"
  def check_session(session_id) do
    # Check ETS first (orchestrator-spawned sessions)
    case :ets.lookup(orchestrator_table(), session_id) do
      [{^session_id, state}] ->
        running? = state.status == "running" and Process.alive?(state.task_pid)

        %{
          id: session_id,
          status: if(running?, do: "running", else: state.status),
          running: running?,
          exit_code: state.exit_code,
          output_summary: state.output,
          project_path: state.project_path,
          prompt: state.prompt
        }

      [] ->
        {:error, "Session #{session_id} not found"}
    end
  end

  # -- Private: Project resolution --

  defp resolve_project(nil), do: {File.cwd!(), nil}

  defp resolve_project(slug) do
    case Projects.get_project_by_slug(slug) do
      nil -> {File.cwd!(), nil}
      project -> {project.linked_path || project.path || File.cwd!(), project}
    end
  end

  # -- Private: Context building --

  defp build_session_context(session) do
    project =
      if session.project_path do
        case Projects.list_projects() do
          {:ok, projects} ->
            Enum.find(projects, fn p ->
              (p.linked_path || p.path) == session.project_path
            end)

          _ ->
            nil
        end
      end

    %{
      project: summarize_project(project),
      tasks: list_project_tasks(project),
      goals: list_active_goals(project)
    }
  end

  defp summarize_project(nil), do: nil

  defp summarize_project(project) do
    %{
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: Map.get(project, :description),
      path: project.linked_path || Map.get(project, :path)
    }
  end

  defp list_project_tasks(nil), do: []

  defp list_project_tasks(project) do
    case Tasks.list_by_project(project.id) do
      {:ok, tasks} ->
        tasks
        |> Enum.filter(fn t -> t.status in [nil, "todo", "in_progress", "active"] end)
        |> Enum.take(10)
        |> Enum.map(fn t ->
          %{id: t.id, title: t.title, status: t.status, priority: t.priority}
        end)

      _ ->
        []
    end
  end

  defp list_active_goals(nil), do: []

  defp list_active_goals(project) do
    case Goals.list_goals(project_id: project.id, status: "active") do
      {:ok, goals} ->
        Enum.map(goals, fn g -> %{id: g.id, title: g.title, timeframe: g.timeframe} end)

      _ ->
        []
    end
  end

  defp count_active_sessions do
    case CliManager.active_sessions() do
      {:ok, sessions} -> length(sessions)
      _ -> 0
    end
  end

  # -- Private: Prompt enrichment --

  defp enrich_prompt(prompt, project, task_id) do
    parts = [prompt]

    parts =
      if project do
        parts ++ ["\n\n[EMA Project: #{project.name} (#{project.slug})]"]
      else
        parts
      end

    parts =
      if task_id do
        case Tasks.get_task(task_id) do
          {:ok, task} when not is_nil(task) ->
            parts ++ ["\n[EMA Task ##{task.id}: #{task.title}]"]

          _ ->
            parts
        end
      else
        parts
      end

    Enum.join(parts)
  end

  # -- Private: Session normalization --

  defp normalize_cli_session(session) do
    %{
      id: session.id,
      type: :cli_managed,
      status: session.status,
      project_path: session.project_path,
      prompt: session.prompt,
      tool: session.cli_tool_id,
      linked_task_id: session.linked_task_id,
      exit_code: session.exit_code,
      output_summary: session.output_summary,
      updated_at: session.updated_at || session.inserted_at,
      live: CliManager.SessionRunner.running?(session.id)
    }
  end

  defp normalize_detected_session(session) do
    %{
      id: session.session_id || session.id,
      type: :detected,
      status: session.status,
      project_path: session.project_path,
      prompt: nil,
      tool: "claude",
      linked_task_id: nil,
      exit_code: nil,
      output_summary: session.summary,
      token_count: session.token_count,
      files_touched: session.files_touched,
      updated_at: session.last_active || session.updated_at,
      live: false
    }
  end

  # -- Private: Direct Claude spawn --

  defp resolve_claude_binary do
    System.find_executable("claude") ||
      (File.exists?(Path.expand("~/.local/bin/claude")) && Path.expand("~/.local/bin/claude")) ||
      nil
  end

  defp run_claude_session(claude_path, project_path, prompt, _model, session_id) do
    # Write prompt to temp file to avoid stdin issues
    tmp = Path.join(System.tmp_dir!(), "ema-prompt-#{session_id}.txt")
    File.write!(tmp, prompt)

    try do
      {output, exit_code} =
        System.cmd(
          claude_path,
          ["--print", "--output-format", "text", "--dangerously-skip-permissions", "-p", prompt],
          cd: project_path,
          stderr_to_stdout: true,
          env: [{"CLAUDE_CODE_ENTRYPOINT", "ema-orchestrator"}]
        )

      # Update ETS with result
      update_session_state(session_id, %{
        status: if(exit_code == 0, do: "completed", else: "failed"),
        exit_code: exit_code,
        output: String.slice(output, -4000, 4000)
      })

      Phoenix.PubSub.broadcast(
        Ema.PubSub,
        "sessions:orchestrator",
        {:session_completed, %{id: session_id, exit_code: exit_code}}
      )

      {output, exit_code}
    after
      File.rm(tmp)
    end
  rescue
    e ->
      update_session_state(session_id, %{status: "crashed", output: Exception.message(e)})
      {:error, Exception.message(e)}
  end

  defp update_session_state(session_id, updates) do
    case :ets.lookup(orchestrator_table(), session_id) do
      [{^session_id, state}] ->
        :ets.insert(orchestrator_table(), {session_id, Map.merge(state, updates)})

      _ ->
        :ok
    end
  end

  @doc "Initialize the ETS table. Call once from application startup."
  def init_table do
    if :ets.whereis(:ema_orchestrator_sessions) == :undefined do
      :ets.new(:ema_orchestrator_sessions, [:named_table, :public, :set])
    end

    :ok
  end

  @doc false
  def orchestrator_table do
    case :ets.whereis(:ema_orchestrator_sessions) do
      :undefined ->
        init_table()
        :ema_orchestrator_sessions

      _ref ->
        :ema_orchestrator_sessions
    end
  end

  # -- Private: Formatters --

  defp format_task_list(tasks) do
    Enum.map_join(tasks, "\n", fn t ->
      "- [#{t.status || "todo"}] #{t.title} (P#{t.priority || 3})"
    end)
  end

  defp format_goal_list(goals) do
    Enum.map_join(goals, "\n", fn g ->
      "- #{g.title} (#{g.timeframe || "ongoing"})"
    end)
  end

  # -- Private: Session lookup --

  defp find_session(session_id) do
    # Try CLI manager first
    case CliManager.get_session(session_id) do
      nil ->
        # Try detected sessions
        case ClaudeSessions.get_session(session_id) do
          {:ok, nil} -> {:error, "Session #{session_id} not found"}
          {:ok, session} -> {:ok, normalize_detected_session(session)}
          _ -> {:error, "Session #{session_id} not found"}
        end

      session ->
        {:ok, normalize_cli_session(session)}
    end
  end
end
