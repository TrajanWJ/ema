defmodule Ema.Intelligence.VmMonitorTest do
  use ExUnit.Case, async: true

  alias Ema.Intelligence.VmMonitor

  test "classifies a clean window as healthy" do
    history =
      for seconds <- 6..1//-1 do
        snapshot("online", latency_ms: 18 + seconds, checked_at: seconds_ago(seconds))
      end

    heartbeat = VmMonitor.derive_heartbeat(history)

    assert heartbeat.heartbeat_state == "healthy"
    assert heartbeat.trend == "steady"
    assert heartbeat.sample_count == 6
    assert heartbeat.consecutive_good == 6
    assert heartbeat.consecutive_bad == 0
    assert heartbeat.narrative =~ "looks steady"
  end

  test "marks healthy service after recent misses as recovering" do
    history = [
      snapshot("degraded", openclaw_up: false, latency_ms: 120, checked_at: seconds_ago(6)),
      snapshot("offline",
        openclaw_up: false,
        ssh_up: false,
        latency_ms: 140,
        checked_at: seconds_ago(5)
      ),
      snapshot("degraded", openclaw_up: false, latency_ms: 110, checked_at: seconds_ago(4)),
      snapshot("online", latency_ms: 35, checked_at: seconds_ago(3)),
      snapshot("online", latency_ms: 28, checked_at: seconds_ago(2)),
      snapshot("online", latency_ms: 24, checked_at: seconds_ago(1))
    ]

    heartbeat = VmMonitor.derive_heartbeat(history)

    assert heartbeat.heartbeat_state == "recovering"
    assert heartbeat.trend == "improving"
    assert heartbeat.consecutive_good == 3
    assert Enum.any?(heartbeat.notes, &String.contains?(&1, "held healthy"))
  end

  test "marks repeated degraded checks as backing up" do
    history = [
      snapshot("online", latency_ms: 24, checked_at: seconds_ago(5)),
      snapshot("degraded", openclaw_up: true, latency_ms: 80, checked_at: seconds_ago(4)),
      snapshot("degraded", openclaw_up: true, latency_ms: 95, checked_at: seconds_ago(3)),
      snapshot("degraded", openclaw_up: true, latency_ms: 110, checked_at: seconds_ago(2)),
      snapshot("degraded", openclaw_up: true, latency_ms: 125, checked_at: seconds_ago(1))
    ]

    heartbeat = VmMonitor.derive_heartbeat(history)

    assert heartbeat.heartbeat_state == "backing_up"
    assert heartbeat.trend == "worsening"
    assert heartbeat.consecutive_bad == 4
    assert heartbeat.narrative =~ "pressure is building"
  end

  defp snapshot(status, opts) do
    %{
      status: status,
      openclaw_up: Keyword.get(opts, :openclaw_up, true),
      ssh_up: Keyword.get(opts, :ssh_up, true),
      containers_json: "[]",
      latency_ms: Keyword.get(opts, :latency_ms, 25),
      checked_at: Keyword.fetch!(opts, :checked_at)
    }
  end

  defp seconds_ago(seconds) do
    DateTime.utc_now()
    |> DateTime.add(-seconds, :second)
    |> DateTime.truncate(:second)
  end
end
