defmodule Ema.Intelligence.GitWatcher do
  @moduledoc """
  GenServer that polls configured git repositories for new commits every 60 seconds.
  On detecting a new commit, extracts diff, changed files, and commit message,
  then stores a GitEvent and triggers wiki sync analysis.
  """

  use GenServer
  require Logger

  alias Ema.Intelligence

  @poll_interval_ms 60_000

  # ── Client API ──

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def scan_repo(repo_path) do
    GenServer.cast(__MODULE__, {:scan_repo, repo_path})
  end

  def watched_repos do
    GenServer.call(__MODULE__, :watched_repos)
  end

  # ── Callbacks ──

  @impl true
  def init(_opts) do
    paths = Application.get_env(:ema, :git_watch_paths, default_paths())

    state = %{
      paths: paths,
      last_seen: %{}
    }

    # Initialize last_seen with current HEAD for each repo
    state = Enum.reduce(paths, state, fn path, acc ->
      case git_head_sha(path) do
        {:ok, sha} -> put_in(acc, [:last_seen, path], sha)
        _ -> acc
      end
    end)

    schedule_poll()
    Logger.info("[GitWatcher] Watching #{length(paths)} repos")
    {:ok, state}
  end

  @impl true
  def handle_info(:poll, state) do
    state = poll_all_repos(state)
    schedule_poll()
    {:noreply, state}
  end

  @impl true
  def handle_cast({:scan_repo, repo_path}, state) do
    state = poll_repo(state, repo_path)
    {:noreply, state}
  end

  @impl true
  def handle_call(:watched_repos, _from, state) do
    {:reply, state.paths, state}
  end

  # ── Private ──

  defp schedule_poll do
    Process.send_after(self(), :poll, @poll_interval_ms)
  end

  defp poll_all_repos(state) do
    Enum.reduce(state.paths, state, &poll_repo(&2, &1))
  end

  defp poll_repo(state, repo_path) do
    last_sha = Map.get(state.last_seen, repo_path)

    case detect_new_commits(repo_path, last_sha) do
      {:ok, []} ->
        state

      {:ok, commits} ->
        Enum.each(commits, fn commit ->
          process_commit(repo_path, commit)
        end)

        newest_sha = hd(commits).sha
        put_in(state, [:last_seen, repo_path], newest_sha)

      {:error, reason} ->
        Logger.warning("[GitWatcher] Failed to poll #{repo_path}: #{reason}")
        state
    end
  end

  defp detect_new_commits(repo_path, nil) do
    # First run — just record HEAD, don't import history
    case git_head_sha(repo_path) do
      {:ok, _sha} -> {:ok, []}
      error -> error
    end
  end

  defp detect_new_commits(repo_path, last_sha) do
    case System.cmd("git", ["log", "--format=%H|%an|%s", "#{last_sha}..HEAD"],
           cd: repo_path,
           stderr_to_stdout: true
         ) do
      {output, 0} ->
        commits =
          output
          |> String.trim()
          |> String.split("\n", trim: true)
          |> Enum.map(&parse_log_line/1)
          |> Enum.reject(&is_nil/1)
          |> Enum.reverse()

        {:ok, commits}

      {error, _} ->
        {:error, error}
    end
  end

  defp parse_log_line(line) do
    case String.split(line, "|", parts: 3) do
      [sha, author, message] -> %{sha: sha, author: author, message: message}
      _ -> nil
    end
  end

  defp process_commit(repo_path, %{sha: sha, author: author, message: message}) do
    # Skip if already recorded
    if Intelligence.get_git_event_by_sha(sha) do
      :already_exists
    else
      changed_files = get_changed_files(repo_path, sha)
      diff_summary = get_diff_summary(repo_path, sha)

      attrs = %{
        "repo_path" => repo_path,
        "commit_sha" => sha,
        "author" => author,
        "message" => message,
        "changed_files" => %{"files" => changed_files},
        "diff_summary" => diff_summary
      }

      case Intelligence.create_git_event(attrs) do
        {:ok, event} ->
          # Trigger async wiki sync analysis
          Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
            Ema.Intelligence.WikiSync.analyze(event)
          end)

          Logger.info("[GitWatcher] Recorded commit #{String.slice(sha, 0, 8)} in #{Path.basename(repo_path)}")

        {:error, reason} ->
          Logger.warning("[GitWatcher] Failed to record commit #{sha}: #{inspect(reason)}")
      end
    end
  end

  defp get_changed_files(repo_path, sha) do
    case System.cmd("git", ["diff-tree", "--no-commit-id", "--name-status", "-r", sha],
           cd: repo_path,
           stderr_to_stdout: true
         ) do
      {output, 0} ->
        output
        |> String.trim()
        |> String.split("\n", trim: true)
        |> Enum.map(fn line ->
          case String.split(line, "\t", parts: 2) do
            [status, path] -> %{"status" => status, "path" => path}
            _ -> nil
          end
        end)
        |> Enum.reject(&is_nil/1)

      _ ->
        []
    end
  end

  defp get_diff_summary(repo_path, sha) do
    case System.cmd("git", ["diff-tree", "--stat", "--no-commit-id", sha],
           cd: repo_path,
           stderr_to_stdout: true
         ) do
      {output, 0} -> String.trim(output)
      _ -> ""
    end
  end

  defp git_head_sha(repo_path) do
    case System.cmd("git", ["rev-parse", "HEAD"], cd: repo_path, stderr_to_stdout: true) do
      {sha, 0} -> {:ok, String.trim(sha)}
      {err, _} -> {:error, err}
    end
  end

  defp default_paths do
    [
      Path.expand("~/Projects/ema"),
      Path.expand("~/Desktop/place.org"),
      Path.expand("~/Desktop/JarvisAI")
    ]
    |> Enum.filter(&File.dir?/1)
  end
end
