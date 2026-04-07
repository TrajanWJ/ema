defmodule Ema.Babysitter.SessionObserver do
  @moduledoc """
  Watches Claude Code session files (~/.claude/projects/**/*.jsonl) for
  real-time activity and streams observations to PubSub.

  Unlike the DB-based ClaudeSession records (which are stale), this module
  reads the raw session files directly to detect:
  - Active sessions with recent writes
  - Stalled sessions (file exists but no writes in >5min)
  - Completed sessions (last message type is "result")
  - What each session is actually doing (last tool call / assistant message)

  Broadcasts to "babysitter:sessions" topic with:
    %{event: :session_snapshot, sessions: [...], stalled: [...], just_completed: [...]}
  """

  use GenServer
  require Logger

  @projects_dir Path.expand("~/.claude/projects")
  @poll_interval 30_000
  @stale_threshold_s 300
  @pubsub Ema.PubSub
  @topic "babysitter:sessions"
  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def snapshot do
    GenServer.call(__MODULE__, :snapshot, 10_000)
  catch
    :exit, _ -> %{sessions: [], stalled: [], just_completed: [], error: :not_running}
  end

  # --- GenServer ---

  @impl true
  def init(_opts) do
    timer = schedule_poll(0)
    {:ok, %{timer: timer, last_snapshot: %{sessions: [], stalled: [], just_completed: []}}}
  end

  @impl true
  def handle_call(:snapshot, _from, state) do
    {:reply, state.last_snapshot, state}
  end

  @impl true
  def handle_info(:poll, state) do
    snapshot = build_snapshot()

    if snapshot != state.last_snapshot do
      Phoenix.PubSub.broadcast(
        @pubsub,
        @topic,
        %{event: :session_snapshot} |> Map.merge(snapshot)
      )
    end

    timer = schedule_poll(@poll_interval)
    {:noreply, %{state | timer: timer, last_snapshot: snapshot}}
  end

  # --- Internal ---

  defp schedule_poll(delay) do
    Process.send_after(self(), :poll, delay)
  end

  defp build_snapshot do
    now = System.os_time(:second)
    files = list_recent_sessions(now)

    sessions =
      files
      |> Enum.map(&parse_session_file/1)
      |> Enum.reject(&is_nil/1)

    stalled = sessions |> Enum.filter(&stalled?(&1, now))
    just_completed = sessions |> Enum.filter(&(&1.status == :completed))

    %{sessions: sessions, stalled: stalled, just_completed: just_completed}
  end

  defp list_recent_sessions(now) do
    case File.ls(@projects_dir) do
      {:ok, project_dirs} ->
        project_dirs
        |> Enum.flat_map(fn proj ->
          dir = Path.join(@projects_dir, proj)

          case File.ls(dir) do
            {:ok, files} ->
              files
              |> Enum.filter(&String.ends_with?(&1, ".jsonl"))
              |> Enum.map(&Path.join(dir, &1))
              |> Enum.filter(fn path ->
                case File.stat(path) do
                  {:ok, %{mtime: mtime}} ->
                    mtime_s =
                      mtime
                      |> :calendar.datetime_to_gregorian_seconds()
                      |> Kernel.-(
                        :calendar.datetime_to_gregorian_seconds({{1970, 1, 1}, {0, 0, 0}})
                      )

                    # modified in last 2 hours
                    now - mtime_s < 7200

                  _ ->
                    false
                end
              end)

            _ ->
              []
          end
        end)

      _ ->
        []
    end
  end

  defp parse_session_file(path) do
    try do
      lines = File.stream!(path, :line) |> Enum.take(-20) |> Enum.map(&String.trim/1)

      parsed =
        lines
        |> Enum.map(fn line ->
          case Jason.decode(line) do
            {:ok, obj} -> obj
            _ -> nil
          end
        end)
        |> Enum.reject(&is_nil/1)

      last_entry = List.last(parsed)
      if is_nil(last_entry), do: throw(:empty)

      session_id = get_in(last_entry, ["sessionId"]) || get_in(last_entry, ["session_id"])

      project_path =
        path
        |> Path.dirname()
        |> Path.basename()
        |> String.replace(~r/^-home-trajan-/, "~/")
        |> String.replace("-", "/")

      last_type = get_in(last_entry, ["type"])
      last_ts = get_in(last_entry, ["timestamp"]) || get_in(last_entry, ["created_at"])

      # Extract last assistant text
      last_text = extract_last_text(parsed)
      last_tool = extract_last_tool(parsed)

      mtime =
        case File.stat(path) do
          {:ok, %{mtime: mt}} ->
            mt
            |> :calendar.datetime_to_gregorian_seconds()
            |> Kernel.-(:calendar.datetime_to_gregorian_seconds({{1970, 1, 1}, {0, 0, 0}}))

          _ ->
            0
        end

      status =
        cond do
          last_type == "result" -> :completed
          last_type in ["assistant", "user"] -> :active
          true -> :unknown
        end

      %{
        session_id: session_id,
        project_path: project_path,
        path: path,
        status: status,
        last_type: last_type,
        last_text: last_text,
        last_tool: last_tool,
        last_ts: last_ts,
        mtime: mtime,
        entry_count: length(parsed)
      }
    rescue
      _ -> nil
    catch
      :empty -> nil
    end
  end

  defp stalled?(%{mtime: mtime, status: status}, now) do
    status != :completed and now - mtime > @stale_threshold_s
  end

  defp extract_last_text(entries) do
    entries
    |> Enum.reverse()
    |> Enum.find_value(fn entry ->
      msg = Map.get(entry, "message", %{})
      role = Map.get(msg, "role")
      content = Map.get(msg, "content", [])

      if role == "assistant" do
        content
        |> List.wrap()
        |> Enum.find_value(fn
          %{"type" => "text", "text" => t} when is_binary(t) -> String.slice(t, 0, 80)
          t when is_binary(t) -> String.slice(t, 0, 80)
          _ -> nil
        end)
      end
    end)
  end

  defp extract_last_tool(entries) do
    entries
    |> Enum.reverse()
    |> Enum.find_value(fn entry ->
      msg = Map.get(entry, "message", %{})
      content = Map.get(msg, "content", [])

      content
      |> List.wrap()
      |> Enum.find_value(fn
        %{"type" => "tool_use", "name" => name} -> name
        _ -> nil
      end)
    end)
  end
end
