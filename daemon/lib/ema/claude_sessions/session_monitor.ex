defmodule Ema.ClaudeSessions.SessionMonitor do
  @moduledoc """
  GenServer that polls for active `claude` processes every 5 seconds.
  Broadcasts :session_active or :session_inactive via PubSub.
  """

  use GenServer
  require Logger

  @poll_interval :timer.seconds(5)

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Get the current set of active project directories."
  def active_projects do
    GenServer.call(__MODULE__, :active_projects)
  end

  # --- Callbacks ---

  @impl true
  def init(_opts) do
    state = %{
      active_dirs: MapSet.new()
    }

    schedule_poll()
    {:ok, state}
  end

  @impl true
  def handle_info(:poll, state) do
    new_dirs = detect_active_sessions()
    prev_dirs = state.active_dirs

    # Broadcast newly active
    new_dirs
    |> MapSet.difference(prev_dirs)
    |> Enum.each(fn dir ->
      broadcast(:session_active, dir)
    end)

    # Broadcast newly inactive
    prev_dirs
    |> MapSet.difference(new_dirs)
    |> Enum.each(fn dir ->
      broadcast(:session_inactive, dir)
    end)

    schedule_poll()
    {:noreply, %{state | active_dirs: new_dirs}}
  end

  @impl true
  def handle_call(:active_projects, _from, state) do
    {:reply, MapSet.to_list(state.active_dirs), state}
  end

  # --- Internal ---

  defp schedule_poll do
    Process.send_after(self(), :poll, @poll_interval)
  end

  defp detect_active_sessions do
    case System.cmd("pgrep", ["-af", "claude"], stderr_to_stdout: true) do
      {output, 0} ->
        output
        |> String.split("\n", trim: true)
        |> Enum.flat_map(&extract_project_dir/1)
        |> MapSet.new()

      {_, _exit_code} ->
        # pgrep returns exit 1 when no processes match — not an error
        MapSet.new()
    end
  end

  defp extract_project_dir(process_line) do
    # Try to find --project or -p flag, or a directory argument
    # Common patterns: "claude --project /path/to/dir" or cwd-based
    cond do
      match = Regex.run(~r/--project\s+(\S+)/, process_line) ->
        [Enum.at(match, 1)]

      match = Regex.run(~r/-p\s+(\S+)/, process_line) ->
        [Enum.at(match, 1)]

      # Fall back to looking for absolute paths that look like project dirs
      match = Regex.run(~r{(/(?:home|Users)/\S+?)(?:\s|$)}, process_line) ->
        path = Enum.at(match, 1)
        if File.dir?(path), do: [path], else: []

      true ->
        []
    end
  end

  defp broadcast(event, project_dir) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "claude_sessions",
      {event, %{project_dir: project_dir}}
    )
  end
end
