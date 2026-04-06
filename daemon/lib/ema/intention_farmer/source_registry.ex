defmodule Ema.IntentionFarmer.SourceRegistry do
  @moduledoc "Discovers and maintains registry of all AI terminal session source paths."

  use GenServer
  require Logger

  @refresh_interval :timer.minutes(5)

  @claude_sessions_root Path.expand("~/.claude/projects")
  @claude_tasks_root Path.expand("~/.claude/tasks")
  @codex_sessions_root Path.expand("~/.codex/sessions")
  @codex_history_path Path.expand("~/.codex/history.jsonl")
  @imports_root Path.expand("~/.local/share/ema/imports")
  @downloads_root Path.expand("~/Downloads")

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def sources do
    GenServer.call(__MODULE__, :sources)
  end

  def refresh do
    GenServer.cast(__MODULE__, :refresh)
  end

  def refresh_now do
    GenServer.call(__MODULE__, :refresh_now)
  end

  def all_files(sources) when is_map(sources) do
    [
      sources.claude_sessions || [],
      sources.claude_tasks || [],
      sources.codex_sessions || [],
      sources.codex_history || [],
      sources.import_sources || [],
      sources.claude_mds || []
    ]
    |> List.flatten()
    |> Enum.uniq()
  end

  @impl GenServer
  def init(_opts) do
    sources = discover_sources()
    schedule_refresh()
    {:ok, %{sources: sources}}
  end

  @impl GenServer
  def handle_call(:sources, _from, state) do
    {:reply, state.sources, state}
  end

  def handle_call(:refresh_now, _from, state) do
    sources = discover_sources()
    {:reply, sources, %{state | sources: sources}}
  end

  @impl GenServer
  def handle_cast(:refresh, state) do
    sources = discover_sources()

    if sources != state.sources do
      Phoenix.PubSub.broadcast(
        Ema.PubSub,
        "intention_farmer:events",
        {:sources_updated, sources}
      )
    end

    {:noreply, %{state | sources: sources}}
  end

  @impl GenServer
  def handle_info(:refresh, state) do
    sources = discover_sources()
    schedule_refresh()
    {:noreply, %{state | sources: sources}}
  end

  defp schedule_refresh do
    Process.send_after(self(), :refresh, @refresh_interval)
  end

  defp discover_sources do
    claude = discover_claude_sources()
    claude_tasks = discover_claude_task_sources()
    codex = discover_codex_sources()
    history = discover_codex_history()
    imports = discover_import_sources()
    claude_mds = discover_claude_mds()

    %{
      claude_sessions: claude,
      claude_tasks: claude_tasks,
      codex_sessions: codex,
      codex_history: history,
      import_sources: imports,
      claude_mds: claude_mds,
      total_files:
        length(claude) + length(claude_tasks) + length(codex) + length(history) +
          length(imports) + length(claude_mds)
    }
  end

  defp discover_claude_sources do
    Path.wildcard("#{@claude_sessions_root}/**/*.jsonl")
  end

  defp discover_codex_sources do
    Path.wildcard("#{@codex_sessions_root}/**/*.jsonl")
  end

  defp discover_claude_task_sources do
    Path.wildcard("#{@claude_tasks_root}/**/*.json")
    |> Enum.reject(&(Path.basename(&1) in [".lock", ".highwatermark"]))
  end

  defp discover_codex_history do
    if File.exists?(@codex_history_path) do
      [@codex_history_path]
    else
      []
    end
  end

  defp discover_import_sources do
    import_roots = [
      {@imports_root, true},
      {@downloads_root, false}
    ]

    import_roots
    |> Enum.flat_map(fn {root, recursive?} -> list_candidate_files(root, recursive?) end)
    |> Enum.filter(&import_candidate?/1)
    |> Enum.uniq()
    |> Enum.sort()
  end

  defp list_candidate_files(root, recursive?) do
    if File.dir?(root) do
      pattern =
        if recursive?,
          do: Path.join(root, "**/*"),
          else: Path.join(root, "*")

      Path.wildcard(pattern)
      |> Enum.filter(&File.regular?/1)
    else
      []
    end
  end

  defp import_candidate?(path) do
    ext = path |> Path.extname() |> String.downcase()
    base = Path.basename(path) |> String.downcase()

    interesting_ext? =
      ext in [".zip", ".json", ".jsonl", ".csv", ".txt", ".md", ".html", ".htm", ".gz", ".tgz", ".tar"]

    interesting_name? =
      String.contains?(base, "takeout") or
        String.contains?(base, "export") or
        String.contains?(base, "archive") or
        String.contains?(base, "chatgpt") or
        String.contains?(base, "openai") or
        String.contains?(base, "github") or
        String.contains?(base, "google") or
        String.contains?(base, "apple") or
        String.contains?(base, "facebook") or
        String.contains?(base, "instagram") or
        String.contains?(base, "claude") or
        String.contains?(base, "codex")

    interesting_ext? and interesting_name?
  end

  defp discover_claude_mds do
    project_claude_mds =
      try do
        Ema.Projects.list_projects()
        |> Enum.flat_map(fn project ->
          case project.linked_path do
            nil ->
              []

            path ->
              expanded = Path.expand(path)

              candidates = [
                Path.join(expanded, "CLAUDE.md"),
                Path.join([expanded, ".claude", "CLAUDE.md"])
              ]

              Enum.filter(candidates, &File.exists?/1)
          end
        end)
      rescue
        _ -> []
      end

    session_claude_mds =
      discover_claude_sources()
      |> Enum.map(fn path ->
        # ~/.claude/projects/<encoded-project-path>/<session>.jsonl
        # The parent dir name is the encoded project path
        path
        |> Path.dirname()
        |> Path.basename()
        |> URI.decode()
      end)
      |> Enum.uniq()
      |> Enum.flat_map(fn project_path ->
        expanded = Path.expand(project_path)
        md_path = Path.join(expanded, "CLAUDE.md")

        if File.exists?(md_path), do: [md_path], else: []
      end)

    Enum.uniq(project_claude_mds ++ session_claude_mds)
  end
end
