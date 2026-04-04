defmodule Ema.Babysitter.StreamChannels do
  @moduledoc """
  Stream-of-consciousness channel drivers.

  Each channel in the 🧵 STREAM OF CONSCIOUSNESS Discord category gets its own
  focused ticker that queries exactly the data relevant to that stream.

  Channels:
    - babysitter-live       (1489786483970936933) — handled by StreamTicker (main)
    - system-heartbeat      (1489820670333423827) — BEAM vitals, DB pool, queue depths
    - intent-stream         (1489820673760301156) — Superman intent classifications
    - pipeline-flow         (1489820676859756606) — Proposal→execution state transitions
    - agent-thoughts        (1489820679472677044) — Active Claude sessions narrative
    - intelligence-layer    (1489820682198974525) — UCB router, prompt bandit, scope advisor
    - memory-writes         (1489820685101699193) — Second Brain writes, FTS updates
    - execution-log         (1489820687563493408) — Task dispatch, pipe runs, ProjectWorker
    - evolution-signals     (1489820691074387979) — Self-improvement signals
    - speculative-feed      (1489820693758607370) — Synthetic parity for unbuilt modules
  """

  use GenServer
  require Logger
  import Ecto.Query

  @channels %{
    heartbeat:    "1489820670333423827",
    intent:       "1489820673760301156",
    pipeline:     "1489820676859756606",
    agent:        "1489820679472677044",
    intelligence: "1489820682198974525",
    memory:       "1489820685101699193",
    execution:    "1489820687563493408",
    evolution:    "1489820691074387979",
    speculative:  "1489820693758607370"
  }

  # Each stream has its own interval (ms)
  @intervals %{
    heartbeat:    10_000,   # fast — vitals
    intent:       20_000,   # medium — intent classifications
    pipeline:     15_000,   # medium — proposal flow
    agent:        15_000,   # medium — session state
    intelligence: 30_000,   # slower — routing weights don't change fast
    memory:       30_000,   # slower — write events
    execution:    15_000,   # medium — task dispatch
    evolution:    60_000,   # slow — evolution signals
    speculative:  45_000    # slow — synthetic parity
  }

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  # --- GenServer ---

  @impl true
  def init(_opts) do
    timers = schedule_all()
    {:ok, %{timers: timers, tick_counts: %{}, started_at: DateTime.utc_now()}}
  end

  @impl true
  def handle_info({:tick, stream}, state) do
    n = Map.get(state.tick_counts, stream, 0) + 1
    safe_tick(stream, n, state.started_at)

    interval = Map.get(@intervals, stream, 30_000)
    timer = Process.send_after(self(), {:tick, stream}, interval)
    new_timers = Map.put(state.timers, stream, timer)
    new_counts = Map.put(state.tick_counts, stream, n)

    {:noreply, %{state | timers: new_timers, tick_counts: new_counts}}
  end

  # --- Dispatch ---

  defp safe_tick(stream, n, started_at) do
    try do
      message = build_message(stream, n, started_at)
      if message, do: post(@channels[stream], message)
    rescue
      e -> Logger.warning("[StreamChannels:#{stream}] tick failed: #{inspect(e)}")
    end
  end

  # --- Per-stream message builders ---

  defp build_message(:heartbeat, n, _started) do
    now = ts()
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

    """
    💓 **heartbeat ##{n}** · #{now}
    BEAM: **#{mem} MB** · #{procs} processes · uptime #{uptime}
    DB: #{db_pool}
    Queue depths: **#{task_q}** tasks pending · **#{proposal_q}** proposals queued
    -# EMA daemon vitals
    """
  end

  defp build_message(:intent, n, _started) do
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

  defp build_message(:pipeline, n, _started) do
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

  defp build_message(:agent, n, _started) do
    now = ts()
    active = safe_list(fn ->
      Ema.Repo.all(
        from s in Ema.ClaudeSessions.ClaudeSession,
          where: s.status == "active",
          order_by: [desc: s.last_active],
          limit: 8,
          select: {s.session_id, s.project_path, s.last_active, s.token_count, s.tool_calls, s.summary}
      )
    end)

    total = safe_int(fn -> Ema.Repo.aggregate(Ema.ClaudeSessions.ClaudeSession, :count) end)
    active_count = length(active)

    session_lines = if active == [] do
      "  └ no active sessions"
    else
      active |> Enum.map(fn {_id, path, last_at, tokens, tools, summary} ->
        proj = path |> String.split("/") |> List.last() |> truncate(25)
        tok = if tokens, do: " #{fmt_tokens(tokens)} tok", else: ""
        tool = if tools && tools > 0, do: " #{tools} calls", else: ""
        sum = if summary, do: "\n    _#{truncate(summary, 60)}_", else: ""
        "  └ 🤖 `#{proj}`#{tok}#{tool} · #{ago(last_at)}#{sum}"
      end) |> Enum.join("\n")
    end

    """
    🤖 **agent thoughts ##{n}** · #{now}
    **#{active_count} active** / #{total} total Claude sessions
    #{session_lines}
    -# Claude session stream · token burn · tool activity
    """
  end

  defp build_message(:intelligence, n, _started) do
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

  defp build_message(:memory, n, _started) do
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

  defp build_message(:execution, n, _started) do
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

  defp build_message(:evolution, n, _started) do
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

  defp build_message(:speculative, n, _started) do
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

  defp schedule_all do
    @intervals |> Enum.map(fn {stream, ms} ->
      # Stagger starts so they don't all fire at once
      jitter = :rand.uniform(5_000)
      timer = Process.send_after(self(), {:tick, stream}, ms + jitter)
      {stream, timer}
    end) |> Map.new()
  end
end
