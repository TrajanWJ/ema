defmodule Ema.Intelligence.VmMonitor do
  @moduledoc """
  GenServer that polls local tool availability every 30s.
  Checks that the `claude` CLI is reachable and the daemon itself is healthy.
  Broadcasts health status via PubSub (same topics/formats as before).
  """

  use GenServer
  require Logger

  import Ecto.Query

  alias Ema.Repo
  alias Ema.Intelligence.VmHealthEvent

  @poll_interval :timer.seconds(30)
  @history_limit 12

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Get the latest health snapshot."
  def current_health do
    VmHealthEvent
    |> order_by([e], desc: e.checked_at)
    |> limit(1)
    |> Repo.one()
  end

  @doc "Get recent health events."
  def recent_events(limit \\ 50) do
    VmHealthEvent
    |> order_by([e], desc: e.checked_at)
    |> limit(^limit)
    |> Repo.all()
  end

  @doc "Get the latest derived heartbeat snapshot from the rolling in-memory window."
  def heartbeat_snapshot do
    if Process.whereis(__MODULE__) do
      GenServer.call(__MODULE__, :heartbeat_snapshot)
    else
      load_recent_history() |> derive_heartbeat()
    end
  end

  @doc "Force an immediate health check."
  def check_now do
    GenServer.cast(__MODULE__, :check)
  end

  @doc "Get parsed containers from the latest event."
  def containers do
    heartbeat_snapshot().containers
  end

  # --- Callbacks ---

  @impl true
  def init(_opts) do
    history = load_recent_history()
    heartbeat = derive_heartbeat(history)
    schedule_poll()
    {:ok, %{last_status: heartbeat.status, history: history, heartbeat: heartbeat}}
  end

  @impl true
  def handle_info(:poll, state) do
    state = do_check(state)
    schedule_poll()
    {:noreply, state}
  end

  @impl true
  def handle_cast(:check, state) do
    {:noreply, do_check(state)}
  end

  @impl true
  def handle_call(:heartbeat_snapshot, _from, state) do
    {:reply, state.heartbeat, state}
  end

  # --- Internal ---

  @doc false
  def derive_heartbeat(history) when is_list(history) do
    history = Enum.take(history, -@history_limit)
    current = List.last(history) || default_raw_snapshot()
    recent = Enum.take(history, -6)
    previous = history |> Enum.drop(-3) |> Enum.take(-3)

    recent_bad = Enum.count(recent, &unhealthy?/1)
    recent_good = Enum.count(recent, &healthy?/1)
    consecutive_bad = trailing_count(history, &unhealthy?/1)
    consecutive_good = trailing_count(history, &healthy?/1)
    current_healthy = healthy?(current)
    flapping = flapping?(recent)
    baseline_latency = avg_latency(previous)
    recent_latency = avg_latency(recent)
    latency_delta = recent_latency - baseline_latency
    latency_ratio = growth_ratio(baseline_latency, recent_latency)

    trend =
      cond do
        flapping and consecutive_good < 2 -> "flapping"
        current_healthy and recent_bad > 0 and consecutive_good >= 2 -> "improving"
        unhealthy?(current) and recent_good > 0 -> "worsening"
        current_healthy and latency_ratio >= 1.25 -> "warming"
        flapping -> "flapping"
        true -> "steady"
      end

    heartbeat_state =
      cond do
        current_healthy and recent_bad == 0 and latency_ratio < 1.25 -> "healthy"
        current_healthy and recent_bad > 0 -> "recovering"
        current_healthy and latency_ratio >= 1.25 -> "warming"
        current.status == "degraded" and consecutive_bad >= 2 -> "backing_up"
        current.status in ["degraded", "offline"] -> "degraded"
        true -> "degraded"
      end

    notes =
      build_notes(history, current,
        recent_bad: recent_bad,
        consecutive_bad: consecutive_bad,
        consecutive_good: consecutive_good,
        flapping: flapping,
        baseline_latency: baseline_latency,
        recent_latency: recent_latency,
        latency_delta: latency_delta,
        latency_ratio: latency_ratio
      )

    %{
      status: current.status,
      openclaw_up: current.openclaw_up,
      ssh_up: current.ssh_up,
      latency_ms: current.latency_ms,
      checked_at: current.checked_at,
      containers: parse_containers(current.containers_json),
      heartbeat_state: heartbeat_state,
      trend: trend,
      narrative:
        build_narrative(heartbeat_state, current, recent_bad, consecutive_bad, latency_ratio),
      notes: notes,
      sample_count: length(history),
      recent_statuses: Enum.map(recent, & &1.status),
      healthy_ratio: ratio(recent_good, max(length(recent), 1)),
      consecutive_good: consecutive_good,
      consecutive_bad: consecutive_bad,
      latency_baseline_ms: round_or_nil(baseline_latency),
      latency_recent_avg_ms: round_or_nil(recent_latency),
      latency_delta_ms: round_or_nil(latency_delta),
      flapping: flapping
    }
  end

  defp schedule_poll do
    Process.send_after(self(), :poll, @poll_interval)
  end

  defp do_check(state) do
    raw_snapshot = collect_snapshot()
    history = append_history(state.history, raw_snapshot)
    heartbeat = derive_heartbeat(history)

    attrs = %{
      id: Ecto.UUID.generate(),
      status: raw_snapshot.status,
      openclaw_up: raw_snapshot.openclaw_up,
      ssh_up: raw_snapshot.ssh_up,
      containers_json: raw_snapshot.containers_json,
      latency_ms: raw_snapshot.latency_ms,
      checked_at: raw_snapshot.checked_at
    }

    case %VmHealthEvent{} |> VmHealthEvent.changeset(attrs) |> Repo.insert() do
      {:ok, event} ->
        heartbeat = %{heartbeat | checked_at: event.checked_at}
        history = replace_latest_checked_at(history, event.checked_at)

        if raw_snapshot.status != state.last_status do
          broadcast(:vm_status_changed, %{
            status: raw_snapshot.status,
            previous: state.last_status
          })
        end

        broadcast(:vm_health_checked, heartbeat)

        %{state | last_status: raw_snapshot.status, history: history, heartbeat: heartbeat}

      {:error, reason} ->
        Logger.warning("VmMonitor: failed to store health event: #{inspect(reason)}")

        %{state | last_status: raw_snapshot.status, history: history, heartbeat: heartbeat}
    end
  end

  defp collect_snapshot do
    start = System.monotonic_time(:millisecond)

    claude_available = check_claude_cli()
    daemon_healthy = check_daemon_health()
    total_latency = System.monotonic_time(:millisecond) - start

    status =
      cond do
        claude_available and daemon_healthy -> "online"
        daemon_healthy -> "degraded"
        true -> "offline"
      end

    %{
      status: status,
      openclaw_up: claude_available,
      ssh_up: true,
      containers_json: "[]",
      latency_ms: round(total_latency),
      checked_at: DateTime.utc_now() |> DateTime.truncate(:second)
    }
  end

  defp load_recent_history do
    recent_events(@history_limit)
    |> Enum.reverse()
    |> Enum.map(&raw_snapshot_from_event/1)
  rescue
    _ -> []
  end

  defp raw_snapshot_from_event(event) do
    %{
      status: event.status || "unknown",
      openclaw_up: !!event.openclaw_up,
      ssh_up: !!event.ssh_up,
      containers_json: event.containers_json || "[]",
      latency_ms: event.latency_ms,
      checked_at: event.checked_at
    }
  end

  defp default_raw_snapshot do
    %{
      status: "unknown",
      openclaw_up: false,
      ssh_up: false,
      containers_json: "[]",
      latency_ms: nil,
      checked_at: nil
    }
  end

  defp append_history(history, snapshot) do
    history
    |> Kernel.++([snapshot])
    |> Enum.take(-@history_limit)
  end

  defp replace_latest_checked_at([], _checked_at), do: []

  defp replace_latest_checked_at(history, checked_at) do
    List.replace_at(history, -1, %{List.last(history) | checked_at: checked_at})
  end

  defp check_claude_cli do
    System.find_executable("claude") != nil
  end

  defp check_daemon_health do
    # Self-check: verify the Ecto repo and PubSub are alive
    is_pid(Process.whereis(Ema.Repo)) and is_pid(Process.whereis(Ema.PubSub))
  end

  defp parse_containers(json_str) do
    case Jason.decode(json_str || "[]") do
      {:ok, list} when is_list(list) -> list
      _ -> []
    end
  end

  defp healthy?(snapshot) do
    snapshot.status == "online" and snapshot.openclaw_up and snapshot.ssh_up
  end

  defp unhealthy?(snapshot) do
    not healthy?(snapshot)
  end

  defp trailing_count(history, predicate) do
    history
    |> Enum.reverse()
    |> Enum.take_while(predicate)
    |> length()
  end

  defp flapping?(history) do
    history
    |> Enum.map(& &1.status)
    |> Enum.chunk_every(2, 1, :discard)
    |> Enum.count(fn [left, right] -> left != right end)
    |> Kernel.>=(3)
  end

  defp avg_latency(history) do
    latencies =
      history
      |> Enum.map(& &1.latency_ms)
      |> Enum.filter(&is_integer/1)

    case latencies do
      [] -> 0.0
      _ -> Enum.sum(latencies) / length(latencies)
    end
  end

  defp growth_ratio(previous, recent) when previous == 0.0 and recent == 0.0, do: 1.0
  defp growth_ratio(previous, recent) when previous == 0.0, do: if(recent > 0, do: 2.0, else: 1.0)
  defp growth_ratio(previous, recent), do: recent / previous

  defp build_notes(history, current, opts) do
    recent_bad = Keyword.fetch!(opts, :recent_bad)
    consecutive_bad = Keyword.fetch!(opts, :consecutive_bad)
    consecutive_good = Keyword.fetch!(opts, :consecutive_good)
    flapping = Keyword.fetch!(opts, :flapping)
    baseline_latency = Keyword.fetch!(opts, :baseline_latency)
    recent_latency = Keyword.fetch!(opts, :recent_latency)
    latency_ratio = Keyword.fetch!(opts, :latency_ratio)

    []
    |> maybe_add_note(
      recent_bad >= 3,
      "#{recent_bad} of last #{min(length(history), 6)} checks were degraded or offline"
    )
    |> maybe_add_note(consecutive_bad >= 2, "#{consecutive_bad} unhealthy checks are stacking up")
    |> maybe_add_note(
      consecutive_good >= 2 and recent_bad > 0,
      "service has held healthy for #{consecutive_good} consecutive checks"
    )
    |> maybe_add_note(flapping, "status has been bouncing between states")
    |> maybe_add_note(
      current.status == "online" and latency_ratio >= 1.25,
      "latency drifted from #{round(baseline_latency)}ms to #{round(recent_latency)}ms"
    )
    |> maybe_add_note(not current.openclaw_up, "AI backend is unavailable")
    |> maybe_add_note(not current.ssh_up, "ssh probe is failing")
    |> Enum.take(3)
  end

  defp maybe_add_note(notes, true, note), do: notes ++ [note]
  defp maybe_add_note(notes, false, _note), do: notes

  defp build_narrative(heartbeat_state, current, recent_bad, consecutive_bad, latency_ratio) do
    latency =
      if is_integer(current.latency_ms), do: "#{current.latency_ms}ms", else: "unknown latency"

    case heartbeat_state do
      "healthy" ->
        "holding steady; #{latency} and the last window stayed clean"

      "warming" ->
        "still online, but warming up; #{latency} with a rising latency slope"

      "backing_up" ->
        "pressure is building; #{consecutive_bad} unhealthy checks in a row and babysitter should watch backlog"

      "recovering" ->
        "recovering after recent misses; now at #{latency} with #{recent_bad} rough checks still in the rearview"

      _ ->
        detail =
          cond do
            current.status == "offline" -> "core checks are failing"
            latency_ratio >= 1.5 -> "response time has spiked"
            true -> "core services are degraded"
          end

        "degraded; #{detail}"
    end
  end

  defp ratio(_num, 0), do: 0.0
  defp ratio(num, denom), do: Float.round(num / denom, 2)

  defp round_or_nil(value) when is_number(value), do: round(value)
  defp round_or_nil(_value), do: nil

  defp broadcast(event, payload) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "intelligence:vm", {event, payload})
  end
end
