defmodule Mix.Tasks.Ema.State.Reset do
  use Mix.Task

  @shortdoc "Reset EMA runtime state while preserving bootstrap data"
  @moduledoc """
  Clears accumulated runtime state from the EMA dev database so the app looks
  closer to a first-run system, while preserving bootstrap configuration by
  default.

      mix ema.state.reset
      mix ema.state.reset --drop-intents
      mix ema.state.reset --drop-primary-project
      mix ema.state.reset --purge-results

  Default behavior preserves:
    - settings
    - agents and channels
    - pipes
    - prompts and templates
    - actors
    - vault notes and links
    - intent nodes
    - the primary EMA project (when configured)
  """

  @history_tables [
    "execution_events",
    "executions",
    "proposal_tags",
    "proposals",
    "proposal_seeds",
    "agent_sessions",
    "ai_session_messages",
    "ai_sessions",
    "claude_sessions",
    "harvested_intents",
    "harvested_sessions",
    "harvester_runs",
    "usage_records",
    "claude_routing_decisions",
    "claude_failure_events",
    "audit_logs",
    "claude_audit_logs",
    "vm_health_events",
    "token_events",
    "reflexion_entries",
    "context_fragments",
    "pipe_runs",
    "phase_transitions",
    "external_vault_sync_entries",
    "git_events",
    "ingest_jobs",
    "session_store"
  ]

  @workflow_tables [
    "goal_check_ins",
    "goal_key_results",
    "goals",
    "task_comments",
    "task_dependencies",
    "tasks",
    "focus_blocks",
    "focus_sessions",
    "inbox_items",
    "intent_clusters",
    "gaps",
    "workspace_windows",
    "journal_entries",
    "clipboard_clips",
    "canvases",
    "canvas_elements"
  ]

  @optional_tables [
    {"intent_edges", :drop_intents},
    {"intent_nodes", :drop_intents}
  ]

  @count_tables [
    "projects",
    "goals",
    "tasks",
    "proposal_seeds",
    "proposals",
    "executions",
    "execution_events",
    "inbox_items",
    "intent_clusters",
    "intent_nodes",
    "harvested_sessions",
    "harvested_intents",
    "agent_sessions",
    "claude_sessions",
    "usage_records",
    "journal_entries",
    "workspace_windows",
    "clipboard_clips"
  ]

  @impl true
  def run(args) do
    {opts, _rest, _invalid} =
      OptionParser.parse(args,
        switches: [
          drop_intents: :boolean,
          drop_primary_project: :boolean,
          purge_results: :boolean
        ]
      )

    boot_repo()

    flags = %{
      drop_intents: Keyword.get(opts, :drop_intents, false),
      drop_primary_project: Keyword.get(opts, :drop_primary_project, false),
      purge_results: Keyword.get(opts, :purge_results, false)
    }

    before_counts = count_tables(@count_tables)

    Ema.Repo.transaction(fn ->
      Enum.each(@history_tables ++ @workflow_tables, &clear_table/1)

      Enum.each(@optional_tables, fn {table, flag} ->
        if Map.fetch!(flags, flag) do
          clear_table(table)
        end
      end)

      reset_projects(flags)
    end)

    reset_outcome_tracker()

    if flags.purge_results do
      purge_results_dir()
    end

    after_counts = count_tables(@count_tables)

    Mix.shell().info("EMA state reset complete.\n")
    Mix.shell().info(render_counts("Before", before_counts))
    Mix.shell().info(render_counts("After", after_counts))
  end

  defp clear_table(table) do
    if table_exists?(table) do
      Ema.Repo.query!("DELETE FROM #{table}")
    end
  end

  defp reset_projects(%{drop_primary_project: true}) do
    clear_table("projects")
  end

  defp reset_projects(_flags) do
    primary_project_id =
      case Ema.Repo.query!("SELECT value FROM settings WHERE key = 'ema_project_id' LIMIT 1") do
        %{rows: [[id]]} -> id
        _ -> nil
      end

    case primary_project_id do
      nil ->
        Ema.Repo.query!("DELETE FROM projects WHERE slug != 'ema'")

      id ->
        Ema.Repo.query!("DELETE FROM projects WHERE id != ?", [id])
    end
  end

  defp count_tables(tables) do
    Map.new(tables, fn table ->
      count =
        if table_exists?(table) do
          %{rows: [[count]]} = Ema.Repo.query!("SELECT COUNT(*) FROM #{table}")
          count
        else
          0
        end

      {table, count}
    end)
  end

  defp table_exists?(table) do
    case Ema.Repo.query!(
           "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
           [table]
         ) do
      %{rows: [[1]]} -> true
      _ -> false
    end
  end

  defp render_counts(label, counts) do
    rows =
      @count_tables
      |> Enum.map(fn table ->
        String.pad_trailing(table, 18) <> Integer.to_string(Map.get(counts, table, 0))
      end)
      |> Enum.join("\n")

    label <> ":\n" <> rows <> "\n"
  end

  defp reset_outcome_tracker do
    path = Path.expand("~/.local/share/ema/outcome-tracker.json")
    File.mkdir_p!(Path.dirname(path))
    File.write!(path, "[]\n")
  end

  defp purge_results_dir do
    path = Path.expand("~/.local/share/ema/results")
    File.rm_rf!(path)
    File.mkdir_p!(path)
  end

  defp boot_repo do
    Mix.Task.run("loadpaths")
    Mix.Task.run("app.config")
    Application.ensure_all_started(:ecto_sql)
    {:ok, _pid} = Ema.Repo.start_link()
  end
end
