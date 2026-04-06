defmodule Ema.Babysitter.StreamChannels do
  @moduledoc """
  Stream-of-consciousness channel drivers.

  Each channel in the 🧵 STREAM OF CONSCIOUSNESS Discord category gets its own
  focused ticker that queries exactly the data relevant to that stream.

  The authoritative stream/channel mapping lives in
  `Ema.Babysitter.ChannelTopology`.

  This worker only schedules the secondary active streams. The primary
  `:live` stream stays in `Ema.Babysitter.StreamTicker`, and dormant streams
  remain registered for delivery without being auto-scheduled.
  """

  use GenServer
  require Logger
  import Ecto.Query
  alias Ema.Babysitter.{ChannelTopology, TickPolicy}
  alias Ema.Intelligence.VmMonitor

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def status, do: GenServer.call(__MODULE__, :status)

  # --- GenServer ---

  @impl true
  def init(_opts) do
    now = DateTime.utc_now()
    streams = build_stream_state(now)
    # Subscribe to SessionObserver snapshots
    Phoenix.PubSub.subscribe(Ema.PubSub, "babysitter:sessions")
    {:ok, %{streams: schedule_all(streams), started_at: now, session_snapshot: nil}}
  end

  @impl true
  def handle_call(:status, _from, state) do
    streams =
      state.streams
      |> Enum.sort_by(fn {stream, _} -> stream end)
      |> Enum.map(fn {stream, stream_state} ->
        topology = ChannelTopology.stream!(stream)

        %{
          stream: Atom.to_string(stream),
          channel_id: topology.channel_id,
          channel_name: topology.channel_name,
          status: Atom.to_string(topology.status),
          runtime: TickPolicy.describe(stream_state.runtime),
          last_tick_at: DateTime.to_iso8601(stream_state.last_tick_at),
          tick_count: stream_state.tick_count
        }
      end)

    {:reply, streams, state}
  end

  @impl true
  def handle_info(%{event: :session_snapshot} = snapshot, state) do
    {:noreply, %{state | session_snapshot: snapshot}}
  end

  @impl true
  def handle_info({:tick, stream}, state) do
    case Map.fetch(state.streams, stream) do
      {:ok, stream_state} ->
        n = stream_state.tick_count + 1
        safe_tick(stream, n, state.started_at, state.session_snapshot)

        runtime =
          stream
          |> stream_signals(stream_state.last_tick_at)
          |> then(&TickPolicy.advance(stream_state.runtime, &1))

        updated_stream =
          stream_state
          |> Map.put(:runtime, runtime)
          |> Map.put(:last_tick_at, DateTime.utc_now())
          |> Map.put(:tick_count, n)
          |> schedule_stream(stream)

        {:noreply, %{state | streams: Map.put(state.streams, stream, updated_stream)}}

      :error ->
        {:noreply, state}
    end
  end

  # --- Dispatch ---

  defp safe_tick(stream, n, started_at, session_snapshot) do
    try do
      message = build_message(stream, n, started_at, session_snapshot)
      if message, do: post(channel_id(stream), message)
    rescue
      e -> Logger.warning("[StreamChannels:#{stream}] tick failed: #{inspect(e)}")
    end
  end

  # --- Per-stream message builders ---


  defp build_message(:heartbeat, n, _started, _snap) do
    now = ts()
    heartbeat = VmMonitor.heartbeat_snapshot()
    mem = safe_int(fn -> :erlang.memory(:total) |> div(1_048_576) end)
    procs = safe_int(fn -> :erlang.system_info(:process_count) end)
    {uptime_ms, _} = :erlang.statistics(:wall_clock)
    uptime = format_uptime(div(uptime_ms, 1000))

    db_pool = safe_str(fn ->
      pool = Ema.Repo.checkout(fn -> "ok" end)
      if pool == "ok", do: "✅ pool healthy", else: "⚠️ pool issue"
    end, "? pool")

    task_q = safe_int(fn -> Ema.Repo.aggregate(
      from(t in Ema.Tasks.Task, where: t.status in ["proposed", "in_progress"]), :count) end)
    proposal_q = safe_int(fn -> Ema.Repo.aggregate(
      from(p in Ema.Proposals.Proposal, where: p.status == "queued"), :count) end)

    note_line =
      heartbeat.notes
      |> List.first()
      |> case do
        nil -> nil
        note -> "Watch: #{note}"
      end

    lines =
      [
        "💓 **heartbeat ##{n}** · #{now}",
        "#{heartbeat_emoji(heartbeat.heartbeat_state)} #{heartbeat.narrative}",
        "VM: **#{heartbeat.status}** / `#{heartbeat.heartbeat_state}` · trend `#{heartbeat.trend}` · latency #{fmt_ms(heartbeat.latency_ms)}",
        "BEAM: **#{mem} MB** · #{procs} processes · uptime #{uptime}",
        "Flow: **#{task_q}** active tasks · **#{proposal_q}** queued proposals · #{db_pool}",
        note_line,
        "-# babysitter window #{heartbeat.sample_count} checks · recent #{Enum.join(heartbeat.recent_statuses, " → ")}"
      ]
      |> Enum.reject(&is_nil/1)

    Enum.join(lines, "\n")
  end

  defp build_message(:intent, n, _started, _snap) do
    now = ts()
    recent_intents = safe_list(fn ->
      Ema.Repo.all(
        from i in Ema.Superman.Intent,
          order_by: [desc: i.inserted_at],
          limit: 8,
          select: {i.title, i.kind, i.status, i.inserted_at}
      )
    end)

    routing = safe_str(fn ->
      arms = Ema.Intelligence.UCBRouter.arm_stats()
      arms |> Enum.map(fn {arm, %{score: s, pulls: p}} ->
        "  └ `#{arm}` score #{Float.round(s, 3)} (#{p} pulls)"
      end) |> Enum.join("\n")
    end, "  └ UCB router: no data yet")

    intent_lines = recent_intents |> Enum.map(fn {title, kind, status, at} ->
      ago = ago(at)
      "  └ #{status_dot(status)} **#{truncate(title, 40)}** `#{kind || "?"}` · #{ago}"
    end) |> Enum.join("\n")

    """
    🎯 **intent stream ##{n}** · #{now}
    **Recent intents** (#{length(recent_intents)})
    #{intent_lines}
    **UCB Router arms**
    #{routing}
    -# Superman intent engine · speculative routing weights
    """
  end

  defp build_message(:pipeline, n, _started, _snap) do
    now = ts()
    stages = safe_list(fn ->
      Ema.Repo.all(
        from p in Ema.Proposals.Proposal,
          group_by: p.pipeline_stage,
          order_by: [asc: p.pipeline_stage],
          select: {p.pipeline_stage, count(p.id)}
      )
    end)

    recent = safe_list(fn ->
      Ema.Repo.all(
        from p in Ema.Proposals.Proposal,
          order_by: [desc: p.updated_at],
          limit: 6,
          select: {p.title, p.pipeline_stage, p.status, p.updated_at}
      )
    end)

    pipe_runs = safe_list(fn ->
      Ema.Repo.all(
        from r in Ema.Pipes.PipeRun,
          order_by: [desc: r.inserted_at],
          limit: 5,
          select: {r.id, r.status, r.inserted_at}
      )
    end)

    stage_bar = stages |> Enum.map(fn {s, n} ->
      "#{s || "?"}: **#{n}**"
    end) |> Enum.join(" → ")

    recent_lines = recent |> Enum.map(fn {title, stage, status, at} ->
      "  └ #{status_dot(status)} #{truncate(title, 42)} [#{stage || status}] · #{ago(at)}"
    end) |> Enum.join("\n")

    pipe_lines = if pipe_runs == [] do
      "  └ no recent pipe runs"
    else
      pipe_runs |> Enum.map(fn {id, status, at} ->
        "  └ #{status_dot(status)} `#{truncate(id, 16)}` #{status} · #{ago(at)}"
      end) |> Enum.join("\n")
    end

    """
    ⚙️ **pipeline flow ##{n}** · #{now}
    **Pipeline stages:** #{stage_bar}
    **Recent proposals**
    #{recent_lines}
    **Pipe runs**
    #{pipe_lines}
    -# Proposal → deliberation → approval → execution
    """
  end

  defp build_message(:agent, n, _started, session_snapshot) do
    now = ts()
    total = safe_int(fn -> Ema.Repo.aggregate(Ema.ClaudeSessions.ClaudeSession, :count) end)

    # Use live session file data if available from SessionObserver
    {live_sessions, stalled, just_completed} =
      case session_snapshot do
        %{sessions: s, stalled: st, just_completed: jc} -> {s, st, jc}
        nil ->
          try do
            snap = Ema.Babysitter.SessionObserver.snapshot()
            {snap[:sessions] || [], snap[:stalled] || [], snap[:just_completed] || []}
          rescue _ -> {[], [], []} end
      end

    active_live = live_sessions |> Enum.filter(&(&1.status == :active))
    active_count = length(active_live)

    session_lines = if active_live == [] do
      "  └ no active sessions"
    else
      active_live |> Enum.map(fn s ->
        proj = (s.project_path || "?") |> String.split("/") |> Enum.take(-2) |> Enum.join("/") |> truncate(30)
        tool = if s.last_tool, do: " · ", else: ""
        text = if s.last_text, do: "
    _#{truncate(s.last_text, 70)}_", else: ""
        "  └ 🤖 #{tool}#{text}"
      end) |> Enum.join("
")
    end

    stall_line = if stalled != [] do
      names = stalled |> Enum.map(&((&1.project_path || "?") |> String.split("/") |> List.last())) |> Enum.join(", ")
      "
⚠️ **stalled >5m:** #{names}"
    else "" end

    done_line = if just_completed != [] do
      names = just_completed |> Enum.map(&((&1.project_path || "?") |> String.split("/") |> List.last())) |> Enum.join(", ")
      "
✅ **just completed:** #{names}"
    else "" end

    """
    🤖 **agent thoughts ##{n}** · #{now}
    **#{active_count} active live** / #{total} total sessions#{stall_line}#{done_line}
    #{session_lines}
    -# Live .jsonl file scan · tool calls · assistant text
    """
  end
  defp build_message(:intelligence, n, _started, _snap) do
    now = ts()

    ucb = safe_str(fn ->
      arms = Ema.Intelligence.UCBRouter.arm_stats()
      arms |> Enum.sort_by(fn {_, %{score: s}} -> -s end) |> Enum.take(5)
      |> Enum.map(fn {arm, %{score: s, pulls: p, wins: w}} ->
        pct = if p > 0, do: Float.round(w / p * 100, 1), else: 0.0
        "  └ `#{arm}` #{Float.round(s, 4)} score · #{p} pulls · #{pct}% win"
      end) |> Enum.join("\n")
    end, "  └ UCB router: no data")

    bandit = safe_str(fn ->
      variants = Ema.Intelligence.PromptVariantStore.top_variants(5)
      variants |> Enum.map(fn v ->
        "  └ `#{truncate(v.variant_id, 20)}` ε=#{v.epsilon} · #{v.uses} uses · #{Float.round(v.score, 3)} score"
      end) |> Enum.join("\n")
    end, "  └ prompt bandit: no variants yet")

    # Scope advisor recent verdicts
    scope = safe_str(fn ->
      recent = Ema.Repo.all(
        from t in Ema.Tasks.Task,
          where: not is_nil(t.metadata),
          order_by: [desc: t.updated_at],
          limit: 4,
          select: {t.title, t.metadata}
      )
      recent |> Enum.filter(fn {_, m} -> Map.has_key?(m || %{}, "scope_verdict") end)
      |> Enum.map(fn {title, m} -> "  └ #{truncate(title, 35)} → #{m["scope_verdict"]}" end)
      |> Enum.join("\n")
    end, "  └ scope advisor: no verdicts yet")

    """
    🧠 **intelligence layer ##{n}** · #{now}
    **UCB Router** (model routing arms)
    #{ucb}
    **Prompt Bandit** (ε-greedy variant scores)
    #{bandit}
    **Scope Advisor** (recent verdicts)
    #{scope}
    -# Speculative: routing weights · bandit scores · scope checks
    """
  end

  defp build_message(:memory, n, _started, _snap) do
    now = ts()

    # Second brain recent writes
    brain_pages = safe_list(fn ->
      Ema.Repo.all(
        from e in Ema.SecondBrain.Entry,
          order_by: [desc: e.updated_at],
          limit: 8,
          select: {e.title, e.source, e.updated_at}
      )
    end)

    brain_dumps = safe_int(fn ->
      Ema.Repo.aggregate(Ema.BrainDump.BrainDump, :count)
    end)

    index_size = safe_int(fn ->
      Ema.Repo.aggregate(Ema.SecondBrain.Entry, :count)
    end)

    page_lines = if brain_pages == [] do
      "  └ no entries yet"
    else
      brain_pages |> Enum.map(fn {title, source, at} ->
        "  └ 📄 **#{truncate(title, 40)}** `#{source || "?"}` · #{ago(at)}"
      end) |> Enum.join("\n")
    end

    """
    📝 **memory writes ##{n}** · #{now}
    **Second Brain:** #{index_size} entries indexed · #{brain_dumps} brain dumps
    **Recent writes**
    #{page_lines}
    -# Second Brain activity · FTS index · vault harvester
    """
  end

  defp build_message(:execution, n, _started, _snap) do
    now = ts()

    active_tasks = safe_list(fn ->
      Ema.Repo.all(
        from t in Ema.Tasks.Task,
          where: t.status in ["in_progress", "active"],
          order_by: [desc: t.updated_at],
          limit: 8,
          select: {t.title, t.status, t.updated_at}
      )
    end)

    recent_done = safe_list(fn ->
      cutoff = DateTime.add(DateTime.utc_now(), -900, :second)
      Ema.Repo.all(
        from t in Ema.Tasks.Task,
          where: t.status == "done" and t.updated_at >= ^cutoff,
          order_by: [desc: t.updated_at],
          limit: 5,
          select: {t.title, t.updated_at}
      )
    end)

    active_lines = if active_tasks == [] do
      "  └ nothing running"
    else
      active_tasks |> Enum.map(fn {title, status, at} ->
        "  └ #{status_dot(status)} **#{truncate(title, 45)}** · #{ago(at)}"
      end) |> Enum.join("\n")
    end

    done_lines = if recent_done == [] do
      "  └ nothing completed in last 15m"
    else
      recent_done |> Enum.map(fn {title, at} ->
        "  └ ✅ #{truncate(title, 45)} · #{ago(at)}"
      end) |> Enum.join("\n")
    end

    """
    🏃 **execution log ##{n}** · #{now}
    **Active** (#{length(active_tasks)})
    #{active_lines}
    **Completed (last 15m)**
    #{done_lines}
    -# Task dispatch · pipe runs · ProjectWorker
    """
  end

  defp build_message(:evolution, n, _started, _snap) do
    now = ts()

    # Evolution signals from vault
    signals_path = Path.expand("~/vault/System/Evolution Signals.md")
    signals_preview = safe_str(fn ->
      if File.exists?(signals_path) do
        File.read!(signals_path) |> String.split("\n") |> Enum.take(8) |> Enum.join("\n")
      else
        "no signals file yet"
      end
    end, "vault not accessible")

    # Usage harvester outcomes
    recent_proposals = safe_list(fn ->
      Ema.Repo.all(
        from p in Ema.Proposals.Proposal,
          where: p.status == "queued" and p.inserted_at >= ^DateTime.add(DateTime.utc_now(), -86400, :second),
          order_by: [desc: p.inserted_at],
          limit: 5,
          select: {p.title, p.inserted_at}
      )
    end)

    signal_lines = recent_proposals |> Enum.map(fn {title, at} ->
      "  └ 🧬 #{truncate(title, 50)} · #{ago(at)}"
    end) |> Enum.join("\n")

    """
    🧬 **evolution signals ##{n}** · #{now}
    **Harvester proposals (last 24h):** #{length(recent_proposals)}
    #{if signal_lines == "", do: "  └ no new signals", else: signal_lines}
    **Vault signals preview**
    ```
    #{truncate(signals_preview, 300)}
    ```
    -# Self-improvement loop · reflexion feedback · usage harvester
    """
  end

  defp build_message(:speculative, n, _started, _snap) do
    now = ts()

    # Simulate what the full system would show if all modules were live
    # Uses real data where available, synthetic narrative for unbuilt modules

    voice_status = "🎙️ VoiceCore: **offline** (ema-007-voicecore unmerged) — would show: intent confidence, TTS queue, Jarvis mode"
    metamind_status = "🔮 MetaMind: **offline** (ema-004-metamind unmerged) — would show: prompt interceptions, peer review queue, library hits"
    channels_status = "📡 Channels v2: **offline** (ema-006-channels-v2 unmerged) — would show: unified inbox depth, sync lag, active integrations"
    evolution_status = "🧬 Evolution Engine: **offline** (ema-005-evolution unmerged) — would show: rule versions, signal scan results, auto-applied patches"
    vector_status = "🔢 Vector Proposals: **offline** (ema-002-vector-proposals unmerged) — would show: embedding similarity scores, semantic clustering"
    bridge_status = "🌉 Claude Bridge: **online** (ema-001 merged) — Port subprocess sessions, multi-turn context, streaming"

    # What IS live
    live_count = safe_int(fn ->
      [Ema.Claude.SessionManager, Ema.Pipes.Supervisor, Ema.SecondBrain.Indexer,
       Ema.Babysitter.Supervisor, Ema.Intelligence.UCBRouter]
      |> Enum.count(fn mod ->
        pid = Process.whereis(mod)
        pid != nil && Process.alive?(pid)
      end)
    end, 0)

    """
    🔮 **speculative parity ##{n}** · #{now}
    **Live modules:** #{live_count}/7 core OTP trees running
    ─────────────────────────────
    #{bridge_status}
    #{voice_status}
    #{metamind_status}
    #{channels_status}
    #{evolution_status}
    #{vector_status}
    ─────────────────────────────
    _Speculative feed shows what full EMA parity looks like. Each "offline" module has a branch ready to merge._
    -# ema-001 through ema-007 · merge decision pending
    """
  end

  # --- Helpers ---

  defp ts, do: Calendar.strftime(DateTime.utc_now(), "%H:%M:%S UTC")

  defp ago(nil), do: "?"
  defp ago(%DateTime{} = dt) do
    diff = DateTime.diff(DateTime.utc_now(), dt, :second)
    cond do
      diff < 60 -> "#{diff}s ago"
      diff < 3600 -> "#{div(diff, 60)}m ago"
      true -> "#{div(diff, 3600)}h #{rem(div(diff, 60), 60)}m ago"
    end
  end
  defp ago(_), do: "?"

  defp fmt_tokens(nil), do: "0"
  defp fmt_tokens(n) when n >= 1000, do: "#{Float.round(n / 1000, 1)}k"
  defp fmt_tokens(n), do: "#{n}"

  defp fmt_ms(nil), do: "?"
  defp fmt_ms(n), do: "#{n}ms"

  defp format_uptime(s) when s < 60, do: "#{s}s"
  defp format_uptime(s) when s < 3600, do: "#{div(s, 60)}m #{rem(s, 60)}s"
  defp format_uptime(s), do: "#{div(s, 3600)}h #{rem(div(s, 60), 60)}m"

  defp truncate(nil, _), do: ""
  defp truncate(s, max) when byte_size(s) <= max, do: s
  defp truncate(s, max), do: String.slice(s, 0, max - 1) <> "…"

  defp status_dot("done"), do: "✅"
  defp status_dot("active"), do: "🔄"
  defp status_dot("in_progress"), do: "⚡"
  defp status_dot("proposed"), do: "💭"
  defp status_dot("queued"), do: "📥"
  defp status_dot("approved"), do: "✓"
  defp status_dot("blocked"), do: "🚫"
  defp status_dot(_), do: "·"

  defp heartbeat_emoji("healthy"), do: "🟢"
  defp heartbeat_emoji("warming"), do: "🟡"
  defp heartbeat_emoji("backing_up"), do: "🟠"
  defp heartbeat_emoji("recovering"), do: "🔵"
  defp heartbeat_emoji("degraded"), do: "🔴"
  defp heartbeat_emoji(_), do: "⚪"

  defp safe_int(fun, default \\ 0) do
    try do fun.() rescue _ -> default end
  end

  defp safe_str(fun, default \\ "") do
    try do
      result = fun.()
      if result in [nil, "", []], do: default, else: result
    rescue _ -> default end
  end

  defp safe_list(fun) do
    try do fun.() rescue _ -> [] end
  end

  defp post(channel_id, message) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "discord:outbound:#{channel_id}", {:post, String.trim(message)})
  end

  defp build_stream_state(now) do
    ChannelTopology.secondary_scheduled_streams()
    |> Enum.reduce(%{}, fn topology, acc ->
      Map.put(acc, topology.stream, %{
        timer: nil,
        runtime: TickPolicy.runtime(topology.stream),
        last_tick_at: now,
        tick_count: 0
      })
    end)
  end

  defp schedule_all(streams) do
    Enum.into(streams, %{}, fn {stream, stream_state} ->
      {stream, schedule_stream(stream_state, stream, true)}
    end)
  end

  defp schedule_stream(stream_state, stream, initial \\ false) do
    if stream_state.timer, do: Process.cancel_timer(stream_state.timer)
    jitter = if initial, do: :rand.uniform(5_000), else: 0
    delay = stream_state.runtime.current_ms + jitter
    timer = Process.send_after(self(), {:tick, stream}, delay)
    %{stream_state | timer: timer}
  end

  defp stream_signals(stream, last_tick_at) do
    events =
      last_tick_at
      |> Ema.Babysitter.VisibilityHub.events_since()
      |> filter_stream_events(stream)

    %{
      event_count: length(events),
      recent_event_count: length(events),
      active_sessions: active_session_count(stream),
      pending_tasks: pending_task_count(stream)
    }
  end

  defp filter_stream_events(events, stream) do
    case TickPolicy.activity_categories(stream) do
      :all -> events
      categories -> Enum.filter(events, &(&1.category in categories))
    end
  end

  defp active_session_count(stream) when stream in [:live, :heartbeat, :agent, :execution, :speculative] do
    safe_int(fn ->
      Ema.Repo.aggregate(from(s in Ema.ClaudeSessions.ClaudeSession, where: s.status == "active"), :count)
    end)
  end

  defp active_session_count(_stream), do: 0

  defp pending_task_count(stream) when stream in [:live, :heartbeat, :pipeline, :execution, :speculative] do
    safe_int(fn ->
      Ema.Repo.aggregate(
        from(t in Ema.Tasks.Task, where: t.status in ["proposed", "in_progress", "active", "blocked"]),
        :count
      )
    end)
  end

  defp pending_task_count(_stream), do: 0

  defp channel_id(stream) do
    ChannelTopology.stream_channel_id(stream)
  end
end
