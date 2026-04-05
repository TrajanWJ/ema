defmodule Ema.Babysitter.ActiveSprintMonitor do
  use GenServer
  require Logger
  import Ecto.Query

  @poll_ms 60_000
  @live_channel "1489786483970936933"

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    timer = Process.send_after(self(), :poll, @poll_ms)
    {:ok, %{timer: timer, last_digest: nil}}
  end

  @impl true
  def handle_info(:poll, state) do
    digest = build_digest()
    if digest != state.last_digest, do: post_digest(digest)
    timer = Process.send_after(self(), :poll, @poll_ms)
    {:noreply, %{state | timer: timer, last_digest: digest}}
  end

  defp build_digest do
    now = DateTime.utc_now()
    one_hour_ago = DateTime.add(now, -3600, :second)

    task_counts =
      try do
        Ema.Repo.all(from t in Ema.Tasks.Task,
          where: t.updated_at >= ^one_hour_ago,
          group_by: t.status, select: {t.status, count(t.id)}) |> Map.new()
      rescue _ -> %{} end

    pending_deliberation =
      try do
        Ema.Repo.aggregate(from(p in Ema.Proposals.Proposal,
          where: p.pipeline_stage == "deliberation" and p.status == "active"), :count)
      rescue _ -> 0 end

    %{task_counts: task_counts, pending_deliberation: pending_deliberation, at: DateTime.to_iso8601(now)}
  end

  defp post_digest(digest) do
    time_str = case DateTime.from_iso8601(digest.at) do
      {:ok, dt, _} -> Calendar.strftime(dt, "%H:%M UTC")
      _ -> "?"
    end

    tasks_str = digest.task_counts
      |> Enum.sort_by(fn {_s, n} -> -n end)
      |> Enum.map(fn {s, n} -> "#{n} #{s}" end)
      |> Enum.join(" · ")
      |> case do "" -> "no recent tasks"; s -> s end

    delib_str = if digest.pending_deliberation > 0,
      do: "⚖️ #{digest.pending_deliberation} awaiting deliberation",
      else: "deliberation clear"

    msg = "📊 **Active Sprint** · #{time_str}\n  └ tasks (1h): #{tasks_str}\n  └ #{delib_str}"
    Phoenix.PubSub.broadcast(Ema.PubSub, "discord:outbound:#{@live_channel}", {:post, msg})
  end
end
