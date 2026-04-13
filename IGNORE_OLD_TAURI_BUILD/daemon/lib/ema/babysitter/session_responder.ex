defmodule Ema.Babysitter.SessionResponder do
  @moduledoc """
  Watches SessionObserver snapshots and takes action on stalled/completed Claude sessions.

  - Stalled sessions (>5min): posts alert to #babysitter-live with 10-min cooldown per session
  - Just-completed sessions: posts brief summary to #agent-thoughts
  """

  use GenServer
  require Logger

  @topic "babysitter:sessions"
  @babysitter_live "1489786483970936933"
  @agent_thoughts "1489820679472677044"
  @stall_cooldown_ms 30 * 60 * 1000

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  # --- GenServer callbacks ---

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, @topic)
    :ets.new(:session_responder_cooldowns, [:named_table, :set, :public])
    Logger.info("[SessionResponder] Started — watching babysitter:sessions")
    {:ok, %{}}
  end

  @impl true
  def handle_info(
        %{event: :session_snapshot, stalled: stalled, just_completed: completed} = _snap,
        state
      ) do
    now_ms = System.monotonic_time(:millisecond)

    due_stalled =
      stalled
      |> Enum.map(fn session ->
        project = Map.get(session, :project_path, Map.get(session, :project, "unknown"))
        {session, {:stall, project}}
      end)
      |> Enum.filter(fn {_session, key} ->
        case :ets.lookup(:session_responder_cooldowns, key) do
          [{^key, ts}] -> now_ms - ts > @stall_cooldown_ms
          [] -> true
        end
      end)

    if due_stalled != [] do
      lines =
        due_stalled
        |> Enum.take(5)
        |> Enum.map(fn {session, key} ->
          project = Map.get(session, :project_path, Map.get(session, :project, "unknown"))
          elapsed = format_elapsed(Map.get(session, :mtime))
          :ets.insert(:session_responder_cooldowns, {key, now_ms})
          "  └ **#{project}** stalled >5m — last active #{elapsed}"
        end)

      extra =
        if length(due_stalled) > 5,
          do: "
  └ +#{length(due_stalled) - 5} more stalled sessions",
          else: ""

      msg = "⚠️ **stalled sessions**
" <> Enum.join(lines, "
") <> extra
      Logger.info("[SessionResponder] Stall alert batch: #{length(due_stalled)} sessions")
      post(@babysitter_live, msg)
    end

    Enum.each(completed, fn session ->
      project = Map.get(session, :project_path, Map.get(session, :project, "unknown"))
      last_msg = Map.get(session, :last_text, Map.get(session, :last_message, "")) || ""

      snippet =
        if String.length(last_msg) > 100, do: String.slice(last_msg, 0, 97) <> "…", else: last_msg

      msg =
        if snippet != "" do
          "✅ **#{project}** session done — #{snippet}"
        else
          "✅ **#{project}** session done"
        end

      Logger.info("[SessionResponder] Completion: #{project}")
      post(@agent_thoughts, msg)
    end)

    {:noreply, state}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  # --- Helpers ---

  defp post(channel_id, message) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "discord:outbound:#{channel_id}",
      {:post, String.trim(message)}
    )
  end

  defp format_elapsed(nil), do: "unknown"

  defp format_elapsed(mtime) when is_integer(mtime) do
    diff = System.os_time(:second) - mtime

    cond do
      diff < 60 -> "#{diff}s ago"
      diff < 3600 -> "#{div(diff, 60)}m ago"
      true -> "#{div(diff, 3600)}h ago"
    end
  end

  defp format_elapsed(%DateTime{} = dt) do
    diff = DateTime.diff(DateTime.utc_now(), dt, :second)

    cond do
      diff < 60 -> "#{diff}s ago"
      diff < 3600 -> "#{div(diff, 60)}m ago"
      true -> "#{div(diff, 3600)}h ago"
    end
  end

  defp format_elapsed(_), do: "unknown"
end
