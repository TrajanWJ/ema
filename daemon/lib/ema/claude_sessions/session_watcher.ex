defmodule Ema.ClaudeSessions.SessionWatcher do
  @moduledoc """
  GenServer that watches ~/.claude/projects/ for new/updated session files (JSONL).
  Polls every 30 seconds, compares mtimes, and triggers parse + import
  for new or changed files.
  """

  use GenServer
  require Logger

  alias Ema.ClaudeSessions
  alias Ema.ClaudeSessions.{SessionParser, SessionLinker}

  @poll_interval :timer.seconds(30)

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Force a scan now (useful for testing)."
  def scan_now do
    GenServer.cast(__MODULE__, :scan)
  end

  # --- Callbacks ---

  @impl true
  def init(opts) do
    base_path = opts[:base_path] || default_base_path()

    state = %{
      base_path: base_path,
      known_files: %{}
    }

    schedule_poll()
    {:ok, state}
  end

  @impl true
  def handle_info(:poll, state) do
    state = do_scan(state)
    schedule_poll()
    {:noreply, state}
  end

  @impl true
  def handle_cast(:scan, state) do
    {:noreply, do_scan(state)}
  end

  # --- Internal ---

  defp schedule_poll do
    Process.send_after(self(), :poll, @poll_interval)
  end

  defp do_scan(state) do
    current_files = discover_session_files(state.base_path)

    new_or_changed =
      Enum.filter(current_files, fn {path, mtime} ->
        case Map.get(state.known_files, path) do
          nil -> true
          prev_mtime -> mtime > prev_mtime
        end
      end)

    Enum.each(new_or_changed, fn {path, _mtime} ->
      process_session_file(path)
    end)

    %{state | known_files: Map.new(current_files)}
  end

  defp discover_session_files(base_path) do
    pattern = Path.join([base_path, "**", "*.jsonl"])

    pattern
    |> Path.wildcard()
    |> Enum.flat_map(fn path ->
      case File.stat(path) do
        {:ok, %{mtime: mtime}} ->
          [{path, mtime}]

        {:error, _} ->
          []
      end
    end)
  end

  defp process_session_file(path) do
    Logger.info("SessionWatcher: processing #{path}")

    case SessionParser.parse_file(path) do
      {:ok, parsed} ->
        import_session(parsed, path)

      {:error, reason} ->
        Logger.warning("SessionWatcher: failed to parse #{path}: #{inspect(reason)}")

        failure = Ema.Claude.Failure.classify_session_error(reason, metadata: %{path: path})
        Ema.Claude.Failure.record(failure, artifact_id: path, artifact_type: :session_file)
    end
  end

  defp import_session(parsed, raw_path) do
    project_id =
      case SessionLinker.link(parsed) do
        {:ok, pid} -> pid
        :unlinked -> nil
      end

    attrs = %{
      session_id: parsed.session_id,
      project_path: parsed.project_path,
      started_at: parsed.started_at,
      ended_at: parsed.ended_at,
      last_active: parsed.ended_at || parsed.started_at,
      status: if(parsed.ended_at, do: "completed", else: "active"),
      token_count: parsed.token_count,
      tool_calls: parsed.tool_calls,
      files_touched: parsed.files_touched,
      raw_path: raw_path,
      project_id: project_id,
      metadata: %{}
    }

    case ClaudeSessions.get_session(parsed.session_id) do
      nil ->
        attrs = Map.put(attrs, :id, parsed.session_id)

        case ClaudeSessions.create_session(attrs) do
          {:ok, session} ->
            broadcast(:session_detected, session)

          {:error, reason} ->
            Logger.warning("SessionWatcher: failed to create session: #{inspect(reason)}")
        end

      existing ->
        case ClaudeSessions.update_session(existing, attrs) do
          {:ok, session} ->
            broadcast(:session_detected, session)

          {:error, reason} ->
            Logger.warning("SessionWatcher: failed to update session: #{inspect(reason)}")
        end
    end
  end

  defp broadcast(event, session) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "claude_sessions",
      {event, %{id: session.id, session_id: session.session_id, status: session.status}}
    )
  end

  defp default_base_path do
    Path.join([System.get_env("HOME", "~"), ".claude", "projects"])
  end
end
