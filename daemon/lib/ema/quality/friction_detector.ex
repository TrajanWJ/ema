defmodule Ema.Quality.FrictionDetector do
  @moduledoc """
  Periodic friction scanner. Detects blocked clusters, brain dump spikes,
  session interruptions, and overdue accumulation. Computes a 0.0-1.0 friction score.
  """

  use GenServer
  require Logger
  import Ecto.Query

  alias Ema.Repo

  @scan_interval :timer.minutes(15)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def get_friction_report do
    GenServer.call(__MODULE__, :get_report)
  end

  def scan_now do
    GenServer.call(__MODULE__, :scan_now)
  end

  @impl true
  def init(_opts) do
    schedule_scan()
    {:ok, %{report: empty_report()}}
  end

  @impl true
  def handle_call(:get_report, _from, state) do
    {:reply, state.report, state}
  end

  @impl true
  def handle_call(:scan_now, _from, state) do
    report = run_scan()
    {:reply, report, %{state | report: report}}
  end

  @impl true
  def handle_info(:scan, state) do
    report = run_scan()
    Phoenix.PubSub.broadcast(Ema.PubSub, "quality:friction", {:friction_update, report})
    schedule_scan()
    {:noreply, %{state | report: report}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp schedule_scan do
    Process.send_after(self(), :scan, @scan_interval)
  end

  defp run_scan do
    signals = [
      detect_blocked_tasks(),
      detect_brain_dump_spike(),
      detect_session_interruptions(),
      detect_overdue_accumulation()
    ]

    active_signals = Enum.filter(signals, & &1)
    score = compute_friction_score(active_signals)
    severity = classify_severity(score)

    %{
      friction_score: score,
      severity: severity,
      signals: active_signals,
      scanned_at: DateTime.utc_now()
    }
  end

  defp detect_blocked_tasks do
    try do
      count =
        from(t in "tasks", where: t.status == "blocked", select: count(t.id))
        |> Repo.one()

      if count > 0, do: %{type: :blocked_cluster, count: count, weight: 0.3}, else: nil
    rescue
      _ -> nil
    end
  end

  defp detect_brain_dump_spike do
    try do
      one_hour_ago = DateTime.add(DateTime.utc_now(), -3600, :second)

      count =
        from(b in "brain_dump_items",
          where: b.inserted_at >= ^one_hour_ago,
          select: count(b.id)
        )
        |> Repo.one()

      if count > 10, do: %{type: :brain_dump_spike, count: count, weight: 0.2}, else: nil
    rescue
      _ -> nil
    end
  end

  defp detect_session_interruptions do
    try do
      today = Date.utc_today()

      count =
        from(s in "claude_sessions",
          where: fragment("date(?) = ?", s.inserted_at, ^today),
          select: count(s.id)
        )
        |> Repo.one()

      if count > 5, do: %{type: :session_interruptions, count: count, weight: 0.2}, else: nil
    rescue
      _ -> nil
    end
  end

  defp detect_overdue_accumulation do
    try do
      today = Date.utc_today()

      count =
        from(t in "tasks",
          where: not is_nil(t.due_date) and t.due_date < ^today and t.status != "done",
          select: count(t.id)
        )
        |> Repo.one()

      if count > 3, do: %{type: :overdue_accumulation, count: count, weight: 0.3}, else: nil
    rescue
      _ -> nil
    end
  end

  defp compute_friction_score(signals) do
    if signals == [] do
      0.0
    else
      total_weight = Enum.reduce(signals, 0.0, fn s, acc -> acc + s.weight end)
      Float.round(min(total_weight, 1.0), 2)
    end
  end

  defp classify_severity(score) when score < 0.3, do: :low
  defp classify_severity(score) when score < 0.6, do: :medium
  defp classify_severity(_score), do: :high

  defp empty_report do
    %{friction_score: 0.0, severity: :low, signals: [], scanned_at: nil}
  end
end
