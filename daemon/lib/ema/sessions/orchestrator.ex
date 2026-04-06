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

  @doc "List all sessions: active CLI runners + detected Claude sessions"
  def list_all(opts \\ []) do
    limit = Keyword.get(opts, :limit, 30)

    cli_sessions =
      case CliManager.active_sessions() do
        {:ok, sessions} -> Enum.map(sessions, &normalize_cli_session/1)
        _ -> []
      end

    detected =
      case ClaudeSessions.list_sessions(limit: limit) do
        {:ok, sessions} -> Enum.map(sessions, &normalize_detected_session/1)
        _ -> []
      end

    all =
      (cli_sessions ++ detected)
      |> Enum.uniq_by(& &1.id)
      |> Enum.sort_by(& &1.updated_at, {:desc, DateTime})

    {:ok, Enum.take(all, limit)}
  end

  @doc "List only currently active sessions (running CLI + active detected)"
  def list_active do
    cli =
      case CliManager.active_sessions() do
        {:ok, sessions} -> Enum.map(sessions, &normalize_cli_session/1)
        _ -> []
      end

    detected =
      case ClaudeSessions.get_active_sessions() do
        {:ok, sessions} -> Enum.map(sessions, &normalize_detected_session/1)
        _ -> []
      end

    active_dirs = get_active_process_dirs()

    all =
      (cli ++ detected)
      |> Enum.uniq_by(& &1.id)
      |> Enum.map(fn s ->
        live? = s.project_path != nil and s.project_path in active_dirs
        %{s | live: live?}
      end)

    {:ok, all}
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

    # Ensure claude tool is discovered
    ensure_claude_tool()

    # Spawn via CliManager
    spawn_opts = %{
      "linked_task_id" => task_id,
      "linked_proposal_id" => Keyword.get(opts, :proposal_id)
    }

    case CliManager.SessionRunner.spawn_session("claude", project_path, full_prompt, spawn_opts) do
      {:ok, session} ->
        Logger.info("[Orchestrator] Spawned session #{session.id} in #{project_path}")

        Phoenix.PubSub.broadcast(
          Ema.PubSub,
          "sessions:orchestrator",
          {:session_spawned, %{id: session.id, project_path: project_path, prompt: prompt}}
        )

        {:ok, %{
          session_id: session.id,
          project_path: project_path,
          project_slug: project_slug,
          model: model,
          prompt: String.slice(prompt, 0, 200),
          status: "running",
          linked_task_id: task_id
        }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc "Resume an existing Claude Code session by passing a follow-up prompt"
  def resume(session_id, prompt, opts \\ []) do
    case find_session(session_id) do
      {:ok, session} ->
        project_path = session.project_path || "."

        spawn_opts = %{
          "linked_task_id" => Keyword.get(opts, :task_id)
        }

        case CliManager.SessionRunner.spawn_session("claude", project_path, prompt, spawn_opts) do
          {:ok, new_session} ->
            {:ok, %{
              session_id: new_session.id,
              resumed_from: session_id,
              project_path: project_path,
              status: "running"
            }}

          {:error, reason} ->
            {:error, reason}
        end

      {:error, _} = err ->
        err
    end
  end

  @doc "Kill a running CLI session"
  def kill(session_id) do
    case CliManager.SessionRunner.stop(session_id) do
      :ok -> {:ok, %{session_id: session_id, status: "killed"}}
      {:error, :not_running} -> {:error, "Session #{session_id} is not running"}
      {:error, reason} -> {:error, reason}
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

    sections = [
      "# EMA Context (auto-injected)",
      "",
      if(context.project, do: "## Project: #{context.project.name}\n#{context.project.description || ""}", else: nil),
      if(context.tasks != [], do: "## Active Tasks\n#{format_task_list(context.tasks)}", else: nil),
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
    case CliManager.get_session(session_id) do
      nil ->
        {:error, "Session not found"}

      session ->
        running? = CliManager.SessionRunner.running?(session_id)

        %{
          id: session.id,
          status: session.status,
          running: running?,
          exit_code: session.exit_code,
          output_summary: session.output_summary,
          project_path: session.project_path,
          prompt: session.prompt
        }
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
        |> Enum.map(fn t -> %{id: t.id, title: t.title, status: t.status, priority: t.priority} end)

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

  # -- Private: Process detection --

  defp get_active_process_dirs do
    case System.cmd("pgrep", ["-af", "claude\\b.*--"], stderr_to_stdout: true) do
      {output, 0} ->
        output
        |> String.split("\n", trim: true)
        |> Enum.flat_map(fn line ->
          case Regex.run(~r/--project\s+(\S+)/, line) do
            [_, dir] -> [dir]
            _ -> extract_cwd_from_line(line)
          end
        end)

      _ ->
        []
    end
  rescue
    _ -> []
  end

  defp extract_cwd_from_line(line) do
    case Regex.run(~r/--cwd\s+(\S+)/, line) do
      [_, dir] -> [dir]
      _ -> []
    end
  end

  # -- Private: Tool discovery --

  defp ensure_claude_tool do
    case CliManager.get_tool_by_name("claude") do
      nil ->
        path = System.find_executable("claude") || Path.expand("~/.local/bin/claude")

        if File.exists?(path) do
          CliManager.upsert_tool(%{
            "name" => "claude",
            "binary_path" => path,
            "capabilities" => Jason.encode!(["code", "chat", "edit"]),
            "session_dir" => Path.expand("~/.claude/projects")
          })
        end

      _ ->
        :ok
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
