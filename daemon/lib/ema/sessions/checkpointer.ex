defmodule Ema.Sessions.Checkpointer do
  @moduledoc """
  GenServer that periodically snapshots active Claude session state.

  Subscribes to `"claude_sessions"` PubSub for session lifecycle events.
  When a session becomes active, schedules a checkpoint every 60 seconds.
  Each checkpoint captures: files modified, git diff summary, last tool call,
  and linked execution/intent context.

  Checkpoints are stored in the `session_checkpoints` table and used by
  `DeathHandler` and `Resumption` for crash recovery.
  """

  use GenServer
  require Logger

  alias Ema.Repo
  alias Ema.Sessions.Checkpoint
  alias Ema.ClaudeSessions
  alias Ema.ClaudeSessions.SessionParser

  @checkpoint_interval :timer.seconds(60)

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Force a checkpoint for a specific session ID."
  def checkpoint_now(session_id) do
    GenServer.cast(__MODULE__, {:checkpoint, session_id})
  end

  @doc "List all checkpoints for a session, newest first."
  def list_checkpoints(session_id) do
    import Ecto.Query

    Checkpoint
    |> where([c], c.session_id == ^session_id)
    |> order_by([c], desc: c.checkpoint_at)
    |> Repo.all()
  end

  @doc "Get the most recent checkpoint for a session."
  def latest_checkpoint(session_id) do
    import Ecto.Query

    Checkpoint
    |> where([c], c.session_id == ^session_id)
    |> order_by([c], desc: c.checkpoint_at)
    |> limit(1)
    |> Repo.one()
  end

  # --- Callbacks ---

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "claude_sessions")

    state = %{
      active_sessions: MapSet.new(),
      timers: %{}
    }

    # Seed from already-active sessions
    for session <- ClaudeSessions.get_active_sessions() do
      send(self(), {:start_tracking, session.session_id})
    end

    {:ok, state}
  end

  @impl true
  def handle_info({:session_detected, %{session_id: sid, status: "active"}}, state) do
    {:noreply, start_tracking(state, sid)}
  end

  @impl true
  def handle_info({:session_active, %{project_dir: _dir}}, state) do
    # SessionMonitor broadcasts project dirs, not session IDs.
    # We rely on session_detected from SessionWatcher for ID-based tracking.
    {:noreply, state}
  end

  @impl true
  def handle_info({:session_inactive, %{project_dir: _dir}}, state) do
    {:noreply, state}
  end

  @impl true
  def handle_info({:session_detected, %{session_id: sid, status: status}}, state)
      when status in ["completed", "abandoned"] do
    {:noreply, stop_tracking(state, sid)}
  end

  @impl true
  def handle_info({:session_detected, _}, state), do: {:noreply, state}

  @impl true
  def handle_info({:start_tracking, sid}, state) do
    {:noreply, start_tracking(state, sid)}
  end

  @impl true
  def handle_info({:do_checkpoint, sid}, state) do
    if MapSet.member?(state.active_sessions, sid) do
      do_checkpoint(sid)
      timer = schedule_checkpoint(sid)
      {:noreply, %{state | timers: Map.put(state.timers, sid, timer)}}
    else
      {:noreply, state}
    end
  end

  @impl true
  def handle_cast({:checkpoint, sid}, state) do
    do_checkpoint(sid)
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Internal ---

  defp start_tracking(state, sid) do
    if MapSet.member?(state.active_sessions, sid) do
      state
    else
      Logger.info("[Checkpointer] Tracking session #{sid}")
      timer = schedule_checkpoint(sid)

      %{
        state
        | active_sessions: MapSet.put(state.active_sessions, sid),
          timers: Map.put(state.timers, sid, timer)
      }
    end
  end

  defp stop_tracking(state, sid) do
    case Map.pop(state.timers, sid) do
      {nil, timers} ->
        %{state | active_sessions: MapSet.delete(state.active_sessions, sid), timers: timers}

      {timer_ref, timers} ->
        Process.cancel_timer(timer_ref)
        Logger.info("[Checkpointer] Stopped tracking session #{sid}")
        %{state | active_sessions: MapSet.delete(state.active_sessions, sid), timers: timers}
    end
  end

  defp schedule_checkpoint(sid) do
    Process.send_after(self(), {:do_checkpoint, sid}, @checkpoint_interval)
  end

  defp do_checkpoint(session_id) do
    case ClaudeSessions.get_session(session_id) do
      nil ->
        Logger.debug("[Checkpointer] Session #{session_id} not found in DB, skipping")

      session ->
        checkpoint_data = gather_checkpoint_data(session)
        save_checkpoint(checkpoint_data)
    end
  rescue
    e ->
      Logger.warning("[Checkpointer] Failed to checkpoint #{session_id}: #{Exception.message(e)}")
  end

  defp gather_checkpoint_data(session) do
    execution = resolve_execution(session)
    intent = resolve_intent(execution)
    files = gather_files_modified(session)
    git_diff = gather_git_diff(session.project_path)
    last_tool = extract_last_tool_call(session)

    %{
      session_id: session.session_id,
      execution_id: if(execution, do: execution.id),
      intent_id: if(intent, do: intent.id),
      phase: if(execution, do: execution.mode),
      files_modified: files,
      conversation_summary: nil,
      git_diff_summary: git_diff,
      last_tool_call: last_tool
    }
  end

  defp resolve_execution(session) do
    # Try execution linked via session_id first
    case Ema.Executions.get_by_session(session.id) do
      nil ->
        # Fall back: check if session_id starts with "exec_"
        case session.session_id do
          "exec_" <> execution_id -> Ema.Executions.get_execution(execution_id)
          _ -> nil
        end

      execution ->
        execution
    end
  end

  defp resolve_intent(nil), do: nil

  defp resolve_intent(execution) do
    if is_binary(execution.intent_slug) and execution.intent_slug != "" do
      Ema.Intents.get_intent_by_slug(execution.intent_slug)
    end
  end

  defp gather_files_modified(session) do
    # Use files_touched from the parsed session data
    session.files_touched || []
  end

  defp gather_git_diff(nil), do: nil
  defp gather_git_diff(""), do: nil

  defp gather_git_diff(project_path) do
    if File.dir?(project_path) do
      case System.cmd("git", ["diff", "--stat", "HEAD"], cd: project_path, stderr_to_stdout: true) do
        {output, 0} ->
          truncate(output, 2000)

        {_, _} ->
          nil
      end
    end
  end

  defp extract_last_tool_call(session) do
    # Re-parse the session file to get the last tool call
    case session.raw_path do
      nil ->
        nil

      path ->
        case SessionParser.parse_file(path) do
          {:ok, parsed} ->
            parsed.messages
            |> Enum.reverse()
            |> Enum.find_value(fn msg ->
              extract_tool_from_message(msg)
            end)

          _ ->
            nil
        end
    end
  end

  defp extract_tool_from_message(msg) do
    content_list = List.wrap(msg["content"] || [])

    Enum.find_value(content_list, fn
      %{"type" => "tool_use", "name" => name, "input" => input} when is_map(input) ->
        summary = summarize_tool_input(name, input)
        "#{name}: #{summary}"

      _ ->
        nil
    end)
  end

  defp summarize_tool_input("Read", input), do: input["file_path"] || "unknown"
  defp summarize_tool_input("Edit", input), do: input["file_path"] || "unknown"
  defp summarize_tool_input("Write", input), do: input["file_path"] || "unknown"

  defp summarize_tool_input("Bash", input) do
    cmd = input["command"] || ""
    truncate(cmd, 120)
  end

  defp summarize_tool_input(name, _input), do: name

  defp save_checkpoint(data) do
    id = generate_id()
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    attrs =
      data
      |> Map.put(:id, id)
      |> Map.put(:checkpoint_at, now)

    case %Checkpoint{} |> Checkpoint.changeset(attrs) |> Repo.insert() do
      {:ok, checkpoint} ->
        Logger.debug("[Checkpointer] Saved checkpoint #{id} for session #{data.session_id}")
        {:ok, checkpoint}

      {:error, changeset} ->
        Logger.warning("[Checkpointer] Failed to save checkpoint: #{inspect(changeset.errors)}")
        {:error, changeset}
    end
  end

  defp generate_id do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "ckpt_#{ts}_#{rand}"
  end

  defp truncate(nil, _), do: nil
  defp truncate(str, max) when byte_size(str) <= max, do: str
  defp truncate(str, max), do: String.slice(str, 0, max) <> "..."
end
