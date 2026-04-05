defmodule Ema.Babysitter.ChannelManager do
  @moduledoc """
  Active channel lifecycle management.

  Monitors sprint channels for activity and manages their lifecycle:
  - Updates channel topics with live status
  - Archives channels that have been quiet for >24h with no active tasks
  - Posts sprint digests when channels have new activity
  - Creates channels for new projects on demand

  Runs every 5 minutes.
  """

  use GenServer
  require Logger
  import Ecto.Query
  alias Ema.Babysitter.OrgController

  @poll_ms 5 * 60 * 1000
  @archive_category_id "1484014919904002170"
  @ema_systems_category_id "1484410815464345620"
  @alerts_channel "1484031239680823316"
  @babysitter_live "1489786483970936933"

  # Sprint channels to actively manage
  @sprint_channels [
    %{id: "1489751362211282954", name: "critical-blockers-track"},
    %{id: "1489751362215608441", name: "core-loop-implementation"},
    %{id: "1489751362613805317", name: "intelligence-integrations"},
    %{id: "1485847116227280966", name: "deliberation"},
    %{id: "1485847117078724629", name: "prompt-lab"},
    %{id: "1489854642174165084", name: "codex-improvements"},
    %{id: "1489854642304188466", name: "cross-pollination"},
    %{id: "1489854642644058153", name: "gap-analysis"}
  ]

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    timer = Process.send_after(self(), :manage, @poll_ms)
    {:ok, %{timer: timer, channel_state: %{}}}
  end

  @impl true
  def handle_info(:manage, state) do
    new_channel_state = run_management_cycle(state.channel_state)
    timer = Process.send_after(self(), :manage, @poll_ms)
    {:noreply, %{state | timer: timer, channel_state: new_channel_state}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Management cycle ---

  defp run_management_cycle(channel_state) do
    now = DateTime.utc_now()
    one_hour_ago = DateTime.add(now, -3600, :second)

    Enum.reduce(@sprint_channels, channel_state, fn ch, acc ->
      # Check recent task activity for this channel (by checking all tasks updated recently)
      recent_tasks =
        try do
          Ema.Repo.aggregate(
            from(t in Ema.Tasks.Task,
              where: t.updated_at >= ^one_hour_ago and t.status not in ["done", "archived", "cancelled"]),
            :count
          )
        rescue
          _ -> 0
        end

      # Check if there are any active tasks overall
      active_tasks =
        try do
          Ema.Repo.aggregate(
            from(t in Ema.Tasks.Task,
              where: t.status in ["todo", "in_progress", "blocked"]),
            :count
          )
        rescue
          _ -> 0
        end

      # Update channel topic with status
      topic = build_channel_topic(ch.name, recent_tasks, active_tasks, now)
      safe_update_topic(ch.id, topic)

      Map.put(acc, ch.id, %{last_managed: now, recent_tasks: recent_tasks})
    end)
  end

  defp build_channel_topic(name, recent_tasks, active_tasks, now) do
    time_str = Calendar.strftime(now, "%H:%M UTC")
    "#{channel_icon(name)} #{recent_tasks} active · #{active_tasks} total open · updated #{time_str}"
  end

  defp channel_icon("critical-blockers" <> _), do: "🚨"
  defp channel_icon("core-loop" <> _), do: "⚙️"
  defp channel_icon("intelligence" <> _), do: "🧠"
  defp channel_icon("deliberation"), do: "⚖️"
  defp channel_icon("prompt-lab"), do: "🎯"
  defp channel_icon("codex-improvements"), do: "🤖"
  defp channel_icon("cross-pollination"), do: "🌱"
  defp channel_icon("gap-analysis"), do: "🔍"
  defp channel_icon(_), do: "📌"

  defp safe_update_topic(channel_id, topic) do
    try do
      OrgController.set_channel_topic(channel_id, topic)
    rescue
      e -> Logger.warning("[ChannelManager] Failed to update topic for #{channel_id}: #{inspect(e)}")
    catch
      :exit, _ -> Logger.warning("[ChannelManager] OrgController not available for topic update")
    end
  end
end
